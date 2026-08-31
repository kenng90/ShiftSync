import { DateTime } from 'luxon';
import { db } from '../db/knex.js';
import { ConstraintError, HttpError } from '../lib/errors.js';
import { atPendingCap } from '../lib/swaps.js';
import { writeAudit } from './audit.js';
import { emitManagers, notify } from './notify.js';
import { evaluateAssign } from './shifts.js';

const PENDING = ['pending_counterparty', 'pending_manager'];

async function pendingCount(userId) {
  const row = await db('swap_requests')
    .where(function () {
      this.where({ from_user_id: userId }).orWhere({ to_user_id: userId });
    })
    .whereIn('status', PENDING)
    .count('id as c')
    .first();
  return Number(row.c);
}

export async function createRequest(actor, { type, shiftId, toUserId, reason }) {
  if (atPendingCap(await pendingCount(actor.id))) {
    throw new HttpError(400, 'You already have 3 pending swap/drop requests.');
  }
  const assignment = await db('shift_assignments')
    .where({ shift_id: shiftId, user_id: actor.id })
    .whereNot({ status: 'removed' })
    .first();
  const shift = await db('shifts').where({ id: shiftId, status: 'published' }).first();
  if (!shift) throw new HttpError(404, 'Shift not found or not published.');

  if (type === 'pickup') {
    const loc = await db('locations').where({ id: shift.location_id }).first();
    const { result, suggestions } = await evaluateAssign(shiftId, actor.id);
    if (!result.ok) throw new ConstraintError(result.violations, suggestions);
    const [id] = await db('swap_requests').insert({
      type: 'pickup',
      shift_id: shiftId,
      from_user_id: actor.id,
      to_user_id: actor.id,
      status: 'pending_manager',
      reason: reason || null,
    });
    await notifyManagers(shift, 'Pickup request needs approval', `${actor.first_name} wants to pick up a shift at ${loc.name}.`);
    return { id, status: 'pending_manager' };
  }

  if (!assignment) throw new HttpError(400, 'You are not assigned to this shift.');

  if (type === 'drop') {
    const expires = DateTime.fromJSDate(new Date(shift.starts_at), { zone: 'utc' }).minus({ hours: 24 });
    const [id] = await db('swap_requests').insert({
      type: 'drop',
      shift_id: shiftId,
      from_user_id: actor.id,
      status: 'pending_manager',
      reason: reason || null,
      expires_at: expires.toJSDate(),
    });
    await notifyManagers(shift, 'Drop request needs coverage', `${actor.first_name} offered a shift up for grabs.`);
    emitManagers('swap:updated', { id });
    return { id, status: 'pending_manager' };
  }

  if (type === 'swap') {
    if (!toUserId) throw new HttpError(400, 'Pick a teammate to swap with.');
    const { result, suggestions } = await evaluateAssign(shiftId, toUserId);
    if (!result.ok) throw new ConstraintError(result.violations, suggestions);
    const [id] = await db('swap_requests').insert({
      type: 'swap',
      shift_id: shiftId,
      from_user_id: actor.id,
      to_user_id: toUserId,
      status: 'pending_counterparty',
      reason: reason || null,
    });
    await notify([toUserId], {
      type: 'swap_request',
      title: 'Shift swap requested',
      body: `${actor.first_name} ${actor.last_name} asked to swap a shift with you.`,
      payload: { swapId: id, shiftId },
    });
    return { id, status: 'pending_counterparty' };
  }
  throw new HttpError(400, 'Unknown request type.');
}

export async function acceptSwap(actor, id) {
  const row = await db('swap_requests').where({ id }).first();
  if (!row || row.to_user_id !== actor.id) throw new HttpError(404, 'Swap not found.');
  if (row.status !== 'pending_counterparty') throw new HttpError(400, 'This swap is not waiting on you.');
  await db('swap_requests').where({ id }).update({ status: 'pending_manager' });
  const shift = await db('shifts').where({ id: row.shift_id }).first();
  await notify([row.from_user_id], {
    type: 'swap_accepted',
    title: 'Swap accepted — pending manager',
    body: `${actor.first_name} accepted the swap. A manager still has to approve it.`,
    payload: { swapId: id },
  });
  await notifyManagers(shift, 'Swap needs approval', 'Both staff agreed; waiting on a manager.');
  return { status: 'pending_manager' };
}

