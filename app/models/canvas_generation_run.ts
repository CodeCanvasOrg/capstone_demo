import { CanvasGenerationRunSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'

export type CanvasRunStatus =
  | 'queued'
  | 'planning'
  | 'retrieving'
  | 'writing'
  | 'fitting'
  | 'images'
  | 'composing'
  | 'ready'
  | 'failed'

export const ACTIVE_RUN_STATUSES: CanvasRunStatus[] = [
  'queued',
  'planning',
  'retrieving',
  'writing',
  'fitting',
  'images',
  'composing',
]

export type CanvasRunMetrics = {
  pages: number
  words: number
  avgFill: number
  citations: number
  placeholders: number
  lowDpiImages: number
  durationMs: number
  tokens: number
}

/** One canvas generation (the academic pipeline): options, plan and quality metrics. */
export default class CanvasGenerationRun extends CanvasGenerationRunSchema {
  declare status: CanvasRunStatus

  @column({ prepare: (value: unknown) => (value === null ? null : JSON.stringify(value)) })
  declare plan: unknown

  @column({ prepare: (value: unknown) => (value === null ? null : JSON.stringify(value)) })
  declare metrics: CanvasRunMetrics | null

  get active() {
    return ACTIVE_RUN_STATUSES.includes(this.status)
  }
}
