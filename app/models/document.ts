import { DocumentSchema } from '#database/schema'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import DocumentVersion from './document_version.ts'
import DocumentShare from './document_share.ts'
import File from './file.ts'
import { DateTime } from 'luxon'

export default class Document extends DocumentSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare status: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => DocumentVersion)
  declare documentVersions: HasMany<typeof DocumentVersion>

  @hasMany(() => DocumentShare)
  declare documentShares: HasMany<typeof DocumentShare>

  @hasMany(() => File)
  declare files: HasMany<typeof File>
}
