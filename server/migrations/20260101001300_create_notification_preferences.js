/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('notification_preferences', (table) => {
    table.integer('user_id').unsigned().notNullable().primary();
    table.enum('channel', ['in_app', 'in_app_email']).notNullable().defaultTo('in_app');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('notification_preferences');
}
