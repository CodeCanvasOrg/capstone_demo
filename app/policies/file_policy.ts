import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type File from '#models/file'
import AccessService from '#services/workspaces/access_service'
export default class FilePolicy extends BasePolicy {
  view(user: User, file: File) {
    return new AccessService().active(user.id, file.workspaceId)
  }
  create(user: User, workspaceId: string) {
    return new AccessService().active(user.id, workspaceId)
  }
  async update(user: User, file: File) {
    return user.id === file.userId && this.view(user, file)
  }
  async delete(user: User, file: File) {
    return this.update(user, file)
  }
  async manageProjects(user: User, file: File) {
    return this.update(user, file)
  }
}
