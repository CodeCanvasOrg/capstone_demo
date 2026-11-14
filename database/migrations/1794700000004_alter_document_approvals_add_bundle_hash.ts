import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * APR-01: the output bundle (content, template, brand, options, assets,
 * renderer) an approval covers. Nullable so approvals made before this change
 * are never rewritten or given provenance they did not have.
 */
export default class extends BaseSchema {
  protected tableName = 'document_approvals'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('bundle_hash', 64).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('bundle_hash')
    })
  }
}
