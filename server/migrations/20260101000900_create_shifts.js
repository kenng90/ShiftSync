/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('shifts', (table) => {
    table.increments('id').primary();
    table.integer('location_id').unsigned().notNullable();
    table.datetime('starts_at', { useTz: false }).notNullable();
    table.datetime('ends_at', { useTz: false }).notNullable();
    table.integer('skill_id').unsigned().notNullable();
    table.tinyint('headcount').unsigned().notNullable().defaultTo(1);
    table.text('notes').nullable();
    table.enum('status', ['draft', 'published', 'cancelled']).notNullable().defaultTo('draft');
    table.integer('created_by').unsigned().notNullable();
    table.timestamp('published_at').nullable();
    table.timestamps(true, true);
    table.foreign('location_id').references('locations.id');
    table.foreign('skill_id').references('skills.id');
    table.foreign('created_by').references('users.id');
    table.index(['location_id', 'starts_at']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('shifts');
}
