/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('user_skills', (table) => {
    table.integer('user_id').unsigned().notNullable();
    table.integer('skill_id').unsigned().notNullable();
    table.primary(['user_id', 'skill_id']);
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('skill_id').references('skills.id').onDelete('CASCADE');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_skills');
}
