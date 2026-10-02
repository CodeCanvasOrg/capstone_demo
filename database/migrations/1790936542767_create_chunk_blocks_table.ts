import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chunk_blocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('chunk_id').references('chunks.id').notNullable().onDelete('CASCADE')
      table
        .uuid('document_block_id')
        .references('document_blocks.id')
        .notNullable()
        .onDelete('CASCADE')
      table.integer('row_start').nullable()
      table.integer('row_end').nullable()
      table.integer('char_start').nullable()
      table.integer('char_end').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['chunk_id', 'document_block_id'])
      table.index(['document_block_id', 'chunk_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
