import { Router } from 'express';
import { DateTime } from 'luxon';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired, assertLocationAccess, requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
import { shiftHistory } from '../services/audit.js';
import { acquireLock, releaseLock } from '../services/locks.js';
import { emitSchedule } from '../services/notify.js';
import {
  assignStaff,
  createShift,
  evaluateAssign,
  listShifts,
  publishWeek,
  serializeShift,
  unpublishWeek,
  updateShift,
} from '../services/shifts.js';
import { loadCandidatesForShift } from '../services/staffContext.js';
import { suggestAlternatives } from '../lib/constraints.js';

export const shiftsRouter = Router();
shiftsRouter.use(authRequired);

shiftsRouter.get(
  '/',
  wrap(async (req, res) => {
    const locationId = Number(req.query.locationId);
    await assertLocationAccess(req.user, locationId);
    const from = req.query.from;
    const to = req.query.to;
    const shifts = await listShifts({
      locationId,
      from,
      to,
      role: req.user.role,
      userId: req.user.id,
    });
    res.json({ shifts });
  })
);

shiftsRouter.get(
  '/me/mine',
  wrap(async (req, res) => {
    const from = req.query.from;
    const to = req.query.to;
    const rows = await db('shift_assignments as a')
      .join('shifts as s', 's.id', 'a.shift_id')
      .join('locations as l', 'l.id', 's.location_id')
      .join('skills as k', 'k.id', 's.skill_id')
      .where('a.user_id', req.user.id)
      .whereNot('a.status', 'removed')
      .where('s.status', 'published')
      .modify((q) => {
        if (from) q.andWhere('s.starts_at', '>=', from);
        if (to) q.andWhere('s.starts_at', '<', to);
      })
      .select(
        's.*',
        'a.id as assignment_id',
        'a.status as assignment_status',
        'l.name as location_name',
        'l.timezone',
        'k.name as skill_name'
      );
    res.json({
      shifts: rows.map((s) => ({
        ...serializeShift(s, { name: s.location_name, timezone: s.timezone }),
        assignmentId: s.assignment_id,
        assignmentStatus: s.assignment_status,
        skillName: s.skill_name,
      })),
    });
  })
);

shiftsRouter.get(
  '/open/eligible',
  wrap(async (req, res) => {
    const now = new Date();
    const rows = await db('shifts as s')
      .join('locations as l', 'l.id', 's.location_id')
      .join('skills as k', 'k.id', 's.skill_id')
      .where('s.status', 'published')
      .andWhere('s.starts_at', '>', now)
      .select('s.*', 'l.name as location_name', 'l.timezone', 'k.name as skill_name');
    const out = [];
    for (const shift of rows) {
      const assigned = await db('shift_assignments')
        .where({ shift_id: shift.id })
        .whereNot({ status: 'removed' })
        .count('id as c')
        .first();
      if (Number(assigned.c) >= shift.headcount) continue;
      const { result } = await evaluateAssign(shift.id, req.user.id);
      if (result.ok) {
        out.push({
          ...serializeShift(shift, { name: shift.location_name, timezone: shift.timezone }),
          skillName: shift.skill_name,
          openSlots: shift.headcount - Number(assigned.c),
        });
      }
    }
    res.json({ shifts: out });
  })
);

shiftsRouter.post(
  '/',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    await assertLocationAccess(req.user, req.body.locationId);
    const shift = await createShift(req.user, req.body);
    res.status(201).json({ shift });
  })
);

shiftsRouter.patch(
  '/:id',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const existing = await db('shifts').where({ id: req.params.id }).first();
    if (!existing) throw new HttpError(404, 'Shift not found.');
    await assertLocationAccess(req.user, existing.location_id);
    const shift = await updateShift(req.user, Number(req.params.id), req.body);
    res.json({ shift });
  })
);

shiftsRouter.delete(
  '/:id',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const existing = await db('shifts').where({ id: req.params.id }).first();
    if (!existing) throw new HttpError(404, 'Shift not found.');
    await assertLocationAccess(req.user, existing.location_id);
    if (existing.status === 'published') {
      throw new HttpError(400, 'Unpublish the week before deleting a published shift.');
    }
    await db('shifts').where({ id: req.params.id }).update({ status: 'cancelled' });
    res.json({ ok: true });
  })
);

