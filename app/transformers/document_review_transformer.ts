import { BaseTransformer } from '@adonisjs/core/transformers'
import type DocumentReview from '#models/document_review'
export default class DocumentReviewTransformer extends BaseTransformer<DocumentReview> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'versionId',
      'submittedById',
      'createdAt',
      'invalidatedAt',
      'invalidationReason',
    ])
  }
}
