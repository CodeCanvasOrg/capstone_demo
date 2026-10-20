import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'
import type Workspace from '#models/workspace'
import type WorkspaceMembership from '#models/workspace_membership'
export default class ResolveWorkspaceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const resolved = await new AccessService().resolve(ctx.auth.user!.id, ctx.params.workspaceId)
    ctx.workspaceAccess = resolved.context
    ctx.workspace = resolved.workspace
    ctx.workspaceMembership = resolved.membership
    return next()
  }
}
declare module '@adonisjs/core/http' {
  interface HttpContext {
    workspaceAccess?: WorkspaceAccessContext
    workspace?: Workspace
    workspaceMembership?: WorkspaceMembership
  }
}
