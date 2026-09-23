import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_versions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('document_id').references('documents.id').notNullable().onDelete('CASCADE')
      table.integer('user_id').unsigned().references('users.id').onDelete('SET NULL')

      table.integer('version').defaultTo(0)
      table.jsonb('content')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
