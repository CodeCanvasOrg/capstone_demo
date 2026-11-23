import { CanvasGenerationPageSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'

const json = (value: unknown) => (value === null ? null : JSON.stringify(value))

/** One page of a canvas generation run, with the evidence retrieved and cited for it. */
export default class CanvasGenerationPage extends CanvasGenerationPageSchema {
  declare status: 'pending' | 'written' | 'fitted' | 'failed'

  @column({ prepare: json })
  declare queries: string[]

  declare chunkIds: string[]
  declare citedChunkIds: string[]
  declare imageIds: string[]

  @column({ prepare: json })
  declare content: unknown

  @column({ prepare: json })
  declare notes: string[]
}
