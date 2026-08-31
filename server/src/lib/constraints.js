import { isAvailableForShift } from './availability.js';
import { laborWarnings } from './labor.js';
import { overlaps, restHours } from './time.js';

const REST_HOURS = 10;

function nameOf(user) {
  return `${user.first_name} ${user.last_name}`.trim();
}

export function checkAssignment({ staff, shift, existingShifts, timezone, seventhDayOverride }) {
  const violations = [];
  const warnings = [];
  const who = nameOf(staff);

  if (!staff.skillIds?.includes(shift.skill_id)) {
    violations.push({
      rule: 'SKILL',
      message: `${who} does not have the required skill for this shift.`,
      details: { requiredSkillId: shift.skill_id, staffSkillIds: staff.skillIds || [] },
    });
  }

  const certified =
    staff.certifiedLocationIds?.includes(shift.location_id) &&
    !staff.revokedLocationIds?.includes(shift.location_id);
  if (!certified) {
    violations.push({
      rule: 'LOCATION_CERT',
      message: `${who} is not currently certified to work at this location.`,
      details: { locationId: shift.location_id },
    });
  }

  if (!isAvailableForShift(staff, shift, timezone)) {
    violations.push({
      rule: 'AVAILABILITY',
      message: `${who} is unavailable for ${shift.localLabel || 'this shift'} at this location's local time.`,
      details: { startsAt: shift.starts_at, endsAt: shift.ends_at, timezone },
    });
  }

  for (const other of existingShifts) {
    if (other.id === shift.id) continue;
    if (overlaps(shift.starts_at, shift.ends_at, other.starts_at, other.ends_at)) {
      violations.push({
        rule: 'DOUBLE_BOOK',
        message: `${who} is already assigned from ${other.localLabel || other.starts_at} (including other locations).`,
        details: { conflictingShiftId: other.id, locationId: other.location_id },
      });
    } else {
      const gap =
        new Date(shift.starts_at) >= new Date(other.ends_at)
          ? restHours(other.ends_at, shift.starts_at)
          : restHours(shift.ends_at, other.starts_at);
      if (gap < REST_HOURS) {
        violations.push({
          rule: 'REST_10H',
          message: `${who} would have only ${gap.toFixed(1)} hours between shifts; the minimum rest is 10 hours.`,
          details: { otherShiftId: other.id, restHours: gap },
        });
      }
    }
  }

  const labor = laborWarnings({
    existing: existingShifts,
    candidate: { ...shift, name: who },
    timezone,
    seventhDayOverride,
  });
  warnings.push(...labor.warnings);
  violations.push(...labor.violations);

  return {
    ok: violations.length === 0,
    violations,
    warnings,
    labor,
  };
}

export function suggestAlternatives({ candidates, shift, timezone, limit = 3 }) {
  const suggestions = [];
  for (const staff of candidates) {
    const result = checkAssignment({
      staff,
      shift,
      existingShifts: staff.existingShifts || [],
      timezone,
    });
    if (result.ok) {
      suggestions.push({
        userId: staff.id,
        name: nameOf(staff),
        message: `${nameOf(staff)} has the required skill, location certification, and availability.`,
        weeklyHours: result.labor.week,
      });
    }
    if (suggestions.length >= limit) break;
  }
  return suggestions.sort((a, b) => a.weeklyHours - b.weeklyHours);
}
