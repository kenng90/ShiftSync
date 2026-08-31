/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('schedule_weeks', (table) => {
    table.increments('id').primary();
    table.integer('location_id').unsigned().notNullable();
    table.date('week_start').notNullable();
    table.enum('status', ['draft', 'published']).notNullable().defaultTo('draft');
    table.integer('published_by').unsigned().nullable();
    table.timestamp('published_at').nullable();
    table.timestamp('unpublished_at').nullable();
    table.timestamps(true, true);
    table.unique(['location_id', 'week_start']);
    table.foreign('location_id').references('locations.id');
    table.foreign('published_by').references('users.id');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('schedule_weeks');
}
