import type User from '#models/user'
import type DocumentShare from '#models/document_share'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import type Document from '#models/document'

export default class DocumentSharePolicy extends BasePolicy {
  store(user: User, document: Document): AuthorizerResponse {
    return user.id === document.userId
  }

  update(user: User, documentShare: DocumentShare): AuthorizerResponse {
    return user.id === documentShare.document.userId
  }

  delete(user: User, documentShare: DocumentShare): AuthorizerResponse {
    return user.id === documentShare.document.userId
  }
}
