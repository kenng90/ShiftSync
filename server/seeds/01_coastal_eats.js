import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';

const PASSWORD = 'Password123!';

function utc(date, time, tz) {
  return DateTime.fromISO(`${date}T${time}`, { zone: tz }).toUTC().toJSDate();
}

/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  await knex('swap_requests').del();
  await knex('shift_assignments').del();
  await knex('shifts').del();
  await knex('availability_exceptions').del();
  await knex('availability_windows').del();
  await knex('user_skills').del();
  await knex('location_certifications').del();
  await knex('manager_locations').del();
  await knex('notifications').del();
  await knex('notification_preferences').del();
  await knex('audit_logs').del();
  await knex('overtime_overrides').del();
  await knex('schedule_weeks').del();
  await knex('assignment_locks').del();
  await knex('users').del();
  await knex('skills').del();
  await knex('locations').del();

  await knex('locations').insert([
    {
      id: 1,
      name: 'Cannon Beach Bistro',
      slug: 'cannon-beach',
      timezone: 'America/Los_Angeles',
      address: '132 Fir Street',
      city: 'Cannon Beach, OR',
      overtime_hourly_rate: 24,
    },
    {
      id: 2,
      name: 'Newport Harbor Grill',
      slug: 'newport',
      timezone: 'America/Los_Angeles',
      address: '88 Bay Boulevard',
      city: 'Newport, OR',
      overtime_hourly_rate: 23,
    },
    {
      id: 3,
      name: 'Charleston Oyster House',
      slug: 'charleston',
      timezone: 'America/New_York',
      address: '410 East Bay Street',
      city: 'Charleston, SC',
      overtime_hourly_rate: 22,
    },
    {
      id: 4,
      name: 'Savannah Tide Cafe',
      slug: 'savannah',
      timezone: 'America/New_York',
      address: '21 Factor Walk',
      city: 'Savannah, GA',
      overtime_hourly_rate: 21.5,
    },
  ]);

  await knex('skills').insert([
    { id: 1, name: 'Bartender', slug: 'bartender' },
    { id: 2, name: 'Line cook', slug: 'line-cook' },
    { id: 3, name: 'Server', slug: 'server' },
    { id: 4, name: 'Host', slug: 'host' },
  ]);

  const hash = await bcrypt.hash(PASSWORD, 10);
  const people = [
    ['ava.cole@coastaleats.test', 'Ava', 'Cole', 'admin', 40, 45],
    ['liam.brooks@coastaleats.test', 'Liam', 'Brooks', 'manager', 40, 32],
    ['maya.ortiz@coastaleats.test', 'Maya', 'Ortiz', 'manager', 40, 32],
    ['jordan.park@coastaleats.test', 'Jordan', 'Park', 'staff', 32, 18],
    ['marcus.chen@coastaleats.test', 'Marcus', 'Chen', 'staff', 32, 20],
    ['sarah.nguyen@coastaleats.test', 'Sarah', 'Nguyen', 'staff', 30, 19],
    ['john.reyes@coastaleats.test', 'John', 'Reyes', 'staff', 28, 19],
    ['maria.santos@coastaleats.test', 'Maria', 'Santos', 'staff', 28, 19],
    ['priya.shah@coastaleats.test', 'Priya', 'Shah', 'staff', 30, 17],
    ['diego.alvarez@coastaleats.test', 'Diego', 'Alvarez', 'staff', 32, 17],
    ['callie.ward@coastaleats.test', 'Callie', 'Ward', 'staff', 24, 18],
    ['elena.vasquez@coastaleats.test', 'Elena', 'Vasquez', 'staff', 36, 21],
    ['noah.kim@coastaleats.test', 'Noah', 'Kim', 'staff', 20, 16],
  ];
  await knex('users').insert(
    people.map(([email, first, last, role, desired, wage], i) => ({
      id: i + 1,
      email,
      password_hash: hash,
      first_name: first,
      last_name: last,
      role,
      desired_weekly_hours: desired,
      hourly_wage: wage,
    }))
  );

  await knex('manager_locations').insert([
    { user_id: 2, location_id: 1 },
    { user_id: 2, location_id: 2 },
    { user_id: 3, location_id: 3 },
    { user_id: 3, location_id: 4 },
  ]);

  const certs = [
    [4, 1],
    [4, 3],
    [5, 1],
    [6, 1],
    [6, 2],
    [7, 1],
    [8, 1],
    [9, 1],
    [10, 1],
    [11, 1],
    [12, 1],
    [13, 1],
    [5, 2],
    [9, 2],
    [12, 3],
    [10, 4],
  ];
  await knex('location_certifications').insert(
    certs.map(([user_id, location_id]) => ({ user_id, location_id }))
  );

  const skills = [
    [4, 3],
    [5, 1],
    [6, 1],
    [7, 1],
    [8, 1],
    [9, 3],
    [10, 3],
    [11, 1],
    [12, 2],
    [13, 4],
    [6, 3],
    [7, 3],
  ];
  await knex('user_skills').insert(skills.map(([user_id, skill_id]) => ({ user_id, skill_id })));

  const nineToFive = [];
  for (const userId of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
    for (let d = 0; d <= 6; d += 1) {
      const evening = [5, 6, 7, 8, 9, 11].includes(userId);
      nineToFive.push({
        user_id: userId,
        day_of_week: d,
        start_local: userId === 4 ? '09:00:00' : evening && (d === 5 || d === 6) ? '12:00:00' : '09:00:00',
        end_local: userId === 4 ? '17:00:00' : evening && (d === 5 || d === 6) ? '23:30:00' : '22:00:00',
        overnight: false,
      });
    }
  }
  await knex('availability_windows').insert(nineToFive);

  const pt = 'America/Los_Angeles';
  const createdBy = 2;
  const shifts = [];

  const add = (location_id, date, start, end, skill_id, headcount, status, tz = pt) => {
    const id = shifts.length + 1;
    shifts.push({
      id,
      location_id,
      starts_at: utc(date, start, tz),
      ends_at: utc(date, end, tz),
      skill_id,
      headcount,
      notes: null,
      status,
      created_by: createdBy,
      published_at: status === 'published' ? new Date() : null,
    });
    return id;
  };

  const marcusDays = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
  const marcusShiftIds = marcusDays.map((d) => add(1, d, '10:00', '18:00', 1, 1, 'published'));

  const sarahFri = add(1, '2026-09-04', '17:00', '23:00', 1, 1, 'published');
  const johnSat = add(1, '2026-09-05', '17:00', '23:00', 1, 1, 'published');
  const priyaLastFri = add(1, '2026-08-28', '17:00', '23:00', 3, 1, 'published');
  const priyaLastSat = add(1, '2026-08-29', '17:00', '23:00', 3, 1, 'published');
  const priyaFri = add(1, '2026-09-04', '17:00', '23:00', 3, 1, 'published');
  const priyaSat = add(1, '2026-09-05', '17:00', '23:00', 3, 1, 'published');
  const diegoLunch = add(1, '2026-09-02', '11:00', '16:00', 3, 1, 'published');
  const sundayChaos = add(1, '2026-09-06', '19:00', '23:00', 1, 1, 'published');
  const jordanPt = add(1, '2026-09-02', '10:00', '16:00', 3, 1, 'published');
  const jordanEt = add(3, '2026-09-03', '10:00', '16:00', 3, 1, 'published', 'America/New_York');
  const cook = add(1, '2026-09-04', '10:00', '18:00', 2, 1, 'published');
  const host = add(1, '2026-09-05', '16:00', '22:00', 4, 1, 'published');
  const overnight = add(1, '2026-09-04', '23:00', '03:00', 1, 1, 'published');
  const draftHole = add(1, '2026-09-06', '11:00', '16:00', 3, 2, 'draft');

  await knex('shifts').insert(shifts);

  const assign = [];
  marcusShiftIds.forEach((id) => assign.push({ shift_id: id, user_id: 5, status: 'assigned' }));
  assign.push(
    { shift_id: sarahFri, user_id: 6, status: 'assigned' },
    { shift_id: johnSat, user_id: 7, status: 'assigned' },
    { shift_id: priyaLastFri, user_id: 9, status: 'assigned' },
    { shift_id: priyaLastSat, user_id: 9, status: 'assigned' },
    { shift_id: priyaFri, user_id: 9, status: 'assigned' },
    { shift_id: priyaSat, user_id: 9, status: 'assigned' },
    { shift_id: diegoLunch, user_id: 10, status: 'assigned' },
    { shift_id: sundayChaos, user_id: 11, status: 'assigned' },
    { shift_id: jordanPt, user_id: 4, status: 'assigned' },
    { shift_id: jordanEt, user_id: 4, status: 'assigned' },
    { shift_id: cook, user_id: 12, status: 'assigned' },
    { shift_id: host, user_id: 13, status: 'assigned' },
    { shift_id: overnight, user_id: 8, status: 'assigned' }
  );
  await knex('shift_assignments').insert(assign);

  await knex('schedule_weeks').insert({
    location_id: 1,
    week_start: '2026-08-31',
    status: 'published',
    published_by: 2,
    published_at: new Date(),
  });

  await knex('swap_requests').insert({
    type: 'swap',
    shift_id: sarahFri,
    from_user_id: 6,
    to_user_id: 7,
    status: 'pending_counterparty',
    reason: 'Family dinner on Friday — can we trade for Saturday?',
  });

  await knex('notification_preferences').insert(
    people.map((_, i) => ({ user_id: i + 1, channel: 'in_app' }))
  );

  await knex.raw('ALTER TABLE locations AUTO_INCREMENT = 5');
  await knex.raw('ALTER TABLE users AUTO_INCREMENT = 20');
  await knex.raw('ALTER TABLE shifts AUTO_INCREMENT = 50');
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
}
