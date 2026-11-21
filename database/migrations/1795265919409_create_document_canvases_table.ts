import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The canvas of a saved version, one to one and never updated: a change makes a
 * new version and a new row. The version's `content` is the text derived from it.
 */
export default class extends BaseSchema {
  protected tableName = 'document_canvases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.uuid('document_id').notNullable().references('documents.id').onDelete('CASCADE')
      table
        .uuid('version_id')
        .notNullable()
        .unique()
        .references('document_versions.id')
        .onDelete('CASCADE')
      table.integer('schema_version').notNullable()
      table.jsonb('project').notNullable()
      // Joins the approval bundle, so moving a frame invalidates an approval like a text edit.
      table.specificType('project_hash', 'char(64)').notNullable()
      table.smallint('sheet_count').notNullable()
      table.string('source', 16).notNullable()
      table.uuid('template_id').nullable().references('canvas_templates.id').onDelete('SET NULL')
      table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['document_id', 'created_at'])
      table.index(['workspace_id'])
    })
    this.schema.raw(
      "ALTER TABLE document_canvases ADD CONSTRAINT document_canvases_source_check CHECK (source IN ('composed','edited','template'))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
