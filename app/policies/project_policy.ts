import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Project from '#models/project'
import AccessService from '#services/workspaces/access_service'
export default class ProjectPolicy extends BasePolicy {
  view(user: User, project: Project) {
    return new AccessService().active(user.id, project.workspaceId)
  }
  create(user: User, workspaceId: string) {
    return new AccessService().active(user.id, workspaceId)
  }
  update(user: User, project: Project) {
    return this.view(user, project)
  }
}
