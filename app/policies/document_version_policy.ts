import type User from '#models/user'
import type Document from '#models/document'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class DocumentVersionPolicy extends BasePolicy {
  create(user: User, document: Document): AuthorizerResponse {
    return user.id === document.userId
  }
}
