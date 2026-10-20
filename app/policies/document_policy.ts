import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Document from '#models/document'
import AccessService from '#services/workspaces/access_service'
export default class DocumentPolicy extends BasePolicy {
  edit(user: User, document: Document) {
    return new AccessService().active(user.id, document.workspaceId)
  }
  update(user: User, document: Document) {
    return this.edit(user, document)
  }
  create(user: User, workspaceId: string) {
    return new AccessService().active(user.id, workspaceId)
  }
  async delete(user: User, document: Document) {
    return document.userId === user.id && this.edit(user, document)
  }
  async approve(user: User, document: Document) {
    return document.userId === user.id && this.edit(user, document)
  }
}
