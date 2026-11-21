import { DocumentCanvasDraftSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { CanvasDocument } from '../../shared/canvas/model.ts'

/** Autosaved canvas of a document, ahead of its current version. */
export default class DocumentCanvasDraft extends DocumentCanvasDraftSchema {
  // The document id is the key and is assigned by the caller, not generated.
  static selfAssignPrimaryKey = true

  @column({ prepare: (value: unknown) => JSON.stringify(value) })
  declare project: CanvasDocument
}
