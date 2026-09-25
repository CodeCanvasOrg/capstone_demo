import type User from '#models/user'
import type Document from '#models/document'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class DocumentPolicy extends BasePolicy {
  async edit(user: User, document: Document): Promise<AuthorizerResponse> {
    return user.id === document.userId || (await this.canView(user, document))
  }

  async update(user: User, document: Document): Promise<AuthorizerResponse> {
    return user.id === document.userId || (await this.canEdit(user, document))
  }

  delete(user: User, document: Document): AuthorizerResponse {
    return user.id === document.userId
  }

  private async canView(user: User, document: Document) {
    const role = await document.related('documentShares').query().where('userId', user.id).first()

    return role !== null
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
