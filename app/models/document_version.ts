import { DocumentVersionSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.ts'
import Document from './document.ts'

export default class DocumentVersion extends DocumentVersionSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: number | null

  @column()
  declare documentId: string

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>
}
