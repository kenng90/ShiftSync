import { Router } from 'express';
import { DateTime } from 'luxon';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired, assertLocationAccess, requireRole } from '../middleware/auth.js';
import { hoursBetween, localWallToUtc, weekStartMonday } from '../lib/time.js';
import { overtimeCost } from '../lib/labor.js';

export const laborRouter = Router();
laborRouter.use(authRequired, requireRole('admin', 'manager'));

laborRouter.get(
  '/overtime',
  wrap(async (req, res) => {
    const locationId = Number(req.query.locationId);
    await assertLocationAccess(req.user, locationId);
    const location = await db('locations').where({ id: locationId }).first();
    const weekStart = req.query.weekStart;
    const start = localWallToUtc(weekStart, '00:00', location.timezone);
    const end = start.plus({ days: 7 });
    const rows = await db('shift_assignments as a')
      .join('shifts as s', 's.id', 'a.shift_id')
      .join('users as u', 'u.id', 'a.user_id')
      .whereNot('a.status', 'removed')
      .where('s.location_id', locationId)
      .where('s.starts_at', '>=', start.toJSDate())
      .where('s.starts_at', '<', end.toJSDate())
      .select(
        'a.user_id',
        'u.first_name',
        'u.last_name',
        'u.hourly_wage',
        's.id as shift_id',
        's.starts_at',
        's.ends_at'
      );

    const byUser = new Map();
    for (const row of rows) {
      if (!byUser.has(row.user_id)) {
        byUser.set(row.user_id, {
          userId: row.user_id,
          name: `${row.first_name} ${row.last_name}`,
          hourlyWage: Number(row.hourly_wage),
          hours: 0,
          assignments: [],
        });
      }
      const rec = byUser.get(row.user_id);
      const hours = hoursBetween(row.starts_at, row.ends_at);
      rec.hours += hours;
      rec.assignments.push({
        shiftId: row.shift_id,
        hours,
        startsAt: row.starts_at,
        pushingOvertime: rec.hours > 40,
      });
    }

    const staff = [...byUser.values()].map((s) => {
      const otHours = Math.max(0, s.hours - 40);
      const otCost = overtimeCost(otHours, s.hourlyWage);
      return {
        ...s,
        otHours,
        otCost,
        warn35: s.hours >= 35,
        pushingAssignments: s.assignments.filter((a) => a.pushingOvertime),
      };
    });
    const projectedCost = staff.reduce((sum, s) => sum + s.otCost, 0);
    res.json({
      weekStart,
      timezone: location.timezone,
      projectedCost,
      staff,
    });
  })
);

laborRouter.post(
  '/overrides',
  wrap(async (req, res) => {
    const { userId, onDate, reason, locationId } = req.body;
    await assertLocationAccess(req.user, locationId);
    const location = await db('locations').where({ id: locationId }).first();
    const weekStart = weekStartMonday(
      DateTime.fromISO(onDate, { zone: location.timezone }).toUTC().toJSDate(),
      location.timezone
    );
    const [id] = await db('overtime_overrides').insert({
      user_id: userId,
      week_start: weekStart,
      on_date: onDate,
      reason,
      granted_by: req.user.id,
    });
    res.status(201).json({ id });
  })
);
