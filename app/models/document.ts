import { DocumentSchema } from '#database/schema'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import DocumentVersion from './document_version.ts'
import DocumentShare from './document_share.ts'

export default class Document extends DocumentSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare user_id: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => DocumentVersion)
  declare documentVersions: HasMany<typeof DocumentVersion>

  @hasMany(() => DocumentShare)
  declare documentShares: HasMany<typeof DocumentShare>
}
