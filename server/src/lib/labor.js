import { hoursBetween, localDate, overlaps, restHours, weekStartMonday } from './time.js';

const WEEKLY_WARN = 35;
const DAILY_WARN = 8;
const DAILY_BLOCK = 12;

export function assignmentHours(shift) {
  return hoursBetween(shift.starts_at, shift.ends_at);
}

export function weeklyHours(assignments, timezone, weekStart, extraShift = null) {
  const list = extraShift ? [...assignments, extraShift] : assignments;
  return list
    .filter((a) => weekStartMonday(a.starts_at, timezone) === weekStart)
    .reduce((sum, a) => sum + assignmentHours(a), 0);
}

export function dailyHours(assignments, timezone, dateISO, extraShift = null) {
  const list = extraShift ? [...assignments, extraShift] : assignments;
  return list
    .filter((a) => localDate(a.starts_at, timezone) === dateISO)
    .reduce((sum, a) => sum + assignmentHours(a), 0);
}

/** Any shift that starts on a local calendar date counts as a worked day. */
export function consecutiveWorkedDays(assignments, timezone, aroundShift) {
  const dates = new Set(
    assignments.map((a) => localDate(a.starts_at, timezone))
  );
  dates.add(localDate(aroundShift.starts_at, timezone));
  const start = localDate(aroundShift.starts_at, timezone);
  let count = 0;
  let cursor = start;
  while (dates.has(cursor)) {
    count += 1;
    const [y, m, d] = cursor.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    cursor = prev.toISOString().slice(0, 10);
  }
  return count;
}

export function laborWarnings({
  existing,
  candidate,
  timezone,
  seventhDayOverride = false,
}) {
  const warnings = [];
  const violations = [];
  const weekStart = weekStartMonday(candidate.starts_at, timezone);
  const dateISO = localDate(candidate.starts_at, timezone);
  const week = weeklyHours(existing, timezone, weekStart, candidate);
  const day = dailyHours(existing, timezone, dateISO, candidate);
  const streak = consecutiveWorkedDays(existing, timezone, candidate);

  if (week >= WEEKLY_WARN) {
    warnings.push({
      rule: 'WEEKLY_HOURS_WARN',
      message: `${candidate.name || 'This person'} would reach ${week.toFixed(1)} hours this week (warning at 35+).`,
      hours: week,
    });
  }
  if (day > DAILY_WARN && day <= DAILY_BLOCK) {
    warnings.push({
      rule: 'DAILY_HOURS_WARN',
      message: `Daily hours would be ${day.toFixed(1)} (warning above 8).`,
      hours: day,
    });
  }
  if (day > DAILY_BLOCK) {
    violations.push({
      rule: 'DAILY_HOURS_BLOCK',
      message: `Cannot assign: daily hours would be ${day.toFixed(1)}, which exceeds the 12-hour hard cap.`,
      hours: day,
    });
  }
  if (streak === 6) {
    warnings.push({
      rule: 'SIXTH_CONSECUTIVE_DAY',
      message: `This would be the 6th consecutive day worked this stretch.`,
      days: streak,
    });
  }
  if (streak >= 7 && !seventhDayOverride) {
    violations.push({
      rule: 'SEVENTH_CONSECUTIVE_DAY',
      message: `7th consecutive day requires a manager override with a documented reason.`,
      days: streak,
    });
  }
  return { warnings, violations, week, day, streak, weekStart, dateISO };
}

export function overtimeCost(hoursOver40, hourlyWage, multiplier = 1.5) {
  return Math.max(0, hoursOver40) * hourlyWage * (multiplier - 1) + Math.max(0, hoursOver40) * hourlyWage;
}
