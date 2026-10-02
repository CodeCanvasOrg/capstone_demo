import { DocumentSchema } from '#database/schema'
import { belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
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

  @column()
  declare generationStatus: 'uploaded' | 'processing' | 'generating' | 'ready' | 'failed'

  @column()
  declare generationError: string | null

  @column.dateTime()
  declare generationLeaseAt: DateTime | null

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

  @manyToMany(() => File, {
    pivotTable: 'document_files',
    pivotForeignKey: 'document_id',
    pivotRelatedForeignKey: 'files_id',
    pivotTimestamps: true,
  })
  declare files: ManyToMany<typeof File>
}
