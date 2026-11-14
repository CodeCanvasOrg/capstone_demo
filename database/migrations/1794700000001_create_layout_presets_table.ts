import { BaseSchema } from '@adonisjs/lucid/schema'

/** TPL-05/07: reusable, workspace-scoped template + brand option bundles. */
export default class extends BaseSchema {
  protected tableName = 'layout_presets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.string('name', 80).notNullable()
      // Pinned versions: editing a preset never changes what a document already used.
      table.string('template_id', 64).notNullable()
      table.integer('template_version').notNullable()
      table.string('brand_id', 64).notNullable()
      table.integer('brand_version').notNullable()
      table.jsonb('options').notNullable().defaultTo('{}')
      table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['workspace_id', 'updated_at'])
    })
    // Names are unique per workspace regardless of case.
    this.schema.raw(
      'CREATE UNIQUE INDEX layout_presets_workspace_name_key ON layout_presets (workspace_id, lower(name))'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
