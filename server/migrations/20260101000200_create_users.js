/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email', 190).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 80).notNullable();
    table.string('last_name', 80).notNullable();
    table.enum('role', ['admin', 'manager', 'staff']).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('users');
}
