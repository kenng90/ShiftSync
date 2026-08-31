import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { db } from '../db/knex.js';
import { HttpError } from '../lib/errors.js';
import { managerLocationIds } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function publicUser(user, extras = {}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    desiredWeeklyHours: Number(user.desired_weekly_hours),
    ...extras,
  };
}

export async function login(body) {
  const { email, password } = loginSchema.parse(body);
  const user = await db('users').where({ email: email.toLowerCase() }).first();
  if (!user || !user.is_active) throw new HttpError(401, 'Invalid email or password.');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid email or password.');
  return { token: signToken(user), user: await hydrate(user) };
}

export async function hydrate(user) {
  const locations = await managerLocationIds(user);
  const skills = await db('user_skills as us')
    .join('skills as s', 's.id', 'us.skill_id')
    .where('us.user_id', user.id)
    .select('s.id', 's.name', 's.slug');
  const certs = await db('location_certifications as c')
    .join('locations as l', 'l.id', 'c.location_id')
    .where('c.user_id', user.id)
    .select('l.id', 'l.name', 'l.timezone', 'c.revoked_at');
  return publicUser(user, {
    locationIds: locations,
    skills,
    certifications: certs.map((c) => ({
      locationId: c.id,
      name: c.name,
      timezone: c.timezone,
      revoked: Boolean(c.revoked_at),
    })),
  });
}
