import { FileSchema } from '#database/schema'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import Document from './document.ts'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Chunk from './chunk.ts'

export default class File extends FileSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare documentId: string

  @column()
  declare filename: string | null

  @column()
  declare filetype: string | null

  @column()
  declare objectKey: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>

  @hasMany(() => Chunk)
  declare chunks: HasMany<typeof Chunk>
}
