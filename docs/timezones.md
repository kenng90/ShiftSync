# Timezones

- Shift start/end are stored as UTC.
- The UI always shows a shift in **that location’s IANA timezone**, not the viewer’s laptop timezone.
- Recurring availability is wall-clock time interpreted in the location of the shift, so “9am–5pm” is 9–5 Pacific at Cannon Beach and 9–5 Eastern at Charleston, including DST.
- A shift from 11pm to 3am is one overnight interval.
- Each location has exactly one timezone. We do not model a restaurant that straddles a timezone boundary.
