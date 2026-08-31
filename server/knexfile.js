import 'dotenv/config';
import { env } from './src/config/env.js';

const connection = {
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  timezone: 'Z',
};

const pool = { min: 0, max: 10 };

export default {
  development: {
    client: 'mysql2',
    connection,
    pool,
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
    seeds: { directory: './seeds' },
  },
  production: {
    client: 'mysql2',
    connection: process.env.DATABASE_URL || connection,
    pool,
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
    seeds: { directory: './seeds' },
  },
};
