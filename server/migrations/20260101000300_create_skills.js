/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('skills', (table) => {
    table.increments('id').primary();
    table.string('name', 80).notNullable().unique();
    table.string('slug', 80).notNullable().unique();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('skills');
}
