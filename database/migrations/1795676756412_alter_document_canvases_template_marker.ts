import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A saved canvas records which template made it (`template_key`, `template_version`), read from
 * the canvas' own marker when it is saved. Canvases made by the retired academic generation are
 * backfilled as `legacy_academic`, so they can be found and offered a regeneration.
 */
export default class extends BaseSchema {
  protected tableName = 'document_canvases'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('template_key', 32).nullable()
      table.smallint('template_version').nullable()
      table.index(['template_key'])
    })
    this.schema.raw(`
      UPDATE document_canvases SET template_key = 'legacy_academic'
      WHERE generation_run_id IN (
        SELECT id FROM canvas_generation_runs WHERE template_set IN ('academic_report','research_brief')
      )
    `)
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['template_key'])
      table.dropColumn('template_key')
      table.dropColumn('template_version')
    })
  }
}
