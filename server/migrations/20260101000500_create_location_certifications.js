/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('location_certifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.integer('location_id').unsigned().notNullable();
    table.timestamp('certified_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('location_id').references('locations.id').onDelete('CASCADE');
    table.index(['user_id', 'location_id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('location_certifications');
}
