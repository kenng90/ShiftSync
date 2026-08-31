/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('assignment_locks', (table) => {
    table.increments('id').primary();
    table.integer('staff_id').unsigned().notNullable();
    table.integer('holder_id').unsigned().notNullable();
    table.integer('shift_id').unsigned().nullable();
    table.timestamp('expires_at').notNullable();
    table.foreign('staff_id').references('users.id');
    table.foreign('holder_id').references('users.id');
    table.index(['staff_id', 'expires_at']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('assignment_locks');
}
