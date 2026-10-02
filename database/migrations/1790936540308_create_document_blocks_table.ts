import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_blocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('processing_run_id')
        .references('processing_runs.id')
        .notNullable()
        .onDelete('CASCADE')
      table.string('block_type', 32).notNullable()
      table.text('text').notNullable()
      table.text('raw_reference').nullable()
      table.integer('order_index').notNullable()
      table.jsonb('section_path').notNullable().defaultTo('[]')
      table.jsonb('source_locator').notNullable().defaultTo('{}')
      table.string('extraction_method', 64).notNullable()
      table.float('confidence').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['processing_run_id', 'order_index'])
      table.index(['processing_run_id', 'order_index'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
