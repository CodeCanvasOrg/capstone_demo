import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Caption, alt text, focal point and a perceptual hash for each document image,
 * and the resized copies (thumb, screen, print) the editor and exports choose from.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('document_images', (table) => {
      table.string('caption', 400).nullable()
      table.string('alt_text', 300).nullable()
      table.smallint('focus_x').nullable()
      table.smallint('focus_y').nullable()
      table.specificType('phash', 'char(16)').nullable()
      table.uuid('source_chunk_id').nullable().references('chunks.id').onDelete('SET NULL')
      table.string('origin', 16).notNullable().defaultTo('upload')
    })
    this.schema.raw(
      "ALTER TABLE document_images ADD CONSTRAINT document_images_origin_check CHECK (origin IN ('upload','source'))"
    )
    this.schema.raw(
      'ALTER TABLE document_images ADD CONSTRAINT document_images_focus_check CHECK ((focus_x IS NULL AND focus_y IS NULL) OR (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100))'
    )
    this.schema.createTable('document_image_variants', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('image_id').notNullable().references('document_images.id').onDelete('CASCADE')
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.string('purpose', 8).notNullable()
      table.string('format', 8).notNullable()
      table.integer('width').notNullable()
      table.integer('height').notNullable()
      table.integer('bytes').notNullable()
      table.string('key', 255).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['image_id', 'purpose'])
      table.index(['workspace_id'])
    })
    this.schema.raw(
      "ALTER TABLE document_image_variants ADD CONSTRAINT document_image_variants_purpose_check CHECK (purpose IN ('thumb','screen','print'))"
    )
    this.schema.raw(
      "ALTER TABLE document_image_variants ADD CONSTRAINT document_image_variants_format_check CHECK (format IN ('webp','jpeg','png'))"
    )
  }

  async down() {
    this.schema.dropTable('document_image_variants')
    this.schema.alterTable('document_images', (table) => {
      table.dropChecks(['document_images_origin_check', 'document_images_focus_check'])
      table.dropColumns(
        'caption',
        'alt_text',
        'focus_x',
        'focus_y',
        'phash',
        'source_chunk_id',
        'origin'
      )
    })
  }
}
