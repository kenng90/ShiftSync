# De-certification

When a staff member is removed from a location:

- Historical assignments and audit rows stay in place.
- The certification row is revoked (`revoked_at`), not deleted.
- Future assignments to that location are blocked by the `LOCATION_CERT` rule.
- Past shifts can show that the person was certified at the time of assignment.
