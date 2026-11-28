import { column } from '@adonisjs/lucid/orm'
import { DocumentImageSchema } from '#database/schema'

export type GenerationRecord = {
  model: string
  prompt: string
  costUsd: number | null
  latencyMs: number
  /** Size the model returned, before it was fitted to the print size. */
  sourceWidth: number
  sourceHeight: number
  referenceCount: number
  at: string
}

export default class DocumentImage extends DocumentImageSchema {
  @column({ serializeAs: null }) declare objectKey: string

  declare origin: 'upload' | 'source' | 'generated'

  /** What made a generated picture, for audit; null for any other origin. */
  declare generation: GenerationRecord | null
}
