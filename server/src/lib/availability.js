import { DateTime, Interval } from 'luxon';
import { asUtc, inZone, timeToMinutes } from './time.js';

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of sorted) {
    if (!out.length || s > out[out.length - 1][1]) out.push([s, e]);
    else out[out.length - 1][1] = Math.max(out[out.length - 1][1], e);
  }
  return out;
}

function covered(ranges, startMin, endMin) {
  const merged = mergeRanges(ranges);
  return merged.some(([s, e]) => s <= startMin && e >= endMin);
}

function windowsForLocalDate(windows, dateISO, timezone) {
  const day = DateTime.fromISO(dateISO, { zone: timezone });
  const dow = day.weekday % 7;
  const prev = day.minus({ days: 1 }).weekday % 7;
  const ranges = [];
  for (const w of windows) {
    if (Number(w.day_of_week) === dow) {
      const start = timeToMinutes(w.start_local);
      const end = w.overnight ? 24 * 60 : timeToMinutes(w.end_local);
      if (end > start) ranges.push([start, end]);
    }
    if (w.overnight && Number(w.day_of_week) === prev) {
      ranges.push([0, timeToMinutes(w.end_local)]);
    }
  }
  return ranges;
}

function extraRanges(exceptions, dateISO) {
  return exceptions
    .filter((e) => e.kind === 'extra' && String(e.on_date).slice(0, 10) === dateISO)
    .map((e) => [
      e.start_local ? timeToMinutes(e.start_local) : 0,
      e.end_local ? timeToMinutes(e.end_local) : 24 * 60,
    ]);
}

function isUnavailable(exceptions, dateISO, startMin, endMin) {
  return exceptions
    .filter((e) => e.kind === 'unavailable' && String(e.on_date).slice(0, 10) === dateISO)
    .some((e) => {
      if (!e.start_local && !e.end_local) return true;
      const s = e.start_local ? timeToMinutes(e.start_local) : 0;
      const t = e.end_local ? timeToMinutes(e.end_local) : 24 * 60;
      return s < endMin && t > startMin;
    });
}

/**
 * Availability is a hard constraint. Wall-clock windows are interpreted in the
 * shift location's timezone so "9am–5pm" means 9–5 local at that restaurant,
 * including across DST transitions.
 */
export function isAvailableForShift(staff, shift, timezone) {
  const interval = Interval.fromDateTimes(asUtc(shift.starts_at), asUtc(shift.ends_at));
  if (!interval.isValid || interval.length('minutes') <= 0) return false;

  let cursor = inZone(shift.starts_at, timezone);
  const end = inZone(shift.ends_at, timezone);

  while (cursor < end) {
    const dayEnd = cursor.endOf('day');
    const sliceEnd = end < dayEnd ? end : dayEnd.plus({ milliseconds: 1 });
    const dateISO = cursor.toISODate();
    const startMin = cursor.hour * 60 + cursor.minute;
    const endDt = sliceEnd.minus({ milliseconds: 1 });
    const endMin =
      dateISO !== endDt.toISODate() ? 24 * 60 : endDt.hour * 60 + endDt.minute + 1;

    if (isUnavailable(staff.exceptions || [], dateISO, startMin, endMin)) return false;

    const ranges = [
      ...windowsForLocalDate(staff.windows || [], dateISO, timezone),
      ...extraRanges(staff.exceptions || [], dateISO),
    ];
    if (!covered(ranges, startMin, Math.min(endMin, 24 * 60))) return false;

    cursor = cursor.plus({ days: 1 }).startOf('day');
  }
  return true;
}
