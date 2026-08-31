# ShiftSync

Multi-location staff scheduling for **Coastal Eats**, a fictional restaurant group with 4 locations across Pacific and Eastern time zones.

ShiftSync helps managers publish fair, legal schedules and helps staff swap or pick up coverage without double-booking, overtime surprises, or timezone confusion.

## Stack

- **API:** Node.js, Express, Knex, MySQL 8, Socket.io
- **Web:** React (Vite)
- **Realtime:** Socket.io rooms per user and location

## Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local MySQL 8)

## First run

```bash
cp .env.example .env
cp .env.example server/.env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev:server   # terminal 1 — API on :4000
npm run dev:client   # terminal 2 — web on :5173
```

`GET http://localhost:4000/health` should return `{ "status": "ok" }`.

## Demo logins

Password for every account: **`Password123!`**

| Who | Email |
|---|---|
| Admin | `ava.cole@coastaleats.test` |
| West manager | `liam.brooks@coastaleats.test` |
| East manager | `maya.ortiz@coastaleats.test` |
| Dual-timezone staff | `jordan.park@coastaleats.test` |
| Overtime trap | `marcus.chen@coastaleats.test` |
| Regret swap | `sarah.nguyen@coastaleats.test` |
| Sunday call-out | `callie.ward@coastaleats.test` |

See [docs/logins.md](docs/logins.md) and [docs/scenarios.md](docs/scenarios.md).

## Docs

- [Assumptions](docs/assumptions.md)
- [Known limitations](docs/limitations.md)
- [Availability vs desired hours](docs/availability.md)
- [Timezones](docs/timezones.md)

## Production

```bash
npm install
npm run build -w client
NODE_ENV=production npm run start -w server
```

The API then serves `client/dist` on the same origin. Set MySQL env vars and `JWT_SECRET`. A sample Render blueprint is in `render.yaml`.
