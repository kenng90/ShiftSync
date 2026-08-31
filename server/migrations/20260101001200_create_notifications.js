/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('type', 80).notNullable();
    table.string('title', 160).notNullable();
    table.text('body').notNullable();
    table.json('payload').nullable();
    table.timestamp('read_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'read_at']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('notifications');
}
