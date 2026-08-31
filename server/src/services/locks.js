import { DateTime } from 'luxon';
import { db } from '../db/knex.js';
import { HttpError } from '../lib/errors.js';
import { emitUser } from './notify.js';

export async function acquireLock(holder, staffId, shiftId) {
  await db('assignment_locks').where('expires_at', '<', new Date()).del();
  const existing = await db('assignment_locks')
    .where({ staff_id: staffId })
    .andWhere('expires_at', '>', new Date())
    .first();
  if (existing && existing.holder_id !== holder.id) {
    emitUser(holder.id, 'assign:conflict', {
      staffId,
      message: 'Another manager is assigning this person right now.',
    });
    throw new HttpError(409, 'Another manager is assigning this person right now.', {
      rule: 'CONCURRENT_ASSIGN',
    });
  }
  const expires = DateTime.utc().plus({ seconds: 20 }).toJSDate();
  if (existing) {
    await db('assignment_locks').where({ id: existing.id }).update({ expires_at: expires, shift_id: shiftId });
    return existing.id;
  }
  const [id] = await db('assignment_locks').insert({
    staff_id: staffId,
    holder_id: holder.id,
    shift_id: shiftId,
    expires_at: expires,
  });
  return id;
}

export async function releaseLock(holder, staffId) {
  await db('assignment_locks').where({ staff_id: staffId, holder_id: holder.id }).del();
}
