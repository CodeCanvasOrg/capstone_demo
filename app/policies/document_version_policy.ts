import type User from '#models/user'
import type Document from '#models/document'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class DocumentVersionPolicy extends BasePolicy {
  async create(user: User, document: Document): Promise<AuthorizerResponse> {
    return user.id === document.userId || (await this.canEdit(user, document))
  }

  private async canEdit(user: User, document: Document) {
    const role = await document
      .related('documentShares')
      .query()
      .where('userId', user.id)
      .where('role', 'edit')
      .first()

    return role !== null
  }
}
