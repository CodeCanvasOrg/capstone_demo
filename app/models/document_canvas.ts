import { DocumentCanvasSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { CanvasDocument } from '../../shared/canvas/model.ts'
import DocumentVersion from './document_version.ts'

export type CanvasSource = 'composed' | 'edited' | 'template'

/** The canvas of one saved version. Rows are never updated. */
export default class DocumentCanvas extends DocumentCanvasSchema {
  @column({ prepare: (value: unknown) => JSON.stringify(value) })
  declare project: CanvasDocument

  declare source: CanvasSource

  @belongsTo(() => DocumentVersion, { foreignKey: 'versionId' })
  declare version: BelongsTo<typeof DocumentVersion>
}
