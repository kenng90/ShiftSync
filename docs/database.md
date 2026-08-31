# Database

Knex owns schema changes. From the repo root:

```bash
npm run db:migrate
npm run db:rollback
```

Datetime columns on shifts are stored as UTC (`DATETIME` with session timezone `Z`). Location IANA timezones live on `locations.timezone`.
