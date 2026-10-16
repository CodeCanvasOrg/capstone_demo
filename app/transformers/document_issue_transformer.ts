import { BaseTransformer } from '@adonisjs/core/transformers'
import type DocumentIssue from '#models/document_issue'
export default class DocumentIssueTransformer extends BaseTransformer<DocumentIssue> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'title',
      'description',
      'descriptionContent',
      'blocking',
      'state',
      'revision',
      'createdById',
      'updatedById',
      'resolvedById',
      'resolvedAt',
      'createdAt',
      'updatedAt',
    ])
  }
}
