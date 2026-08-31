/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('shift_assignments', (table) => {
    table.increments('id').primary();
    table.integer('shift_id').unsigned().notNullable();
    table.integer('user_id').unsigned().notNullable();
    table
      .enum('status', ['assigned', 'clocked_in', 'clocked_out', 'removed'])
      .notNullable()
      .defaultTo('assigned');
    table.timestamp('clocked_in_at').nullable();
    table.timestamp('clocked_out_at').nullable();
    table.timestamps(true, true);
    table.unique(['shift_id', 'user_id']);
    table.foreign('shift_id').references('shifts.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id');
    table.index(['user_id', 'status']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('shift_assignments');
}
