import { BaseTransformer } from '@adonisjs/core/transformers'
import type File from '#models/file'
import ChunkTransformer from './chunk_transformer.ts'

export default class FileTransformer extends BaseTransformer<File> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'filename', 'filetype', 'objectUrl', 'objectKey']),
      chunks:
        'chunks' in this.resource.$preloaded
          ? ChunkTransformer.transform(this.resource.chunks)
          : undefined,
    }
  }
}