export async function cancelOwn(actor, id) {
  const row = await db('swap_requests').where({ id }).first();
  if (!row) throw new HttpError(404, 'Request not found.');
  if (row.from_user_id !== actor.id && row.to_user_id !== actor.id) {
    throw new HttpError(403, 'You cannot cancel this request.');
  }
  if (!PENDING.includes(row.status)) throw new HttpError(400, 'Only pending requests can be cancelled.');
  await db('swap_requests').where({ id }).update({
    status: 'cancelled',
    resolved_at: new Date(),
    resolved_by: actor.id,
  });
  await notify([row.from_user_id, row.to_user_id].filter((x) => x && x !== actor.id), {
    type: 'swap_cancelled',
    title: 'Swap/drop cancelled',
    body: 'A pending request was cancelled before manager approval. The original assignment stands.',
    payload: { swapId: id },
  });
  return { status: 'cancelled' };
}

export async function decide(actor, id, approve) {
  const row = await db('swap_requests').where({ id }).first();
  if (!row) throw new HttpError(404, 'Request not found.');
  if (row.status !== 'pending_manager') throw new HttpError(400, 'Nothing to approve yet.');
  if (!approve) {
    await db('swap_requests').where({ id }).update({
      status: 'declined',
      resolved_at: new Date(),
      resolved_by: actor.id,
    });
    await notify([row.from_user_id, row.to_user_id], {
      type: 'swap_declined',
      title: 'Request declined',
      body: 'A manager declined the swap or coverage change. Original assignment remains.',
      payload: { swapId: id },
    });
    return { status: 'declined' };
  }

  const shift = await db('shifts').where({ id: row.shift_id }).first();
  if (row.type === 'swap') {
    const { result, suggestions } = await evaluateAssign(row.shift_id, row.to_user_id);
    if (!result.ok) throw new ConstraintError(result.violations, suggestions);
    await db.transaction(async (trx) => {
      await trx('shift_assignments')
        .where({ shift_id: row.shift_id, user_id: row.from_user_id })
        .update({ status: 'removed' });
      const existing = await trx('shift_assignments')
        .where({ shift_id: row.shift_id, user_id: row.to_user_id })
        .first();
      if (existing) {
        await trx('shift_assignments').where({ id: existing.id }).update({ status: 'assigned' });
      } else {
        await trx('shift_assignments').insert({
          shift_id: row.shift_id,
          user_id: row.to_user_id,
          status: 'assigned',
        });
      }
    });
  } else if (row.type === 'drop') {
    await db('shift_assignments')
      .where({ shift_id: row.shift_id, user_id: row.from_user_id })
      .update({ status: 'removed' });
  } else if (row.type === 'pickup') {
    const { result, suggestions } = await evaluateAssign(row.shift_id, row.from_user_id);
    if (!result.ok) throw new ConstraintError(result.violations, suggestions);
    await db('shift_assignments').insert({
      shift_id: row.shift_id,
      user_id: row.from_user_id,
      status: 'assigned',
    });
  }

  await db('swap_requests').where({ id }).update({
    status: 'approved',
    resolved_at: new Date(),
    resolved_by: actor.id,
  });
  await writeAudit({
    actorId: actor.id,
    locationId: shift.location_id,
    entityType: 'swap',
    entityId: id,
    action: 'approve',
    after: row,
  });
  await notify([row.from_user_id, row.to_user_id], {
    type: 'swap_approved',
    title: 'Schedule change approved',
    body: 'A manager approved the swap or coverage change.',
    payload: { swapId: id, shiftId: row.shift_id },
  });
  return { status: 'approved' };
}

export async function expireDrops() {
  const due = await db('swap_requests')
    .where({ type: 'drop' })
    .whereIn('status', PENDING)
    .where('expires_at', '<', new Date());
  for (const row of due) {
    await db('swap_requests').where({ id: row.id }).update({
      status: 'expired',
      resolved_at: new Date(),
    });
    await notify([row.from_user_id], {
      type: 'drop_expired',
      title: 'Drop request expired',
      body: 'Unclaimed drop requests expire 24 hours before the shift. You are still assigned.',
      payload: { swapId: row.id },
    });
  }
}

async function notifyManagers(shift, title, body) {
  const managers = await db('manager_locations').where({ location_id: shift.location_id }).pluck('user_id');
  const admins = await db('users').where({ role: 'admin' }).pluck('id');
  await notify([...managers, ...admins], {
    type: 'swap_pending',
    title,
    body,
    payload: { shiftId: shift.id },
  });
}

export async function listRequests(user) {
  const q = db('swap_requests as r')
    .join('shifts as s', 's.id', 'r.shift_id')
    .join('locations as l', 'l.id', 's.location_id')
    .select('r.*', 's.starts_at', 's.ends_at', 'l.name as location_name', 'l.timezone');
  if (user.role === 'staff') {
    q.where(function () {
      this.where('r.from_user_id', user.id).orWhere('r.to_user_id', user.id);
    });
  }
  return q.orderBy('r.created_at', 'desc').limit(100);
}
