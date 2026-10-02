import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chunks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('run_id').references('processing_runs.id').nullable().onDelete('CASCADE')
      table.uuid('file_revision_id').references('file_revisions.id').nullable().onDelete('CASCADE')
      table.string('kind', 32).notNullable().defaultTo('text')
      table.integer('token_count').notNullable().defaultTo(0)
      table.string('content_hash', 64).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(
        "ALTER TABLE chunks ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED"
      )
      await db.rawQuery('CREATE INDEX chunks_content_tsv_gin ON chunks USING gin (content_tsv)')
      await db.rawQuery(
        'CREATE INDEX chunks_run_index ON chunks (run_id, chunk_index) WHERE run_id IS NOT NULL'
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS chunks_run_index')
      await db.rawQuery('DROP INDEX IF EXISTS chunks_content_tsv_gin')
      await db.rawQuery('ALTER TABLE chunks DROP COLUMN IF EXISTS content_tsv')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('content_hash')
      table.dropColumn('token_count')
      table.dropColumn('kind')
      table.dropColumn('file_revision_id')
      table.dropColumn('run_id')
    })
  }
}
