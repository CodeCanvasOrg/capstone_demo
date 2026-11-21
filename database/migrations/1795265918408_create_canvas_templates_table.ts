import { BaseSchema } from '@adonisjs/lucid/schema'

/** Canvas page and document templates: system ones (no workspace) and workspace ones. */
export default class extends BaseSchema {
  protected tableName = 'canvas_templates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      // NULL workspace = system template, seeded from the brochure designs and read-only.
      table.uuid('workspace_id').nullable().references('workspaces.id').onDelete('CASCADE')
      table.string('name', 80).notNullable()
      table.string('kind', 16).notNullable()
      table.string('design_id', 32).nullable()
      // Pinned like layout presets: an edit bumps the version, a canvas never changes under it.
      table.integer('version').notNullable().defaultTo(1)
      table.integer('schema_version').notNullable()
      table.jsonb('project').notNullable()
      table.specificType('project_hash', 'char(64)').notNullable()
      table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['workspace_id', 'kind'])
    })
    this.schema.raw(
      "ALTER TABLE canvas_templates ADD CONSTRAINT canvas_templates_kind_check CHECK (kind IN ('sheet','document'))"
    )
    // Names are unique per workspace (and among system templates) regardless of case.
    this.schema.raw(
      "CREATE UNIQUE INDEX canvas_templates_scope_name_key ON canvas_templates (COALESCE(workspace_id::text, 'system'), lower(name))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
