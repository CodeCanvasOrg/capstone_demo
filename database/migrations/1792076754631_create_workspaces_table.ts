import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('workspaces', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name', 120).notNullable()
      table.integer('owner_user_id').notNullable().references('users.id')
      table.integer('initial_for_user_id').nullable().unique().references('users.id')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['id', 'owner_user_id'])
    })
  }
  async down() {
    this.schema.dropTable('workspaces')
  }
}
