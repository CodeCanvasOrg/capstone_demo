import { Exception } from '@adonisjs/core/exceptions'
import encryption from '@adonisjs/core/services/encryption'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import UserCredential from '#models/user_credential'
import {
  findProvider,
  preferencesPatchSchema,
  resolvePreferences,
  secretHint,
  type CredentialView,
  type Preferences,
  type SettingsPayload,
} from '../../../shared/settings.ts'

/** A 422 shaped like a VineJS failure so the client can show it beside the field. */
const invalid = (message: string, field: string) =>
  Object.assign(new Exception(message, { status: 422, code: 'E_VALIDATION_ERROR' }), {
    messages: [{ field, message }],
  })

export default class UserSettingsService {
  async load(user: User): Promise<SettingsPayload> {
    const credentials = await UserCredential.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'asc')
    return {
      profile: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        createdAt: user.createdAt.toISO()!,
      },
      preferences: resolvePreferences(user.preferences),
      credentials: credentials.map((c) => this.view(c)),
    }
  }

  async updateProfile(user: User, input: { fullName: string | null; email: string }) {
    if (input.email !== user.email) {
      const taken = await User.query().where('email', input.email).whereNot('id', user.id).first()
      if (taken) throw invalid('That address is already used by another account.', 'email')
    }
    user.merge({ fullName: input.fullName || null, email: input.email })
    await user.save()
    return user
  }

  async updatePreferences(user: User, patch: unknown): Promise<Preferences> {
    const parsed = preferencesPatchSchema.safeParse(patch)
    if (!parsed.success) throw invalid('One of the preferences is not valid.', 'preferences')
    const current = resolvePreferences(user.preferences) as Record<string, Record<string, unknown>>
    for (const [section, values] of Object.entries(parsed.data)) {
      if (values) Object.assign(current[section], values)
    }
    const next = resolvePreferences(current)
    user.preferences = next
    await user.save()
    return next
  }

  async changePassword(user: User, currentPassword: string, password: string) {
    if (!(await hash.verify(user.password, currentPassword)))
      throw invalid('Your current password is incorrect.', 'currentPassword')
    user.password = password
    await user.save()
  }

  async saveCredential(
    user: User,
    kind: string,
    provider: string,
    input: { secret: string; label?: string | null }
  ) {
    const definition = findProvider(kind, provider)
    if (!definition) throw new Exception('Unknown provider', { status: 404 })
    if (!definition.pattern.test(input.secret))
      throw invalid("This doesn't look like a valid key for this provider.", 'secret')
    const credential = await UserCredential.updateOrCreate(
      { userId: user.id, kind, provider },
      {
        label: input.label || null,
        encryptedSecret: encryption.encrypt(input.secret),
        hint: secretHint(input.secret),
      }
    )
    return this.view(credential)
  }

  async removeCredential(user: User, kind: string, provider: string) {
    await UserCredential.query().where({ userId: user.id, kind, provider }).delete()
  }

  /** Decrypted secret for server-side use only (never sent to the client). */
  async secretFor(userId: number, kind: string, provider: string) {
    const credential = await UserCredential.query().where({ userId, kind, provider }).first()
    if (!credential) return null
    return encryption.decrypt<string>(credential.encryptedSecret)
  }

  private view(c: UserCredential): CredentialView {
    return {
      id: c.id,
      kind: c.kind as CredentialView['kind'],
      provider: c.provider,
      label: c.label,
      hint: c.hint,
      lastUsedAt: c.lastUsedAt?.toISO() ?? null,
      createdAt: c.createdAt.toISO()!,
      updatedAt: c.updatedAt.toISO()!,
    }
  }
}
