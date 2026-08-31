/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('app_settings', (table) => {
    table.string('key', 80).primary();
    table.string('value', 255).notNullable();
  });
  await knex('app_settings').insert({ key: 'schedule_cutoff_hours', value: '48' });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('app_settings');
}
