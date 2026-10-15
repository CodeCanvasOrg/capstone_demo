import { BaseTransformer } from '@adonisjs/core/transformers'
import type Document from '#models/document'
import DocumentVersionTransformer from './document_version_transformer.ts'
import DocumentShareTransformer from './document_share_transformer.ts'
import UserTransformer from './user_transformer.ts'
import FileTransformer from './file_transformer.ts'

export default class DocumentTransformer extends BaseTransformer<Document> {
  constructor(
    resource: Document,
    private actorId?: number
  ) {
    super(resource)
  }
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'workspaceId',
        'userId',
        'projectId',
        'projectInformation',
        'dueDate',
        'sourceMode',
        'currentVersionId',
        'activeReviewId',
        'activeApprovalId',
        'generationTaskId',
        'metadataRevision',
        'selectionRevision',
        'legacyApprovalUnverified',
        'title',
        'description',
        'status',
        'generationStatus',
        'createdAt',
        'updatedAt',
      ]),
      generationError: this.resource.generationError
        ? 'Generation could not finish. Start a new request.'
        : null,
      capabilities: {
        edit: this.actorId !== undefined,
        delete: this.actorId === this.resource.userId,
        approve: this.actorId === this.resource.userId,
      },
      user: UserTransformer.transform(this.whenLoaded(this.resource.user)),
      documentShares:
        'documentShares' in this.resource.$preloaded
          ? DocumentShareTransformer.transform(this.resource.documentShares)
          : undefined,
      documentVersions:
        'documentVersions' in this.resource.$preloaded
          ? DocumentVersionTransformer.transform(this.resource.documentVersions)
          : undefined,
      files:
        'files' in this.resource.$preloaded
          ? FileTransformer.transform(this.resource.files, this.actorId)
          : undefined,
    }
  }
}
