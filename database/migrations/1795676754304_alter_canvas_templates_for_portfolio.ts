import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One portfolio template replaces the academic page designs. System templates get a family key
 * (`template_key`) and can be retired: a retired row stays, because a canvas saved from it may
 * still point at it, but the gallery and `visibleTo` no longer offer it.
 */
export default class extends BaseSchema {
  protected tableName = 'canvas_templates'

  async up() {
    this.schema.raw('ALTER TABLE canvas_templates DROP CONSTRAINT canvas_templates_category_check')
    this.schema.raw(
      "ALTER TABLE canvas_templates ADD CONSTRAINT canvas_templates_category_check CHECK (category IN ('brochure','academic','portfolio'))"
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.string('template_key', 32).nullable()
      table.timestamp('retired_at', { useTz: true }).nullable()
    })
    // One live system row per family and page design.
    this.schema.raw(
      "CREATE UNIQUE INDEX canvas_templates_system_family_key ON canvas_templates (template_key, design_id) WHERE workspace_id IS NULL AND retired_at IS NULL AND template_key IS NOT NULL"
    )
    // The academic page designs are retired, not deleted.
    this.schema.raw(
      "UPDATE canvas_templates SET retired_at = now() WHERE workspace_id IS NULL AND category = 'academic'"
    )
  }

  async down() {
    this.schema.raw('DROP INDEX canvas_templates_system_family_key')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('template_key')
      table.dropColumn('retired_at')
    })
    this.schema.raw("DELETE FROM canvas_templates WHERE category = 'portfolio'")
    this.schema.raw('ALTER TABLE canvas_templates DROP CONSTRAINT canvas_templates_category_check')
    this.schema.raw(
      "ALTER TABLE canvas_templates ADD CONSTRAINT canvas_templates_category_check CHECK (category IN ('brochure','academic'))"
    )
  }
}
