import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Autosave buffer for the canvas editor, one per document. Dragging produces a
 * change per step; saving each as a version would flood history and reset
 * reviews, so steps land here and saving a version is explicit.
 */
export default class extends BaseSchema {
  protected tableName = 'document_canvas_drafts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('document_id').primary().references('documents.id').onDelete('CASCADE')
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      // The version the draft started from; saving fails if the document moved on.
      table
        .uuid('base_version_id')
        .nullable()
        .references('document_versions.id')
        .onDelete('SET NULL')
      table.integer('schema_version').notNullable()
      table.jsonb('project').notNullable()
      // Compare-and-set counter for two tabs editing at once.
      table.integer('revision').notNullable().defaultTo(1)
      table.integer('updated_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['workspace_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
