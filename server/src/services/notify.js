import { db } from '../db/knex.js';

const bus = { io: null };

export function attachIo(io) {
  bus.io = io;
}

export async function notify(userIds, { type, title, body, payload }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return [];
  const rows = ids.map((user_id) => ({
    user_id,
    type,
    title,
    body,
    payload: payload ? JSON.stringify(payload) : null,
  }));
  const inserted = [];
  for (const row of rows) {
    const [id] = await db('notifications').insert(row);
    inserted.push({ id, ...row });
    const pref = await db('notification_preferences').where({ user_id: row.user_id }).first();
    if (pref?.channel === 'in_app_email') {
      console.log(`[email-sim] to user ${row.user_id}: ${title}: ${body}`);
    }
    bus.io?.to(`user:${row.user_id}`).emit('notification', {
      id,
      type,
      title,
      body,
      payload,
      createdAt: new Date().toISOString(),
    });
  }
  return inserted;
}

export function emitSchedule(locationId, event, data) {
  bus.io?.to(`location:${locationId}`).emit(event, data);
}

export function emitUser(userId, event, data) {
  bus.io?.to(`user:${userId}`).emit(event, data);
}

export function emitManagers(event, data) {
  bus.io?.to('role:manager').emit(event, data);
  bus.io?.to('role:admin').emit(event, data);
}
