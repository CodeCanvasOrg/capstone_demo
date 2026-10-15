import WorkspaceService from '#services/workspaces/workspace_service'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth }: HttpContext) {
    const { passwordConfirmation, ...payload } = await request.validateUsing(signupValidator)
    const user = await new WorkspaceService().register(payload)

    await auth.use('web').login(user)
    response.redirect().toRoute('home')
  }
}
