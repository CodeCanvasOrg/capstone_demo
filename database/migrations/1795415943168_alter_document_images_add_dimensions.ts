import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pixel size of each uploaded image, read from its header at upload. The canvas
 * uses it to place an image box at the picture's own proportions and to fit a
 * box to its image. Null for images uploaded before this column existed until
 * `node ace images:measure` fills them in.
 */
export default class extends BaseSchema {
  protected tableName = 'document_images'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('width').nullable()
      table.integer('height').nullable()
    })
    this.schema.raw(
      'ALTER TABLE document_images ADD CONSTRAINT document_images_dimensions_check CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND height > 0))'
    )
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['document_images_dimensions_check'])
      table.dropColumn('width')
      table.dropColumn('height')
    })
  }
}
