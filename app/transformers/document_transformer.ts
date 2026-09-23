import { BaseTransformer } from '@adonisjs/core/transformers'
import type Document from '#models/document'

export default class DocumentTransformer extends BaseTransformer<Document> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'user_id',
      'title',
      'description',
      'status',
      'createdAt',
      'updatedAt',
    ])
  }
}
