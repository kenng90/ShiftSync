import { DateTime } from 'luxon';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { checkAssignment, suggestAlternatives } from '../lib/constraints.js';
import { ConstraintError, HttpError } from '../lib/errors.js';
import { inZone, isoFromUtc, localWallToUtc, overnightInterval } from '../lib/time.js';
import { writeAudit } from './audit.js';
import { emitSchedule, emitUser, notify } from './notify.js';
import { loadCandidatesForShift, loadStaffContext } from './staffContext.js';

const shiftBody = z.object({
  locationId: z.number(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  skillId: z.number(),
  headcount: z.number().int().min(1).max(20).default(1),
  notes: z.string().optional(),
});

export function serializeShift(shift, location) {
  const tz = location.timezone;
  return {
    id: shift.id,
    locationId: shift.location_id,
    locationName: location.name,
    timezone: tz,
    startsAt: isoFromUtc(shift.starts_at),
    endsAt: isoFromUtc(shift.ends_at),
    localDate: inZone(shift.starts_at, tz).toISODate(),
    localStart: inZone(shift.starts_at, tz).toFormat('HH:mm'),
    localEnd: inZone(shift.ends_at, tz).toFormat('HH:mm'),
    localLabel: `${inZone(shift.starts_at, tz).toFormat('ccc d LLL HH:mm')}–${inZone(shift.ends_at, tz).toFormat('HH:mm')} ${tz}`,
    overnight: inZone(shift.starts_at, tz).toISODate() !== inZone(shift.ends_at, tz).toISODate(),
    skillId: shift.skill_id,
    headcount: shift.headcount,
    notes: shift.notes,
    status: shift.status,
    premium: isPremium(shift.starts_at, tz),
  };
}

export function isPremium(startsAt, timezone) {
  const local = inZone(startsAt, timezone);
  const evening = local.hour >= 17;
  return (local.weekday === 5 || local.weekday === 6) && evening;
}

export async function createShift(actor, body) {
  const data = shiftBody.parse(body);
  const location = await db('locations').where({ id: data.locationId }).first();
  if (!location) throw new HttpError(404, 'Location not found.');
  const interval = overnightInterval(data.date, data.startTime, data.endTime, location.timezone);
  const [id] = await db('shifts').insert({
    location_id: data.locationId,
    starts_at: interval.start.toJSDate(),
    ends_at: interval.end.toJSDate(),
    skill_id: data.skillId,
    headcount: data.headcount,
    notes: data.notes || null,
    status: 'draft',
    created_by: actor.id,
  });
  const shift = await db('shifts').where({ id }).first();
  await writeAudit({
    actorId: actor.id,
    locationId: location.id,
    entityType: 'shift',
    entityId: id,
    action: 'create',
    after: shift,
  });
  return serializeShift(shift, location);
}

export async function updateShift(actor, id, body) {
  const existing = await db('shifts').where({ id }).first();
  if (!existing) throw new HttpError(404, 'Shift not found.');
  const location = await db('locations').where({ id: existing.location_id }).first();
  await assertEditable(existing, location);
  const data = shiftBody.partial().parse(body);
  const patch = { updated_at: new Date() };
  if (data.skillId) patch.skill_id = data.skillId;
  if (data.headcount) patch.headcount = data.headcount;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.date || data.startTime || data.endTime) {
    const start = inZone(existing.starts_at, location.timezone);
    const end = inZone(existing.ends_at, location.timezone);
    const date = data.date || start.toISODate();
    const startTime = data.startTime || start.toFormat('HH:mm');
    const endTime = data.endTime || end.toFormat('HH:mm');
    const interval = overnightInterval(date, startTime, endTime, location.timezone);
    patch.starts_at = interval.start.toJSDate();
    patch.ends_at = interval.end.toJSDate();
  }
  const material =
    patch.starts_at || patch.ends_at || patch.skill_id || data.locationId;
  await db('shifts').where({ id }).update(patch);
  if (material) await cancelOpenSwaps(id, actor, 'Shift was edited, so pending swaps were cancelled.');
  const updated = await db('shifts').where({ id }).first();
  await writeAudit({
    actorId: actor.id,
    locationId: location.id,
    entityType: 'shift',
    entityId: id,
    action: 'update',
    before: existing,
    after: updated,
  });
  emitSchedule(location.id, 'schedule:changed', { shiftId: id });
  return serializeShift(updated, location);
}

