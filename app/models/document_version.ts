import { DocumentVersionSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.ts'
import Document from './document.ts'
import { DateTime } from 'luxon'

export default class DocumentVersion extends DocumentVersionSchema {
  @column({ prepare: (value: unknown) => JSON.stringify(value) }) declare sourceManifest:
    import('#services/documents/canonical_content_service').Manifest | null
  @column() declare canonicalContent:
    import('../../shared/templates/content.ts').CanonicalContent | null
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: number | null

  @column()
  declare documentId: string

  @column()
  declare version: number | null

  @column()
  declare content: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>
}
