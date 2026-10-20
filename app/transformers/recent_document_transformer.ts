import { BaseTransformer } from '@adonisjs/core/transformers'
import type Document from '#models/document'
export default class RecentDocumentTransformer extends BaseTransformer<Document> {
  toObject() {
    return this.pick(this.resource, ['id', 'title', 'status', 'updatedAt'])
  }
}
