import type { HttpContext } from '@adonisjs/core/http'
import WorkspacePolicy from '#policies/workspace_policy'
import WorkspaceMembershipTransformer from '#transformers/workspace_membership_transformer'
import MembershipService from '#services/workspaces/membership_service'
export default class WorkspaceMembersController {
  async index({ workspace, bouncer, inertia }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('view', workspace!)
    const members = await workspace!
      .related('memberships')
      .query()
      .whereNull('revokedAt')
      .preload('user')
      .orderBy('joinedAt', 'asc')
    return inertia.render('workspaces/members', {
      members: WorkspaceMembershipTransformer.transform(members),
    })
  }
  async destroy({ workspace, workspaceAccess, params, bouncer, response }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('removeMember', workspace!)
    await new MembershipService().revoke(workspaceAccess!, params.membershipId)
    return response.redirect().toRoute('workspace_members.index', { workspaceId: workspace!.id })
  }
}
