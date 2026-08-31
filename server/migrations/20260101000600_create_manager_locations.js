/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('manager_locations', (table) => {
    table.integer('user_id').unsigned().notNullable();
    table.integer('location_id').unsigned().notNullable();
    table.primary(['user_id', 'location_id']);
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('location_id').references('locations.id').onDelete('CASCADE');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('manager_locations');
}
