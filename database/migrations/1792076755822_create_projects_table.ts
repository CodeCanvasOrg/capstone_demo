import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('projects', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.integer('creator_id').notNullable().references('users.id')
      table.string('name', 120).notNullable()
      table.text('description').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['workspace_id', 'id'])
      table.index(['workspace_id', 'updated_at'])
    })
  }
  async down() {
    this.schema.dropTable('projects')
  }
}
