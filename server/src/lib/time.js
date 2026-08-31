import { DateTime, Interval } from 'luxon';

/** Parse a DB UTC datetime into a UTC DateTime. */
export function asUtc(value) {
  if (DateTime.isDateTime(value)) return value.toUTC();
  if (value instanceof Date) return DateTime.fromJSDate(value, { zone: 'utc' });
  const raw = String(value).replace(' ', 'T');
  const dt = DateTime.fromISO(raw, { zone: 'utc' });
  if (dt.isValid) return dt;
  return DateTime.fromSQL(String(value), { zone: 'utc' });
}

export function inZone(value, timezone) {
  return asUtc(value).setZone(timezone);
}

export function localWallToUtc(dateStr, timeStr, timezone) {
  const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return DateTime.fromISO(`${dateStr}T${time}`, { zone: timezone }).toUTC();
}

/** Build a UTC interval for a shift; overnight is a single interval spanning midnight. */
export function overnightInterval(dateStr, startTime, endTime, timezone) {
  const start = localWallToUtc(dateStr, startTime, timezone);
  let end = localWallToUtc(dateStr, endTime, timezone);
  if (end <= start) end = end.plus({ days: 1 });
  return Interval.fromDateTimes(start, end);
}

export function hoursBetween(start, end) {
  return asUtc(end).diff(asUtc(start), 'hours').hours;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  const a = Interval.fromDateTimes(asUtc(aStart), asUtc(aEnd));
  const b = Interval.fromDateTimes(asUtc(bStart), asUtc(bEnd));
  return a.overlaps(b);
}

export function restHours(earlierEnd, laterStart) {
  return asUtc(laterStart).diff(asUtc(earlierEnd), 'hours').hours;
}

export function localDate(value, timezone) {
  return inZone(value, timezone).toISODate();
}

export function weekdayInZone(value, timezone) {
  return inZone(value, timezone).weekday % 7;
}

export function weekStartMonday(value, timezone) {
  const local = inZone(value, timezone).startOf('day');
  const monday = local.minus({ days: (local.weekday + 6) % 7 });
  return monday.toISODate();
}

export function isoFromUtc(value) {
  return asUtc(value).toISO();
}

export function timeToMinutes(timeStr) {
  const [h, m] = String(timeStr).split(':').map(Number);
  return h * 60 + (m || 0);
}
