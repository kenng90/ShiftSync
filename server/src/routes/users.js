import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { HttpError } from '../lib/errors.js';
import { wrap } from '../middleware/error.js';
import { authRequired, managerLocationIds, requireRole } from '../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(authRequired);

const userBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['admin', 'manager', 'staff']),
  desiredWeeklyHours: z.number().optional(),
  hourlyWage: z.number().optional(),
  isActive: z.boolean().optional(),
});

usersRouter.get(
  '/skills',
  wrap(async (_req, res) => {
    res.json({ skills: await db('skills').orderBy('name') });
  })
);

usersRouter.get(
  '/',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const users = await db('users').select(
      'id',
      'email',
      'first_name',
      'last_name',
      'role',
      'desired_weekly_hours',
      'hourly_wage',
      'is_active'
    );
    const skills = await db('user_skills as us')
      .join('skills as s', 's.id', 'us.skill_id')
      .select('us.user_id', 's.id', 's.name', 's.slug');
    const certs = await db('location_certifications as c')
      .join('locations as l', 'l.id', 'c.location_id')
      .select('c.user_id', 'l.id', 'l.name', 'c.revoked_at');
    const managers = await db('manager_locations');
    res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role,
        desiredWeeklyHours: Number(u.desired_weekly_hours),
        hourlyWage: Number(u.hourly_wage),
        isActive: Boolean(u.is_active),
        skills: skills.filter((s) => s.user_id === u.id).map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
        certifications: certs
          .filter((c) => c.user_id === u.id)
          .map((c) => ({ locationId: c.id, name: c.name, revoked: Boolean(c.revoked_at) })),
        managedLocationIds: managers.filter((m) => m.user_id === u.id).map((m) => m.location_id),
      })),
    });
  })
);

usersRouter.post(
  '/',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const data = userBody.parse(req.body);
    if (req.user.role === 'manager' && data.role !== 'staff') {
      throw new HttpError(403, 'Managers can only create staff accounts.');
    }
    const hash = await bcrypt.hash(data.password || 'Password123!', 10);
    const [id] = await db('users').insert({
      email: data.email.toLowerCase(),
      password_hash: hash,
      first_name: data.firstName,
      last_name: data.lastName,
      role: data.role,
      desired_weekly_hours: data.desiredWeeklyHours ?? 32,
      hourly_wage: data.hourlyWage ?? 18,
      is_active: data.isActive !== false,
    });
    res.status(201).json({ id });
  })
);

usersRouter.patch(
  '/:id',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const existing = await db('users').where({ id: req.params.id }).first();
    if (!existing) throw new HttpError(404, 'User not found.');
    if (req.user.role === 'manager' && existing.role !== 'staff') {
      throw new HttpError(403, 'Managers can only edit staff.');
    }
    const data = userBody.partial().parse(req.body);
    if (req.user.role === 'manager' && data.role && data.role !== 'staff') {
      throw new HttpError(403, 'Managers cannot change roles.');
    }
    const patch = { updated_at: new Date() };
    if (data.firstName) patch.first_name = data.firstName;
    if (data.lastName) patch.last_name = data.lastName;
    if (data.email) patch.email = data.email.toLowerCase();
    if (data.role) patch.role = data.role;
    if (data.desiredWeeklyHours !== undefined) patch.desired_weekly_hours = data.desiredWeeklyHours;
    if (data.hourlyWage !== undefined) patch.hourly_wage = data.hourlyWage;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.password) patch.password_hash = await bcrypt.hash(data.password, 10);
    await db('users').where({ id: req.params.id }).update(patch);
    res.json({ ok: true });
  })
);

usersRouter.put(
  '/:id/skills',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const skillIds = z.array(z.number()).parse(req.body.skillIds);
    await db.transaction(async (trx) => {
      await trx('user_skills').where({ user_id: req.params.id }).del();
      if (skillIds.length) {
        await trx('user_skills').insert(skillIds.map((skill_id) => ({ user_id: req.params.id, skill_id })));
      }
    });
    res.json({ ok: true });
  })
);

usersRouter.put(
  '/:id/certifications',
  requireRole('admin', 'manager'),
  wrap(async (req, res) => {
    const requested = z.array(z.number()).parse(req.body.locationIds);
    const allowed = new Set(await managerLocationIds(req.user));
    const scoped = requested.filter((id) => allowed.has(id));
    if (req.user.role === 'manager' && requested.some((id) => !allowed.has(id))) {
      throw new HttpError(403, 'You can only certify staff at locations you manage.');
    }
    const existing = await db('location_certifications').where({ user_id: req.params.id });
    const current = new Set(existing.filter((c) => !c.revoked_at).map((c) => c.location_id));
    const next = new Set(req.user.role === 'admin' ? requested : [...current].filter((id) => !allowed.has(id)).concat(scoped));
    for (const row of existing) {
      if (!row.revoked_at && !next.has(row.location_id) && (req.user.role === 'admin' || allowed.has(row.location_id))) {
        await db('location_certifications').where({ id: row.id }).update({ revoked_at: new Date() });
      }
    }
    for (const locationId of next) {
      if (!current.has(locationId)) {
        await db('location_certifications').insert({
          user_id: req.params.id,
          location_id: locationId,
        });
      }
    }
    res.json({ ok: true });
  })
);

usersRouter.put(
  '/:id/locations',
  requireRole('admin'),
  wrap(async (req, res) => {
    const locationIds = z.array(z.number()).parse(req.body.locationIds);
    await db.transaction(async (trx) => {
      await trx('manager_locations').where({ user_id: req.params.id }).del();
      if (locationIds.length) {
        await trx('manager_locations').insert(
          locationIds.map((location_id) => ({ user_id: req.params.id, location_id }))
        );
      }
    });
    res.json({ ok: true });
  })
);
