import { inZone } from './time.js';

/** Friday or Saturday, starting at 17:00 or later in the location timezone. */
export function isPremium(startsAt, timezone) {
  const local = inZone(startsAt, timezone);
  return (local.weekday === 5 || local.weekday === 6) && local.hour >= 17;
}
