import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import DocumentBlock from './document_block.ts'
import FileRevision from './file_revision.ts'

export default class ProcessingRun extends BaseModel {
  static table = 'processing_runs'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare fileRevisionId: string

  @column()
  declare pipelineVersion: string

  @column()
  declare status: 'queued' | 'processing' | 'ready' | 'failed'

  @column()
  declare stageTimings: Record<string, number>

  @column()
  declare warnings: string[]

  @column()
  declare embeddingModel: string | null

  @column()
  declare embeddingDimensions: number | null

  @column()
  declare error: string | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare leaseAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => FileRevision, { foreignKey: 'fileRevisionId' })
  declare revision: BelongsTo<typeof FileRevision>

  @hasMany(() => DocumentBlock, { foreignKey: 'processingRunId' })
  declare blocks: HasMany<typeof DocumentBlock>
}
