import { DocumentShareSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import User from './user.ts'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Document from './document.ts'
import { DateTime } from 'luxon'

export default class DocumentShare extends DocumentShareSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: number

  @column()
  declare documentId: string

  @column()
  declare role: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>
}
