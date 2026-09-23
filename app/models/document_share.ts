import { DocumentShareSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import User from './user.ts'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Document from './document.ts'

export default class DocumentShare extends DocumentShareSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: number

  @column()
  declare documentId: string

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>
}
