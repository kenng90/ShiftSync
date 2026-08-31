/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('overtime_overrides', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.date('week_start').notNullable();
    table.date('on_date').notNullable();
    table.string('reason', 500).notNullable();
    table.integer('granted_by').unsigned().notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('user_id').references('users.id');
    table.foreign('granted_by').references('users.id');
    table.index(['user_id', 'week_start']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('overtime_overrides');
}
