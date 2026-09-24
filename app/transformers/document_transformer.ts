import { BaseTransformer } from '@adonisjs/core/transformers'
import type Document from '#models/document'
import DocumentVersionTransformer from './document_version_transformer.ts'
import DocumentShareTransformer from './document_share_transformer.ts'
import UserTransformer from './user_transformer.ts'

export default class DocumentTransformer extends BaseTransformer<Document> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'title',
        'description',
        'status',
        'createdAt',
        'updatedAt',
      ]),
      user: UserTransformer.transform(this.whenLoaded(this.resource.user)),
      documentShares:
        'documentShares' in this.resource.$preloaded
          ? DocumentShareTransformer.transform(this.resource.documentShares)
          : undefined,
      documentVersions:
        'documentVersions' in this.resource.$preloaded
          ? DocumentVersionTransformer.transform(this.resource.documentVersions)
          : undefined,
    }
  }
}
