import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('task_dispatches', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('task_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('workspace_tasks')
        .onDelete('CASCADE')
      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('dispatched_at', { useTz: true }).nullable()
      table.string('safe_error', 255).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }
  async down() {
    this.schema.dropTable('task_dispatches')
  }
}
