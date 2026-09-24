import { BaseTransformer } from '@adonisjs/core/transformers'
import type DocumentShare from '#models/document_share'
import UserTransformer from './user_transformer.ts'

export default class DocumentShareTransformer extends BaseTransformer<DocumentShare> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'role']),
      user: UserTransformer.transform(this.whenLoaded(this.resource.user)),
    }
  }
}
