import { BaseTransformer } from '@adonisjs/core/transformers'
import type Chunk from '#models/chunk'

export default class ChunkTransformer extends BaseTransformer<Chunk> {
  toObject() {
    return this.pick(this.resource, ['id', 'fileKey', 'chunkIndex', 'content', 'embedding'])
  }
}
