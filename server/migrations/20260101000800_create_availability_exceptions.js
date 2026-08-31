/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('availability_exceptions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.date('on_date').notNullable();
    table.enum('kind', ['unavailable', 'extra']).notNullable();
    table.time('start_local').nullable();
    table.time('end_local').nullable();
    table.string('note', 255).nullable();
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'on_date']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('availability_exceptions');
}