shiftsRouter.get(
  '/:id/eligible',
  wrap(async (req, res) => {
    const shift = await db('shifts').where({ id: req.params.id }).first();
    if (!shift) throw new HttpError(404, 'Shift not found.');
    if (req.user.role === 'staff') {
      const mine = await db('shift_assignments')
        .where({ shift_id: shift.id, user_id: req.user.id })
        .whereNot({ status: 'removed' })
        .first();
      if (!mine) throw new HttpError(403, 'You can only list teammates for your own shifts.');
    } else {
      await assertLocationAccess(req.user, shift.location_id);
    }
    const location = await db('locations').where({ id: shift.location_id }).first();
    const rangeStart = DateTime.fromJSDate(new Date(shift.starts_at), { zone: 'utc' }).minus({ days: 8 }).toJSDate();
    const rangeEnd = DateTime.fromJSDate(new Date(shift.ends_at), { zone: 'utc' }).plus({ days: 8 }).toJSDate();
    const candidates = await loadCandidatesForShift(shift, rangeStart, rangeEnd);
    const labeled = { ...shift, localLabel: serializeShift(shift, location).localLabel };
    const suggestions = suggestAlternatives({ candidates, shift: labeled, timezone: location.timezone, limit: 20 });
    res.json({ people: suggestions });
  })
);

shiftsRouter.post(
  '/:id/what-if',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const { result, suggestions } = await evaluateAssign(Number(req.params.id), Number(req.body.userId), {
      overrideReason: req.body.overrideReason,
    });
    res.json({ ...result, suggestions });
  })
);

shiftsRouter.post(
  '/:id/assign',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const shift = await db('shifts').where({ id: req.params.id }).first();
    await assertLocationAccess(req.user, shift.location_id);
    const out = await assignStaff(req.user, Number(req.params.id), Number(req.body.userId), {
      overrideReason: req.body.overrideReason,
    });
    res.status(201).json(out);
  })
);

shiftsRouter.delete(
  '/:id/assignments/:userId',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const shift = await db('shifts').where({ id: req.params.id }).first();
    await assertLocationAccess(req.user, shift.location_id);
    await db('shift_assignments')
      .where({ shift_id: req.params.id, user_id: req.params.userId })
      .update({ status: 'removed' });
    emitSchedule(shift.location_id, 'schedule:changed', { shiftId: shift.id });
    res.json({ ok: true });
  })
);

shiftsRouter.get(
  '/:id/history',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    res.json({ history: await shiftHistory(req.params.id) });
  })
);

shiftsRouter.post(
  '/:id/lock',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const id = await acquireLock(req.user, Number(req.body.userId), Number(req.params.id));
    res.json({ lockId: id });
  })
);

shiftsRouter.delete(
  '/:id/lock/:userId',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    await releaseLock(req.user, Number(req.params.userId));
    res.json({ ok: true });
  })
);

shiftsRouter.post(
  '/weeks/publish',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    await assertLocationAccess(req.user, req.body.locationId);
    await publishWeek(req.user, req.body.locationId, req.body.weekStart);
    res.json({ ok: true });
  })
);

shiftsRouter.post(
  '/weeks/unpublish',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    await assertLocationAccess(req.user, req.body.locationId);
    await unpublishWeek(req.user, req.body.locationId, req.body.weekStart);
    res.json({ ok: true });
  })
);

shiftsRouter.post(
  '/assignments/:id/clock-in',
  wrap(async (req, res) => {
    const row = await db('shift_assignments').where({ id: req.params.id, user_id: req.user.id }).first();
    if (!row) throw new HttpError(404, 'Assignment not found.');
    await db('shift_assignments').where({ id: row.id }).update({
      status: 'clocked_in',
      clocked_in_at: new Date(),
    });
    const shift = await db('shifts').where({ id: row.shift_id }).first();
    emitSchedule(shift.location_id, 'onduty:changed', { locationId: shift.location_id });
    res.json({ ok: true });
  })
);

shiftsRouter.post(
  '/assignments/:id/clock-out',
  wrap(async (req, res) => {
    const row = await db('shift_assignments').where({ id: req.params.id, user_id: req.user.id }).first();
    if (!row) throw new HttpError(404, 'Assignment not found.');
    await db('shift_assignments').where({ id: row.id }).update({
      status: 'clocked_out',
      clocked_out_at: new Date(),
    });
    const shift = await db('shifts').where({ id: row.shift_id }).first();
    emitSchedule(shift.location_id, 'onduty:changed', { locationId: shift.location_id });
    res.json({ ok: true });
  })
);
