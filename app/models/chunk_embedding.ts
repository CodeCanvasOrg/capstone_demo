import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class ChunkEmbedding extends BaseModel {
  static table = 'chunk_embeddings'
  static primaryKey = 'id'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare chunkId: string

  @column()
  declare model: string

  @column()
  declare version: string

  @column()
  declare dimensions: number

  @column()
  declare embedding: string

  @column()
  declare inputHash: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