export async function cutoffHours() {
  const row = await db('app_settings').where({ key: 'schedule_cutoff_hours' }).first();
  return Number(row?.value || 48);
}

async function assertEditable(shift, location) {
  if (shift.status === 'cancelled') throw new HttpError(400, 'Shift is cancelled.');
  if (shift.status !== 'published') return;
  const hours = await cutoffHours();
  const until = DateTime.fromJSDate(new Date(shift.starts_at), { zone: 'utc' }).diffNow('hours').hours;
  if (until < hours) {
    throw new HttpError(
      400,
      `Published shifts cannot be edited within ${hours} hours of start (currently ${until.toFixed(1)}h away).`
    );
  }
}

async function cancelOpenSwaps(shiftId, actor, reason) {
  const open = await db('swap_requests')
    .where({ shift_id: shiftId })
    .whereIn('status', ['pending_counterparty', 'pending_manager', 'approved']);
  const pending = open.filter((s) => s.status !== 'approved');
  const approved = open.filter((s) => s.status === 'approved');
  const shift = await db('shifts').where({ id: shiftId }).first();
  const materialEdit = true;
  for (const row of pending) {
    await db('swap_requests').where({ id: row.id }).update({
      status: 'cancelled',
      resolved_at: new Date(),
      resolved_by: actor.id,
    });
    await notify([row.from_user_id, row.to_user_id], {
      type: 'swap_cancelled',
      title: 'Swap request cancelled',
      body: reason,
      payload: { swapId: row.id, shiftId },
    });
  }
  if (materialEdit) {
    for (const row of approved) {
      const starts = new Date(shift.starts_at).getTime();
      if (starts > Date.now()) {
        await db('swap_requests').where({ id: row.id }).update({
          status: 'cancelled',
          resolved_at: new Date(),
          resolved_by: actor.id,
        });
        await notify([row.from_user_id, row.to_user_id], {
          type: 'swap_cancelled',
          title: 'Approved swap cancelled',
          body: 'The shift time, location, or skill changed before the shift, so the swap was cancelled.',
          payload: { swapId: row.id, shiftId },
        });
      }
    }
  }
}

export async function listShifts({ locationId, from, to, role, userId }) {
  const q = db('shifts as s')
    .join('locations as l', 'l.id', 's.location_id')
    .join('skills as k', 'k.id', 's.skill_id')
    .where('s.location_id', locationId)
    .andWhere('s.starts_at', '>=', from)
    .andWhere('s.starts_at', '<', to)
    .whereNot('s.status', 'cancelled')
    .select('s.*', 'l.name as location_name', 'l.timezone', 'k.name as skill_name', 'k.slug as skill_slug');
  if (role === 'staff') q.andWhere('s.status', 'published');
  const shifts = await q.orderBy('s.starts_at');
  const ids = shifts.map((s) => s.id);
  const assignments = ids.length
    ? await db('shift_assignments as a')
        .join('users as u', 'u.id', 'a.user_id')
        .whereIn('a.shift_id', ids)
        .whereNot('a.status', 'removed')
        .select('a.*', 'u.first_name', 'u.last_name', 'u.email')
    : [];
  const byShift = new Map();
  for (const a of assignments) {
    if (!byShift.has(a.shift_id)) byShift.set(a.shift_id, []);
    byShift.get(a.shift_id).push({
      id: a.id,
      userId: a.user_id,
      name: `${a.first_name} ${a.last_name}`,
      status: a.status,
      clockedInAt: a.clocked_in_at,
      clockedOutAt: a.clocked_out_at,
    });
  }
  return shifts.map((s) => ({
    ...serializeShift(s, { name: s.location_name, timezone: s.timezone }),
    skillName: s.skill_name,
    skillSlug: s.skill_slug,
    assignments: byShift.get(s.id) || [],
    visibleToStaff: role !== 'staff' || s.status === 'published',
  }));
}

