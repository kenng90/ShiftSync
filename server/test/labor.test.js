import test from 'node:test';
import assert from 'node:assert/strict';
import { overtimeCost } from '../src/lib/labor.js';
import { desiredGaps, fairnessScore } from '../src/lib/fairness.js';
import { isPremium } from '../src/lib/premium.js';
import { overnightInterval } from '../src/lib/time.js';

test('overtime cost uses 1.5x on hours over 40', () => {
  assert.equal(overtimeCost(8, 20), 8 * 20 * 1.5);
  assert.equal(overtimeCost(0, 20), 0);
});

test('Friday 17:00 PT is premium and Tuesday lunch is not', () => {
  const tz = 'America/Los_Angeles';
  const fri = overnightInterval('2026-09-04', '17:00', '23:00', tz);
  const tue = overnightInterval('2026-09-01', '11:00', '16:00', tz);
  assert.equal(isPremium(fri.start.toJSDate(), tz), true);
  assert.equal(isPremium(tue.start.toJSDate(), tz), false);
});

test('fairness score drops when premium shifts pile onto one person', () => {
  const even = fairnessScore([
    { premiumShifts: 2 },
    { premiumShifts: 2 },
    { premiumShifts: 2 },
  ]);
  const bunched = fairnessScore([
    { premiumShifts: 6 },
    { premiumShifts: 0 },
    { premiumShifts: 0 },
  ]);
  assert.ok(even.score > bunched.score);
  assert.ok(bunched.score < 80);
});

test('desired-hours gap marks under-scheduled staff', () => {
  const [row] = desiredGaps(
    [{ userId: 1, name: 'Diego', hours: 10, desiredWeeklyHours: 32, premiumShifts: 0, totalShifts: 2 }],
    1
  );
  assert.equal(row.status, 'under');
});
