import { hoursBetween } from './time.js';
import { isPremium } from './premium.js';

export function hoursByStaff(rows, timezone) {
  const map = new Map();
  for (const row of rows) {
    const id = row.user_id;
    if (!map.has(id)) {
      map.set(id, {
        userId: id,
        name: `${row.first_name} ${row.last_name}`,
        hours: 0,
        premiumShifts: 0,
        totalShifts: 0,
        desiredWeeklyHours: Number(row.desired_weekly_hours),
      });
    }
    const rec = map.get(id);
    rec.hours += hoursBetween(row.starts_at, row.ends_at);
    rec.totalShifts += 1;
    if (isPremium(row.starts_at, timezone)) rec.premiumShifts += 1;
  }
  return [...map.values()];
}

export function fairnessScore(staffStats) {
  if (staffStats.length < 2) return { score: 100, note: 'Not enough staff to score equity.' };
  const premiums = staffStats.map((s) => s.premiumShifts);
  const avg = premiums.reduce((a, b) => a + b, 0) / premiums.length;
  if (avg === 0) return { score: 100, note: 'No premium (Fri/Sat evening) shifts in this range.' };
  const variance = premiums.reduce((sum, v) => sum + (v - avg) ** 2, 0) / premiums.length;
  const cv = Math.sqrt(variance) / Math.max(avg, 0.01);
  const score = Math.max(0, Math.round(100 - cv * 80));
  return {
    score,
    averagePremium: Number(avg.toFixed(2)),
    note:
      score >= 80
        ? 'Premium Friday/Saturday evenings look reasonably even.'
        : 'Premium shifts are bunched on some people — check the distribution below.',
  };
}

export function desiredGaps(staffStats, weekCount) {
  return staffStats.map((s) => {
    const target = s.desiredWeeklyHours * weekCount;
    const delta = s.hours - target;
    return {
      ...s,
      targetHours: target,
      delta,
      status: delta < -4 ? 'under' : delta > 4 ? 'over' : 'on-target',
    };
  });
}
