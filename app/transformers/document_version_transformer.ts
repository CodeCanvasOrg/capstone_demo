import { BaseTransformer } from '@adonisjs/core/transformers'
import type DocumentVersion from '#models/document_version'
import UserTransformer from './user_transformer.ts'

export default class DocumentVersionTransformer extends BaseTransformer<DocumentVersion> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'version', 'content', 'createdAt', 'updatedAt']),
      user: UserTransformer.transform(this.whenLoaded(this.resource.user)),
    }
  }
}
