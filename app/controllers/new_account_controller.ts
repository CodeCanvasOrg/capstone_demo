import WorkspaceService from '#services/workspaces/workspace_service'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth, session }: HttpContext) {
    const { passwordConfirmation, ...payload } = await request.validateUsing(signupValidator)
    const user = await new WorkspaceService().register(payload)

    await auth.use('web').login(user)
    const intended = session.get('invitationReturnTo')
    if (typeof intended === 'string' && /^\/invitations\/[a-f0-9]{64}$/i.test(intended))
      return response.redirect().toPath(intended)
    return response.redirect().toRoute('home')
  }
}
