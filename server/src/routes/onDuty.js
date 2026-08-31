import { Router } from 'express';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired, managerLocationIds } from '../middleware/auth.js';
import { serializeShift } from '../services/shifts.js';

export const onDutyRouter = Router();
onDutyRouter.use(authRequired);

onDutyRouter.get(
  '/',
  wrap(async (req, res) => {
    const ids = await managerLocationIds(req.user);
    const rows = await db('shift_assignments as a')
      .join('shifts as s', 's.id', 'a.shift_id')
      .join('locations as l', 'l.id', 's.location_id')
      .join('users as u', 'u.id', 'a.user_id')
      .join('skills as k', 'k.id', 's.skill_id')
      .whereIn('s.location_id', ids.length ? ids : [0])
      .where('a.status', 'clocked_in')
      .select(
        'a.id',
        'a.clocked_in_at',
        'u.first_name',
        'u.last_name',
        's.*',
        'l.name as location_name',
        'l.timezone',
        'k.name as skill_name'
      );
    res.json({
      onDuty: rows.map((r) => ({
        assignmentId: r.id,
        name: `${r.first_name} ${r.last_name}`,
        skillName: r.skill_name,
        clockedInAt: r.clocked_in_at,
        shift: serializeShift(r, { name: r.location_name, timezone: r.timezone }),
      })),
    });
  })
);
