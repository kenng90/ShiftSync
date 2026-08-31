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
