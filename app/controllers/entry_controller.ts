import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
export default class EntryController {
  async handle({ auth, response }: HttpContext) {
    if (!auth.user) return response.redirect().toRoute('session.create')
    const workspaceId = await new AccessService().destination(auth.user)
    return workspaceId
      ? response.redirect().toRoute('workspaces.show', { workspaceId })
      : response.redirect().toRoute('workspaces.index')
  }
}
