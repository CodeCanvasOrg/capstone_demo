import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'processing_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('file_revision_id')
        .references('file_revisions.id')
        .notNullable()
        .onDelete('CASCADE')
      table.string('pipeline_version', 64).notNullable()
      table.string('status', 24).notNullable().defaultTo('queued')
      table.jsonb('stage_timings').notNullable().defaultTo('{}')
      table.jsonb('warnings').notNullable().defaultTo('[]')
      table.string('embedding_model', 255).nullable()
      table.integer('embedding_dimensions').nullable()
      table.text('error').nullable()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('lease_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['file_revision_id', 'created_at'])
      table.index(['status', 'updated_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
