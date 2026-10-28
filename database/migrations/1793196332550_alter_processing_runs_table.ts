import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `contextualizer` is part of a run's identity (a different context generator means different
 * embeddings); `extractor` records which PDF engine produced the blocks, for audits.
 */
export default class extends BaseSchema {
  protected tableName = 'processing_runs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('contextualizer', 255).nullable()
      table.string('extractor', 64).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('extractor')
      table.dropColumn('contextualizer')
    })
  }
}
