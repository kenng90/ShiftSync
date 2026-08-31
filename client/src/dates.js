import { DateTime } from 'luxon';

export function mondayOf(date = DateTime.now()) {
  const d = typeof date === 'string' ? DateTime.fromISO(date) : date;
  return d.minus({ days: (d.weekday + 6) % 7 }).startOf('day');
}

export function weekDays(weekStart) {
  const start = DateTime.fromISO(weekStart);
  return Array.from({ length: 7 }, (_, i) => start.plus({ days: i }));
}
