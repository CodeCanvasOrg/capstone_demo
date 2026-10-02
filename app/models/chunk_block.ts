import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class ChunkBlock extends BaseModel {
  static table = 'chunk_blocks'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare chunkId: string

  @column()
  declare documentBlockId: string

  @column()
  declare rowStart: number | null

  @column()
  declare rowEnd: number | null

  @column()
  declare charStart: number | null

  @column()
  declare charEnd: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
