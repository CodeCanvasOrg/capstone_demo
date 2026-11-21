import { BaseSchema } from '@adonisjs/lucid/schema'

/** Which editor a document uses: the text flow (default) or the canvas. */
export default class extends BaseSchema {
  protected tableName = 'document_layouts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('editor_mode', 8).notNullable().defaultTo('flow')
    })
    this.schema.raw(
      "ALTER TABLE document_layouts ADD CONSTRAINT document_layouts_editor_mode_check CHECK (editor_mode IN ('flow','canvas'))"
    )
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('editor_mode')
    })
  }
}
