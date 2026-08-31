import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAssignment, suggestAlternatives } from '../src/lib/constraints.js';
import { isAvailableForShift } from '../src/lib/availability.js';
import { consecutiveWorkedDays } from '../src/lib/labor.js';
import { overnightInterval } from '../src/lib/time.js';

const tz = 'America/Los_Angeles';

function staff(overrides = {}) {
  return {
    id: 1,
    first_name: 'Sarah',
    last_name: 'Nguyen',
    skillIds: [1],
    certifiedLocationIds: [1],
    revokedLocationIds: [],
    windows: [
      { day_of_week: 0, start_local: '09:00:00', end_local: '17:00:00', overnight: false },
      { day_of_week: 1, start_local: '09:00:00', end_local: '17:00:00', overnight: false },
      { day_of_week: 5, start_local: '16:00:00', end_local: '23:00:00', overnight: false },
      { day_of_week: 6, start_local: '16:00:00', end_local: '23:00:00', overnight: false },
    ],
    exceptions: [],
    existingShifts: [],
    ...overrides,
  };
}

function shiftOn(isoDate, start, end, extra = {}) {
  const interval = overnightInterval(isoDate, start, end, tz);
  return {
    id: 99,
    location_id: 1,
    skill_id: 1,
    starts_at: interval.start.toJSDate(),
    ends_at: interval.end.toJSDate(),
    localLabel: `${isoDate} ${start}-${end}`,
    ...extra,
  };
}

test('rejects missing skill', () => {
  const result = checkAssignment({
    staff: staff({ skillIds: [2] }),
    shift: shiftOn('2026-09-04', '16:00', '22:00'),
    existingShifts: [],
    timezone: tz,
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].rule, 'SKILL');
});

test('rejects uncertified location', () => {
  const result = checkAssignment({
    staff: staff({ certifiedLocationIds: [2] }),
    shift: shiftOn('2026-09-04', '16:00', '22:00'),
    existingShifts: [],
    timezone: tz,
  });
  assert.ok(result.violations.some((v) => v.rule === 'LOCATION_CERT'));
});

test('rejects outside availability', () => {
  const result = checkAssignment({
    staff: staff(),
    shift: shiftOn('2026-09-01', '18:00', '23:00'),
    existingShifts: [],
    timezone: tz,
  });
  assert.ok(result.violations.some((v) => v.rule === 'AVAILABILITY'));
});

test('rejects overlapping shifts across locations', () => {
  const a = shiftOn('2026-09-04', '16:00', '22:00');
  const b = overnightInterval('2026-09-04', '17:00', '21:00', 'America/New_York');
  const result = checkAssignment({
    staff: staff({
      existingShifts: [
        { id: 7, location_id: 3, starts_at: b.start.toJSDate(), ends_at: b.end.toJSDate() },
      ],
    }),
    shift: a,
    existingShifts: [
      { id: 7, location_id: 3, starts_at: b.start.toJSDate(), ends_at: b.end.toJSDate() },
    ],
    timezone: tz,
  });
  assert.ok(result.violations.some((v) => v.rule === 'DOUBLE_BOOK'));
});

test('rejects rest under 10 hours', () => {
  const first = overnightInterval('2026-09-04', '16:00', '23:00', tz);
  const result = checkAssignment({
    staff: staff(),
    shift: shiftOn('2026-09-05', '07:00', '12:00'),
    existingShifts: [
      { id: 3, location_id: 1, starts_at: first.start.toJSDate(), ends_at: first.end.toJSDate() },
    ],
    timezone: tz,
  });
  assert.ok(result.violations.some((v) => v.rule === 'REST_10H'));
});

test('overnight 23:00-03:00 is a single interval', () => {
  const interval = overnightInterval('2026-09-05', '23:00', '03:00', tz);
  assert.equal(interval.end.diff(interval.start, 'hours').hours, 4);
});

test('DST-aware 9am-5pm covers local wall clock', () => {
  const person = staff({
    windows: Array.from({ length: 7 }, (_, d) => ({
      day_of_week: d,
      start_local: '09:00:00',
      end_local: '17:00:00',
      overnight: false,
    })),
  });
  const pt = overnightInterval('2026-03-08', '09:00', '17:00', tz);
  assert.equal(
    isAvailableForShift(person, { starts_at: pt.start.toJSDate(), ends_at: pt.end.toJSDate() }, tz),
    true
  );
});

test('1-hour and 11-hour shifts both count as a worked day', () => {
  const short = overnightInterval('2026-08-31', '11:00', '12:00', tz);
  const long = overnightInterval('2026-09-01', '10:00', '21:00', tz);
  const around = {
    starts_at: overnightInterval('2026-09-02', '10:00', '12:00', tz).start.toJSDate(),
  };
  const days = consecutiveWorkedDays(
    [
      { starts_at: short.start.toJSDate() },
      { starts_at: long.start.toJSDate() },
    ],
    tz,
    around
  );
  assert.equal(days, 3);
});

test('suggests alternatives who pass all rules', () => {
  const john = staff({ id: 2, first_name: 'John', last_name: 'Reyes' });
  const suggestions = suggestAlternatives({
    candidates: [john],
    shift: shiftOn('2026-09-04', '16:00', '22:00'),
    timezone: tz,
  });
  assert.equal(suggestions[0].name, 'John Reyes');
});
