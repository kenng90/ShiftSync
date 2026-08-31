import { Router } from 'express';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired, requireRole } from '../middleware/auth.js';

export const auditRouter = Router();
auditRouter.use(authRequired, requireRole('admin'));

auditRouter.get(
  '/',
  wrap(async (req, res) => {
    const q = db('audit_logs as a')
      .leftJoin('users as u', 'u.id', 'a.actor_id')
      .leftJoin('locations as l', 'l.id', 'a.location_id')
      .modify((builder) => {
        if (req.query.locationId) builder.where('a.location_id', req.query.locationId);
        if (req.query.from) builder.where('a.created_at', '>=', req.query.from);
        if (req.query.to) builder.where('a.created_at', '<', req.query.to);
      })
      .select(
        'a.*',
        'u.first_name',
        'u.last_name',
        'u.email',
        'l.name as location_name'
      )
      .orderBy('a.created_at', 'desc')
      .limit(500);
    res.json({ logs: await q });
  })
);

auditRouter.get(
  '/export',
  wrap(async (req, res) => {
    const logs = await db('audit_logs as a')
      .leftJoin('users as u', 'u.id', 'a.actor_id')
      .modify((builder) => {
        if (req.query.locationId) builder.where('a.location_id', req.query.locationId);
        if (req.query.from) builder.where('a.created_at', '>=', req.query.from);
        if (req.query.to) builder.where('a.created_at', '<', req.query.to);
      })
      .select('a.*', 'u.email')
      .orderBy('a.created_at', 'desc');
    const header = 'id,created_at,actor,location_id,entity_type,entity_id,action\n';
    const body = logs
      .map((l) =>
        [l.id, l.created_at?.toISOString?.() || l.created_at, l.email, l.location_id, l.entity_type, l.entity_id, l.action].join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="shiftsync-audit.csv"');
    res.send(header + body);
  })
);