export async function evaluateAssign(shiftId, staffId, { overrideReason } = {}) {
  const shift = await db('shifts').where({ id: shiftId }).first();
  if (!shift) throw new HttpError(404, 'Shift not found.');
  const location = await db('locations').where({ id: shift.location_id }).first();
  const rangeStart = DateTime.fromJSDate(new Date(shift.starts_at), { zone: 'utc' })
    .minus({ days: 8 })
    .toJSDate();
  const rangeEnd = DateTime.fromJSDate(new Date(shift.ends_at), { zone: 'utc' })
    .plus({ days: 8 })
    .toJSDate();
  const staff = await loadStaffContext(staffId, rangeStart, rangeEnd);
  if (!staff) throw new HttpError(404, 'Staff member not found.');
  const seventh = overrideReason
    ? Boolean(
        await db('overtime_overrides')
          .where({ user_id: staffId, on_date: inZone(shift.starts_at, location.timezone).toISODate() })
          .first()
      ) || Boolean(overrideReason)
    : false;
  const result = checkAssignment({
    staff,
    shift: {
      ...shift,
      localLabel: serializeShift(shift, location).localLabel,
    },
    existingShifts: staff.existingShifts,
    timezone: location.timezone,
    seventhDayOverride: seventh && overrideReason,
  });
  let suggestions = [];
  if (!result.ok) {
    const candidates = await loadCandidatesForShift(shift, rangeStart, rangeEnd);
    suggestions = suggestAlternatives({
      candidates: candidates.filter((c) => c.id !== Number(staffId)),
      shift: { ...shift, localLabel: serializeShift(shift, location).localLabel },
      timezone: location.timezone,
    });
  }
  return { result, suggestions, shift, location, staff };
}

export async function assignStaff(actor, shiftId, staffId, { overrideReason } = {}) {
  return db.transaction(async (trx) => {
    await trx.raw('SELECT id FROM users WHERE id = ? FOR UPDATE', [staffId]);
    const lock = await trx('assignment_locks')
      .where({ staff_id: staffId })
      .andWhere('expires_at', '>', new Date())
      .andWhereNot({ holder_id: actor.id })
      .first();
    if (lock) {
      throw new HttpError(409, 'Another manager is assigning this person right now.', {
        rule: 'CONCURRENT_ASSIGN',
        holderId: lock.holder_id,
      });
    }
    const { result, suggestions, shift, location, staff } = await evaluateAssign(shiftId, staffId, {
      overrideReason,
    });
    if (!result.ok) throw new ConstraintError(result.violations, suggestions);
    const existing = await trx('shift_assignments')
      .where({ shift_id: shiftId, user_id: staffId })
      .first();
    if (existing && existing.status !== 'removed') {
      throw new HttpError(409, 'That person is already on this shift.');
    }
    const count = await trx('shift_assignments')
      .where({ shift_id: shiftId })
      .whereNot({ status: 'removed' })
      .count('id as c')
      .first();
    if (Number(count.c) >= shift.headcount) {
      throw new HttpError(409, 'This shift is already fully staffed.');
    }
    if (result.violations.some((v) => v.rule === 'SEVENTH_CONSECUTIVE_DAY') && !overrideReason) {
      throw new ConstraintError(result.violations, suggestions);
    }
    if (overrideReason) {
      await trx('overtime_overrides').insert({
        user_id: staffId,
        week_start: result.labor.weekStart,
        on_date: result.labor.dateISO,
        reason: overrideReason,
        granted_by: actor.id,
      });
    }
    let assignmentId;
    if (existing) {
      await trx('shift_assignments').where({ id: existing.id }).update({ status: 'assigned' });
      assignmentId = existing.id;
    } else {
      const [id] = await trx('shift_assignments').insert({
        shift_id: shiftId,
        user_id: staffId,
        status: 'assigned',
      });
      assignmentId = id;
    }
    await writeAudit({
      actorId: actor.id,
      locationId: location.id,
      entityType: 'assignment',
      entityId: assignmentId,
      action: 'assign',
      after: { shift_id: shiftId, user_id: staffId },
    });
    await notify([staffId], {
      type: 'shift_assigned',
      title: 'New shift assigned',
      body: `You were assigned at ${location.name}: ${serializeShift(shift, location).localLabel}`,
      payload: { shiftId },
    });
    emitSchedule(location.id, 'schedule:changed', { shiftId });
    emitUser(staffId, 'schedule:changed', { shiftId });
    return { assignmentId, warnings: result.warnings, labor: result.labor };
  });
}

