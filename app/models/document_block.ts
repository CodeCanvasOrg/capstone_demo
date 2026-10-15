import { DocumentBlockSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import ProcessingRun from './processing_run.ts'
import type { CanonicalBlock, SourceLocator } from '#services/documents/rag_types'

export default class DocumentBlock extends DocumentBlockSchema {
  static table = 'document_blocks'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare processingRunId: string

  @column()
  declare blockType: CanonicalBlock['blockType']

  @column()
  declare text: string

  @column()
  declare rawReference: string | null

  @column()
  declare orderIndex: number

  @column({ prepare: (value: string[]) => JSON.stringify(value) })
  declare sectionPath: string[]

  @column()
  declare sourceLocator: SourceLocator

  @column()
  declare extractionMethod: string

  @column()
  declare confidence: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProcessingRun, { foreignKey: 'processingRunId' })
  declare run: BelongsTo<typeof ProcessingRun>
}
