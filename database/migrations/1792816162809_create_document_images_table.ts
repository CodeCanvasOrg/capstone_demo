import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_images'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id')
      table.uuid('document_id').notNullable()
      table.integer('uploader_id').notNullable().references('users.id')
      table.text('object_key').notNullable().unique()
      table.string('filename', 255).notNullable()
      table.string('mime', 32).notNullable()
      table.integer('byte_size').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table
        .foreign(['workspace_id', 'document_id'])
        .references(['workspace_id', 'id'])
        .inTable('documents')
        .onDelete('CASCADE')
      table.index(['workspace_id', 'document_id'])
      table.check("mime IN ('image/png', 'image/jpeg')")
      table.check('byte_size > 0 AND byte_size <= 10485760')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
