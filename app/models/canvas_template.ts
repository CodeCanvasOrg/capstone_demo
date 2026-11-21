import { CanvasTemplateSchema } from '#database/schema'
import { column, scope } from '@adonisjs/lucid/orm'
import type { CanvasDocument } from '../../shared/canvas/model.ts'

export type CanvasTemplateKind = 'sheet' | 'document'

/** A reusable canvas: one sheet or a whole document. No workspace means a system template. */
export default class CanvasTemplate extends CanvasTemplateSchema {
  @column({ prepare: (value: unknown) => JSON.stringify(value) })
  declare project: CanvasDocument

  declare kind: CanvasTemplateKind

  get isSystem() {
    return this.workspaceId === null
  }

  /** System templates plus the workspace's own. */
  static visibleTo = scope((query, workspaceId: string) => {
    query.where((q) => q.whereNull('workspace_id').orWhere('workspace_id', workspaceId))
  })
}
