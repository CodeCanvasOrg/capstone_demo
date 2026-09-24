import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_shares'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('document_id').references('documents.id').notNullable().onDelete('CASCADE')
      table.integer('user_id').notNullable().references('users.id').onDelete('CASCADE')

      table.enum('role', ['view', 'edit'])

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['user_id', 'document_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
