import type { HttpContext } from '@adonisjs/core/http'
import UserSettingsService from '#services/settings/user_settings_service'
import { credentialValidator, passwordValidator, profileValidator } from '#validators/settings'

export default class SettingsController {
  async show({ auth, response }: HttpContext) {
    return response.ok({ data: await new UserSettingsService().load(auth.user!) })
  }

  async profile({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(profileValidator)
    const user = await new UserSettingsService().updateProfile(auth.user!, input)
    return response.ok({ data: { fullName: user.fullName, email: user.email } })
  }

  async preferences({ auth, request, response }: HttpContext) {
    const preferences = await new UserSettingsService().updatePreferences(
      auth.user!,
      request.body()
    )
    return response.ok({ data: preferences })
  }

  async password({ auth, request, response }: HttpContext) {
    const { currentPassword, password } = await request.validateUsing(passwordValidator)
    await new UserSettingsService().changePassword(auth.user!, currentPassword, password)
    return response.ok({ data: { updated: true } })
  }

  async storeCredential({ auth, params, request, response }: HttpContext) {
    const input = await request.validateUsing(credentialValidator)
    const credential = await new UserSettingsService().saveCredential(
      auth.user!,
      params.kind,
      params.provider,
      input
    )
    return response.ok({ data: credential })
  }

  async destroyCredential({ auth, params, response }: HttpContext) {
    await new UserSettingsService().removeCredential(auth.user!, params.kind, params.provider)
    return response.ok({ data: { deleted: true } })
  }
}
