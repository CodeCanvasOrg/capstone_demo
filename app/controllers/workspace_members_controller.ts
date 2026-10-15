import WorkspaceInvitation from '#models/workspace_invitation'
import WorkspaceInvitationTransformer from '#transformers/workspace_invitation_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import WorkspacePolicy from '#policies/workspace_policy'
import WorkspaceMembershipTransformer from '#transformers/workspace_membership_transformer'
import MembershipService from '#services/workspaces/membership_service'
export default class WorkspaceMembersController {
  async index({ workspace, workspaceAccess, bouncer, inertia }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('view', workspace!)
    const members = await workspace!
      .related('memberships')
      .query()
      .whereNull('revokedAt')
      .preload('user')
      .orderBy('joinedAt', 'asc')
    const invitations =
      workspace!.ownerUserId === workspaceAccess!.actorId
        ? await WorkspaceInvitation.query()
            .where('workspaceId', workspace!.id)
            .orderBy('createdAt', 'desc')
            .limit(100)
        : []
    return inertia.render('workspaces/members', {
      invitations: WorkspaceInvitationTransformer.transform(invitations),
      members: WorkspaceMembershipTransformer.transform(members),
    })
  }
  async destroy({ workspace, workspaceAccess, params, bouncer, response }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('removeMember', workspace!)
    await new MembershipService().revoke(workspaceAccess!, params.membershipId)
    return response.redirect().toRoute('workspace_members.index', { workspaceId: workspace!.id })
  }
}
