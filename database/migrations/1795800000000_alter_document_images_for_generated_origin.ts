import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pictures made by an image model (docs/image-generation-research.md) are a third origin, next to
 * `upload` and `source`. `generation` records what made one: model, prompt, cost and time, for
 * audit. It is null for every picture that was not generated.
 */
export default class extends BaseSchema {
  protected tableName = 'document_images'

  async up() {
    this.schema.raw('ALTER TABLE document_images DROP CONSTRAINT document_images_origin_check')
    this.schema.raw(
      "ALTER TABLE document_images ADD CONSTRAINT document_images_origin_check CHECK (origin IN ('upload','source','generated'))"
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('generation').nullable()
    })
    this.schema.raw(
      "ALTER TABLE document_images ADD CONSTRAINT document_images_generation_check CHECK ((origin = 'generated') = (generation IS NOT NULL))"
    )
  }

  async down() {
    this.schema.raw('ALTER TABLE document_images DROP CONSTRAINT document_images_generation_check')
    this.schema.raw("DELETE FROM document_images WHERE origin = 'generated'")
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('generation')
    })
    this.schema.raw('ALTER TABLE document_images DROP CONSTRAINT document_images_origin_check')
    this.schema.raw(
      "ALTER TABLE document_images ADD CONSTRAINT document_images_origin_check CHECK (origin IN ('upload','source'))"
    )
  }
}
