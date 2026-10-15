import { BaseTransformer } from '@adonisjs/core/transformers'
import type DocumentApproval from '#models/document_approval'
export default class DocumentApprovalTransformer extends BaseTransformer<DocumentApproval> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'reviewId',
      'versionId',
      'approvedById',
      'warningAcknowledgments',
      'createdAt',
      'invalidatedAt',
      'invalidationReason',
    ])
  }
}
