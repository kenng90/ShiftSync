import { db } from '../db/knex.js';
import { asUtc } from '../lib/time.js';

export async function loadStaffContext(userId, rangeStart, rangeEnd) {
  const user = await db('users').where({ id: userId, is_active: true }).first();
  if (!user) return null;
  const [skills, certs, windows, exceptions, assignments] = await Promise.all([
    db('user_skills').where({ user_id: userId }),
    db('location_certifications').where({ user_id: userId }),
    db('availability_windows').where({ user_id: userId }),
    db('availability_exceptions').where({ user_id: userId }),
    db('shift_assignments as a')
      .join('shifts as s', 's.id', 'a.shift_id')
      .where('a.user_id', userId)
      .whereNot('a.status', 'removed')
      .modify((q) => {
        if (rangeStart) q.andWhere('s.ends_at', '>=', rangeStart);
        if (rangeEnd) q.andWhere('s.starts_at', '<=', rangeEnd);
      })
      .select(
        's.id',
        's.location_id',
        's.starts_at',
        's.ends_at',
        's.skill_id',
        'a.status as assignment_status'
      ),
  ]);
  return {
    ...user,
    skillIds: skills.map((s) => s.skill_id),
    certifiedLocationIds: certs.filter((c) => !c.revoked_at).map((c) => c.location_id),
    revokedLocationIds: certs.filter((c) => c.revoked_at).map((c) => c.location_id),
    windows,
    exceptions: exceptions.map((e) => ({
      ...e,
      on_date: String(e.on_date).slice(0, 10),
    })),
    existingShifts: assignments.map((s) => ({
      ...s,
      starts_at: asUtc(s.starts_at).toJSDate(),
      ends_at: asUtc(s.ends_at).toJSDate(),
    })),
  };
}

export async function loadCandidatesForShift(shift, rangeStart, rangeEnd) {
  const skillRows = await db('user_skills').where({ skill_id: shift.skill_id }).select('user_id');
  const certRows = await db('location_certifications')
    .where({ location_id: shift.location_id })
    .whereNull('revoked_at')
    .select('user_id');
  const ids = skillRows
    .map((r) => r.user_id)
    .filter((id) => certRows.some((c) => c.user_id === id));
  const unique = [...new Set(ids)];
  const people = [];
  for (const id of unique) {
    const ctx = await loadStaffContext(id, rangeStart, rangeEnd);
    if (ctx && ctx.role === 'staff') people.push(ctx);
  }
  return people;
}
