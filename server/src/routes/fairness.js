import { Router } from 'express';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired, assertLocationAccess, requireRole } from '../middleware/auth.js';
import { desiredGaps, fairnessScore, hoursByStaff } from '../lib/fairness.js';
import { localWallToUtc } from '../lib/time.js';

export const fairnessRouter = Router();
fairnessRouter.use(authRequired, requireRole('admin', 'manager'));

fairnessRouter.get(
  '/',
  wrap(async (req, res) => {
    const locationId = Number(req.query.locationId);
    await assertLocationAccess(req.user, locationId);
    const location = await db('locations').where({ id: locationId }).first();
    const from = req.query.from;
    const to = req.query.to;
    const start = localWallToUtc(from, '00:00', location.timezone);
    const end = localWallToUtc(to, '00:00', location.timezone);
    const weekCount = Math.max(1, end.diff(start, 'weeks').weeks || 1);
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
        'u.desired_weekly_hours',
        's.starts_at',
        's.ends_at'
      );
    const stats = hoursByStaff(rows, location.timezone);
    res.json({
      fairness: fairnessScore(stats),
      distribution: desiredGaps(stats, weekCount),
      premiumDefinition: 'Friday and Saturday shifts starting at 17:00 or later in the location timezone.',
    });
  })
);
