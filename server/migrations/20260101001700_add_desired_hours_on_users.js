/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.decimal('desired_weekly_hours', 5, 2).notNullable().defaultTo(32);
    table.decimal('hourly_wage', 8, 2).notNullable().defaultTo(18);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('desired_weekly_hours');
    table.dropColumn('hourly_wage');
  });
}
