/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('actor_id').unsigned().nullable();
    table.integer('location_id').unsigned().nullable();
    table.string('entity_type', 80).notNullable();
    table.integer('entity_id').unsigned().notNullable();
    table.string('action', 80).notNullable();
    table.json('before_state').nullable();
    table.json('after_state').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('actor_id').references('users.id');
    table.foreign('location_id').references('locations.id');
    table.index(['entity_type', 'entity_id']);
    table.index(['location_id', 'created_at']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
}