export async function publishWeek(actor, locationId, weekStart) {
  const location = await db('locations').where({ id: locationId }).first();
  const start = localWallToUtc(weekStart, '00:00', location.timezone);
  const end = start.plus({ days: 7 });
  await db('shifts')
    .where({ location_id: locationId })
    .where('starts_at', '>=', start.toJSDate())
    .where('starts_at', '<', end.toJSDate())
    .where({ status: 'draft' })
    .update({ status: 'published', published_at: new Date() });
  const existing = await db('schedule_weeks').where({ location_id: locationId, week_start: weekStart }).first();
  if (existing) {
    await db('schedule_weeks').where({ id: existing.id }).update({
      status: 'published',
      published_by: actor.id,
      published_at: new Date(),
    });
  } else {
    await db('schedule_weeks').insert({
      location_id: locationId,
      week_start: weekStart,
      status: 'published',
      published_by: actor.id,
      published_at: new Date(),
    });
  }
  const staffIds = await db('shift_assignments as a')
    .join('shifts as s', 's.id', 'a.shift_id')
    .where('s.location_id', locationId)
    .where('s.starts_at', '>=', start.toJSDate())
    .where('s.starts_at', '<', end.toJSDate())
    .whereNot('a.status', 'removed')
    .pluck('a.user_id');
  await notify(staffIds, {
    type: 'schedule_published',
    title: 'Schedule published',
    body: `${location.name} published the week of ${weekStart}.`,
    payload: { locationId, weekStart },
  });
  emitSchedule(locationId, 'schedule:published', { locationId, weekStart });
}

export async function unpublishWeek(actor, locationId, weekStart) {
  const location = await db('locations').where({ id: locationId }).first();
  const hours = await cutoffHours();
  const start = localWallToUtc(weekStart, '00:00', location.timezone);
  const first = await db('shifts')
    .where({ location_id: locationId, status: 'published' })
    .where('starts_at', '>=', start.toJSDate())
    .orderBy('starts_at')
    .first();
  if (first) {
    const until = DateTime.fromJSDate(new Date(first.starts_at), { zone: 'utc' }).diffNow('hours').hours;
    if (until < hours) {
      throw new HttpError(400, `Too close to the first shift to unpublish (cutoff is ${hours} hours).`);
    }
  }
  const end = start.plus({ days: 7 });
  await db('shifts')
    .where({ location_id: locationId })
    .where('starts_at', '>=', start.toJSDate())
    .where('starts_at', '<', end.toJSDate())
    .where({ status: 'published' })
    .update({ status: 'draft', published_at: null });
  await db('schedule_weeks')
    .where({ location_id: locationId, week_start: weekStart })
    .update({ status: 'draft', unpublished_at: new Date() });
  emitSchedule(locationId, 'schedule:unpublished', { locationId, weekStart });
}
