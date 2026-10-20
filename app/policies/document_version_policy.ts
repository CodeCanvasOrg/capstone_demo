import { BasePolicy } from '@adonisjs/bouncer'
import DocumentPolicy from '#policies/document_policy'
import type User from '#models/user'
import type Document from '#models/document'
export default class DocumentVersionPolicy extends BasePolicy {
  create(user: User, document: Document) {
    return new DocumentPolicy().update(user, document)
  }
}
