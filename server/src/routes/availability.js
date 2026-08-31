import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { wrap } from '../middleware/error.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { notify } from '../services/notify.js';

export const availabilityRouter = Router();
availabilityRouter.use(authRequired);

const windowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startLocal: z.string(),
  endLocal: z.string(),
  overnight: z.boolean().optional(),
});

availabilityRouter.get(
  '/me',
  wrap(async (req, res) => {
    const windows = await db('availability_windows').where({ user_id: req.user.id });
    const exceptions = await db('availability_exceptions').where({ user_id: req.user.id });
    res.json({ windows, exceptions });
  })
);

availabilityRouter.put(
  '/me/windows',
  wrap(async (req, res) => {
    const windows = z.array(windowSchema).parse(req.body.windows);
    await db.transaction(async (trx) => {
      await trx('availability_windows').where({ user_id: req.user.id }).del();
      if (windows.length) {
        await trx('availability_windows').insert(
          windows.map((w) => ({
            user_id: req.user.id,
            day_of_week: w.dayOfWeek,
            start_local: w.startLocal,
            end_local: w.endLocal,
            overnight: Boolean(w.overnight || w.endLocal <= w.startLocal),
          }))
        );
      }
    });
    const managers = await db('manager_locations as m')
      .join('location_certifications as c', 'c.location_id', 'm.location_id')
      .where('c.user_id', req.user.id)
      .whereNull('c.revoked_at')
      .pluck('m.user_id');
    await notify(managers, {
      type: 'availability_changed',
      title: 'Staff availability updated',
      body: `${req.user.first_name} ${req.user.last_name} changed recurring availability.`,
      payload: { userId: req.user.id },
    });
    res.json({ ok: true });
  })
);

availabilityRouter.post(
  '/me/exceptions',
  wrap(async (req, res) => {
    const data = z
      .object({
        onDate: z.string(),
        kind: z.enum(['unavailable', 'extra']),
        startLocal: z.string().optional(),
        endLocal: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(req.body);
    const [id] = await db('availability_exceptions').insert({
      user_id: req.user.id,
      on_date: data.onDate,
      kind: data.kind,
      start_local: data.startLocal || null,
      end_local: data.endLocal || null,
      note: data.note || null,
    });
    res.status(201).json({ id });
  })
);

availabilityRouter.delete(
  '/me/exceptions/:id',
  wrap(async (req, res) => {
    await db('availability_exceptions').where({ id: req.params.id, user_id: req.user.id }).del();
    res.json({ ok: true });
  })
);

availabilityRouter.get(
  '/:userId',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const windows = await db('availability_windows').where({ user_id: req.params.userId });
    const exceptions = await db('availability_exceptions').where({ user_id: req.params.userId });
    res.json({ windows, exceptions });
  })
);
