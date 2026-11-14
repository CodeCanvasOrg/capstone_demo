import { BaseSchema } from '@adonisjs/lucid/schema'

/** TPL-02/05: one pinned template + brand selection per document. */
export default class extends BaseSchema {
  protected tableName = 'document_layouts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('document_id').primary().references('documents.id').onDelete('CASCADE')
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.string('template_id', 64).notNullable()
      table.integer('template_version').notNullable()
      table.string('brand_id', 64).notNullable()
      table.integer('brand_version').notNullable()
      table.jsonb('options').notNullable().defaultTo('{}')
      table.uuid('preset_id').nullable().references('layout_presets.id').onDelete('SET NULL')
      // Compare-and-set counter for concurrent edits of the selection.
      table.integer('revision').notNullable().defaultTo(1)
      table.integer('updated_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['workspace_id', 'template_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
