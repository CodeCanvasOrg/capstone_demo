import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store({ request, auth, response, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email.trim().toLowerCase(), password)

    await auth.use('web').login(user)
    const intended = session.get('invitationReturnTo')
    if (typeof intended === 'string' && /^\/invitations\/[a-f0-9]{64}$/i.test(intended))
      return response.redirect().toPath(intended)
    return response.redirect().toRoute('home')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    response.redirect().toRoute('session.create')
  }
}
