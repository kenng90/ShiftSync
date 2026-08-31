import knex from 'knex';
import config from '../knexfile.js';

const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const db = knex(config[environment]);

try {
  console.log('Running migrations…');
  const [, files] = await db.migrate.latest();
  console.log(files.length ? `Migrated: ${files.join(', ')}` : 'Migrations already up to date');

  const hasUsers = await db.schema.hasTable('users');
  const existing = hasUsers ? await db('users').first() : null;
  if (!existing) {
    console.log('Empty database, running seed…');
    await db.seed.run();
    console.log('Seed complete');
  } else {
    console.log('Data already present, skipping seed');
  }
} finally {
  await db.destroy();
}
