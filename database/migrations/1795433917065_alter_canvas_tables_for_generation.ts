import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Generated canvases and the academic templates: a `generated` source that links
 * the run that produced a canvas, and a category, slots and preview for templates.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE document_canvases DROP CONSTRAINT document_canvases_source_check')
    this.schema.raw(
      "ALTER TABLE document_canvases ADD CONSTRAINT document_canvases_source_check CHECK (source IN ('composed','edited','template','generated'))"
    )
    this.schema.alterTable('document_canvases', (table) => {
      table
        .uuid('generation_run_id')
        .nullable()
        .references('canvas_generation_runs.id')
        .onDelete('SET NULL')
    })
    this.schema.alterTable('canvas_templates', (table) => {
      table.string('category', 16).notNullable().defaultTo('brochure')
      // Word ranges and image slots, for the gallery and validation.
      table.jsonb('slots').notNullable().defaultTo('{}')
      table.string('preview_key', 255).nullable()
    })
    this.schema.raw(
      "ALTER TABLE canvas_templates ADD CONSTRAINT canvas_templates_category_check CHECK (category IN ('brochure','academic'))"
    )
  }

  async down() {
    this.schema.raw('ALTER TABLE canvas_templates DROP CONSTRAINT canvas_templates_category_check')
    this.schema.alterTable('canvas_templates', (table) => {
      table.dropColumn('category')
      table.dropColumn('slots')
      table.dropColumn('preview_key')
    })
    this.schema.alterTable('document_canvases', (table) => {
      table.dropColumn('generation_run_id')
    })
    this.schema.raw("DELETE FROM document_canvases WHERE source = 'generated'")
    this.schema.raw('ALTER TABLE document_canvases DROP CONSTRAINT document_canvases_source_check')
    this.schema.raw(
      "ALTER TABLE document_canvases ADD CONSTRAINT document_canvases_source_check CHECK (source IN ('composed','edited','template'))"
    )
  }
}
