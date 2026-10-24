import { column } from '@adonisjs/lucid/orm'
import { DocumentImageSchema } from '#database/schema'

export default class DocumentImage extends DocumentImageSchema {
  @column({ serializeAs: null }) declare objectKey: string
}
