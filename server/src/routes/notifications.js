import { Router } from 'express';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(authRequired);

notificationsRouter.get(
  '/',
  wrap(async (req, res) => {
    const rows = await db('notifications').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(80);
    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        payload: parsePayload(n.payload),
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
    });
  })
);

notificationsRouter.get(
  '/preferences',
  wrap(async (req, res) => {
    const row =
      (await db('notification_preferences').where({ user_id: req.user.id }).first()) || {
        channel: 'in_app',
      };
    res.json({ channel: row.channel });
  })
);

notificationsRouter.put(
  '/preferences',
  wrap(async (req, res) => {
    const channel = req.body.channel === 'in_app_email' ? 'in_app_email' : 'in_app';
    const existing = await db('notification_preferences').where({ user_id: req.user.id }).first();
    if (existing) {
      await db('notification_preferences').where({ user_id: req.user.id }).update({ channel });
    } else {
      await db('notification_preferences').insert({ user_id: req.user.id, channel });
    }
    res.json({ channel });
  })
);

notificationsRouter.post(
  '/read-all',
  wrap(async (req, res) => {
    await db('notifications').where({ user_id: req.user.id }).whereNull('read_at').update({ read_at: new Date() });
    res.json({ ok: true });
  })
);

notificationsRouter.post(
  '/:id/read',
  wrap(async (req, res) => {
    await db('notifications')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({ read_at: new Date() });
    res.json({ ok: true });
  })
);

function parsePayload(payload) {
  if (!payload) return null;
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
