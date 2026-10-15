import type { HttpContext } from '@adonisjs/core/http'
import InvitationService from '#services/workspaces/invitation_service'
import Workspace from '#models/workspace'
export default class InvitationAcceptancesController {
  async show({ params, auth, session, inertia, response }: HttpContext) {
    const invitation = await new InvitationService().find(params.token)
    const workspace = await Workspace.findOrFail(invitation.workspaceId)
    response.header('Referrer-Policy', 'no-referrer').header('Cache-Control', 'private, no-store')
    if (!auth.user) session.put('invitationReturnTo', `/invitations/${params.token}`)
    return inertia.render('invitations/show', {
      invitation: {
        token: params.token,
        workspaceName: workspace.name,
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISO()!,
        accepted: !!invitation.acceptedAt,
      },
      addressedAccount: auth.user?.email.toLowerCase() === invitation.email,
    })
  }
  async store({ params, auth, response, session }: HttpContext) {
    const workspace = await new InvitationService().accept(auth.user!, params.token)
    session.forget('invitationReturnTo')
    return response.redirect().toRoute('workspaces.show', { workspaceId: workspace.id })
  }
}
