import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import File from './file.ts'
import ProcessingRun from './processing_run.ts'

export default class FileRevision extends BaseModel {
  static table = 'file_revisions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare fileId: string

  @column()
  declare revision: number

  @column()
  declare sourceHash: string | null

  @column()
  declare sourceUrl: string | null

  @column()
  declare mime: string | null

  @column()
  declare byteSize: number | null

  @column.dateTime()
  declare retrievedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => File)
  declare file: BelongsTo<typeof File>

  @hasMany(() => ProcessingRun, { foreignKey: 'fileRevisionId' })
  declare processingRuns: HasMany<typeof ProcessingRun>
}
