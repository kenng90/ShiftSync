/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('swap_requests', (table) => {
    table.increments('id').primary();
    table.enum('type', ['swap', 'drop', 'pickup']).notNullable();
    table.integer('shift_id').unsigned().notNullable();
    table.integer('from_user_id').unsigned().notNullable();
    table.integer('to_user_id').unsigned().nullable();
    table
      .enum('status', [
        'pending_counterparty',
        'pending_manager',
        'approved',
        'declined',
        'cancelled',
        'expired',
      ])
      .notNullable();
    table.string('reason', 500).nullable();
    table.timestamp('expires_at').nullable();
    table.integer('resolved_by').unsigned().nullable();
    table.timestamp('resolved_at').nullable();
    table.timestamps(true, true);
    table.foreign('shift_id').references('shifts.id');
    table.foreign('from_user_id').references('users.id');
    table.foreign('to_user_id').references('users.id');
    table.foreign('resolved_by').references('users.id');
    table.index(['status', 'shift_id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('swap_requests');
}
