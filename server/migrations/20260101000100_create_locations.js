/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('locations', (table) => {
    table.increments('id').primary();
    table.string('name', 120).notNullable();
    table.string('slug', 80).notNullable().unique();
    table.string('timezone', 64).notNullable();
    table.string('address', 255).notNullable();
    table.string('city', 80).notNullable();
    table.decimal('overtime_hourly_rate', 8, 2).notNullable().defaultTo(22.5);
    table.timestamps(true, true);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('locations');
}
