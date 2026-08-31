# Realtime

Socket.io rooms are `user:{id}`, `location:{id}`, and `role:{role}`.

- Schedule publish/edit and assignments broadcast `schedule:changed` so staff calendars update without a refresh.
- Swap and notification events toast the relevant people immediately.
- Clock-in/out broadcasts `onduty:changed` for the live on-duty board.
- If two managers try to assign the same person, the second gets `CONCURRENT_ASSIGN` and an `assign:conflict` toast.
