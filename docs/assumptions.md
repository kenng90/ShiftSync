# Assumptions (intentional ambiguities)

1. **De-certify a location**: Historical assignments and audit rows stay. The certification is revoked (`revoked_at`), not deleted. Future assigns are blocked with `LOCATION_CERT`.

2. **Desired hours vs availability**: Availability is a hard constraint. Desired weekly hours are a fairness target only and never block an assign.

3. **Consecutive days**: Any assignment that *starts* on a local calendar date counts as a worked day, whether 1 hour or 11 hours.

4. **Edit after swap approval, before the shift**: If start, end, location, or required skill changes, the swap is cancelled and everyone is notified. Notes-only edits do not.

5. **Location on a timezone boundary**: Each location has exactly one IANA timezone. Split-timezone sites are out of scope.
