import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../db/knex.js';
import { HttpError } from '../lib/errors.js';

export async function authRequired(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Sign in required.');
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await db('users').where({ id: payload.sub, is_active: true }).first();
    if (!user) throw new HttpError(401, 'Account is not active.');
    req.user = user;
    next();
  } catch (err) {
    next(err.name === 'JsonWebTokenError' ? new HttpError(401, 'Invalid session.') : err);
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'You do not have access to this action.'));
      return;
    }
    next();
  };
}

export async function managerLocationIds(user) {
  if (user.role === 'admin') {
    const rows = await db('locations').select('id');
    return rows.map((r) => r.id);
  }
  if (user.role === 'manager') {
    const rows = await db('manager_locations').where({ user_id: user.id }).select('location_id');
    return rows.map((r) => r.location_id);
  }
  const rows = await db('location_certifications')
    .where({ user_id: user.id })
    .whereNull('revoked_at')
    .select('location_id');
  return rows.map((r) => r.location_id);
}

export async function assertLocationAccess(user, locationId) {
  const ids = await managerLocationIds(user);
  if (!ids.includes(Number(locationId)) && user.role !== 'staff') {
    throw new HttpError(403, 'You cannot manage this location.');
  }
  if (user.role === 'manager' && !ids.includes(Number(locationId))) {
    throw new HttpError(403, 'You cannot manage this location.');
  }
  return ids;
}
