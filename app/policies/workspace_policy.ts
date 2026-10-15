import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Workspace from '#models/workspace'
import AccessService from '#services/workspaces/access_service'
export default class WorkspacePolicy extends BasePolicy {
  view(user: User, workspace: Workspace) {
    return new AccessService().active(user.id, workspace.id)
  }
  update(user: User, workspace: Workspace) {
    return new AccessService().owner(user.id, workspace)
  }
  invite(user: User, workspace: Workspace) {
    return this.update(user, workspace)
  }
  removeMember(user: User, workspace: Workspace) {
    return this.update(user, workspace)
  }
}
