/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('availability_windows', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.tinyint('day_of_week').unsigned().notNullable();
    table.time('start_local').notNullable();
    table.time('end_local').notNullable();
    table.boolean('overnight').notNullable().defaultTo(false);
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'day_of_week']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('availability_windows');
}
