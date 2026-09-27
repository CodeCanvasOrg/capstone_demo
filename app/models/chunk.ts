import { ChunkSchema } from '#database/schema'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import File from './file.ts'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Chunk extends ChunkSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare fileId: string

  @column()
  declare chunkIndex: number | null

  @column()
  declare content: string | null

  @column()
  declare fileKey: string | null

  @column()
  declare embedding: string

  getEmbedding(): number[] {
    if (!this.embedding) return []

    return this.embedding
      .replace(/[\[\]]/g, '')
      .split(',')
      .map(Number)
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => File)
  declare file: BelongsTo<typeof File>
}
