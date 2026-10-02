import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'file_revisions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('file_id').references('files.id').notNullable().onDelete('CASCADE')
      table.integer('revision').notNullable().defaultTo(1)
      table.string('source_hash', 64).nullable()
      table.text('source_url').nullable()
      table.string('mime', 255).nullable()
      table.bigInteger('byte_size').nullable()
      table.timestamp('retrieved_at').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['file_id', 'revision'])
      table.index(['file_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
