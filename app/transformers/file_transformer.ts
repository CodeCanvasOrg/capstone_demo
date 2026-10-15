import { BaseTransformer } from '@adonisjs/core/transformers'
import type File from '#models/file'
import ChunkTransformer from './chunk_transformer.ts'
import DocumentTransformer from './document_transformer.ts'

export default class FileTransformer extends BaseTransformer<File> {
  constructor(
    resource: File,
    private actorId?: number
  ) {
    super(resource)
  }
  toObject() {
    const revisionsAreLoaded = 'revisions' in this.resource.$preloaded
    const latestRevision = revisionsAreLoaded ? this.resource.revisions[0] : undefined
    const runsAreLoaded = !!latestRevision && 'processingRuns' in latestRevision.$preloaded
    const latestRun = runsAreLoaded ? latestRevision.processingRuns[0] : undefined
    const processingStatus = latestRun?.status === 'queued' ? 'uploaded' : latestRun?.status

    return {
      ...this.pick(this.resource, [
        'id',
        'filename',
        'filetype',
        'workspaceId',
        'userId',
        'createdAt',
      ]),
      downloadUrl: this.resource.workspaceId
        ? `/workspaces/${this.resource.workspaceId}/files/${this.resource.id}/download`
        : null,
      capabilities: {
        rename: this.actorId === this.resource.userId,
        delete: this.actorId === this.resource.userId,
      },
      processingStatus: revisionsAreLoaded ? (processingStatus ?? 'uploaded') : undefined,
      processingError: latestRun?.error ?? null,
      processingWarnings: latestRun?.warnings ?? [],
      chunks:
        'chunks' in this.resource.$preloaded
          ? ChunkTransformer.transform(this.resource.chunks)
          : undefined,
      documents:
        'documents' in this.resource.$preloaded
          ? DocumentTransformer.transform(this.resource.documents, this.actorId)
          : undefined,
    }
  }
}
