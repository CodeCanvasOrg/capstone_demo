import type { HttpContext } from '@adonisjs/core/http'
import InvitationService from '#services/workspaces/invitation_service'
import WorkspacePolicy from '#policies/workspace_policy'
import { invitationValidator } from '#validators/workspace_invitation'
export default class WorkspaceInvitationsController {
  async store({ workspace, workspaceAccess, bouncer, request, response }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('invite', workspace!)
    const { email } = await request.validateUsing(invitationValidator)
    await new InvitationService().manage(workspaceAccess!, email)
    return response.redirect().back()
  }
  async resend({ workspace, workspaceAccess, bouncer, params, response }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('invite', workspace!)
    await new InvitationService().manage(workspaceAccess!, '', params.invitationId)
    return response.redirect().back()
  }
  async destroy({ workspace, workspaceAccess, bouncer, params, response }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('invite', workspace!)
    await new InvitationService().manage(workspaceAccess!, '', params.invitationId, true)
    return response.redirect().back()
  }
}
