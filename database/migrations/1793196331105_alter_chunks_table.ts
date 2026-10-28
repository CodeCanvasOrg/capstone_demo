import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Contextual chunking: `context` situates a chunk in its document. It is embedded and full-text
 * indexed together with `content`, but it is derived text and is never shown as evidence.
 * `content_tsv` is a generated column, so it is recreated to cover both.
 */
export default class extends BaseSchema {
  protected tableName = 'chunks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('context').nullable()
      table.string('context_source', 16).nullable()
    })
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS chunks_content_tsv_gin')
      await db.rawQuery('ALTER TABLE chunks DROP COLUMN IF EXISTS content_tsv')
      await db.rawQuery(
        "ALTER TABLE chunks ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(context, '') || ' ' || coalesce(content, ''))) STORED"
      )
      await db.rawQuery('CREATE INDEX chunks_content_tsv_gin ON chunks USING gin (content_tsv)')
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS chunks_content_tsv_gin')
      await db.rawQuery('ALTER TABLE chunks DROP COLUMN IF EXISTS content_tsv')
      await db.rawQuery(
        "ALTER TABLE chunks ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED"
      )
      await db.rawQuery('CREATE INDEX chunks_content_tsv_gin ON chunks USING gin (content_tsv)')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('context_source')
      table.dropColumn('context')
    })
  }
}
