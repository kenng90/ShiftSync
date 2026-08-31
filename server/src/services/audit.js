import { db } from '../db/knex.js';

export async function writeAudit({
  actorId,
  locationId,
  entityType,
  entityId,
  action,
  before,
  after,
}) {
  await db('audit_logs').insert({
    actor_id: actorId || null,
    location_id: locationId || null,
    entity_type: entityType,
    entity_id: entityId,
    action,
    before_state: before ? JSON.stringify(before) : null,
    after_state: after ? JSON.stringify(after) : null,
  });
}

export async function shiftHistory(shiftId) {
  return db('audit_logs')
    .leftJoin('users', 'users.id', 'audit_logs.actor_id')
    .where({ entity_type: 'shift', entity_id: Number(shiftId) })
    .orWhere(function () {
      this.where({ entity_type: 'assignment' }).andWhereRaw(
        "JSON_EXTRACT(after_state, '$.shift_id') = ?",
        [Number(shiftId)]
      );
    })
    .select(
      'audit_logs.*',
      'users.first_name',
      'users.last_name',
      'users.email'
    )
    .orderBy('audit_logs.created_at', 'desc');
}
