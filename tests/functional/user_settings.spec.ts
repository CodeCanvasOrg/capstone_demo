import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import WorkspaceService from '#services/workspaces/workspace_service'
import { reset } from '../helpers/workspaces.ts'
import { DEFAULT_PREFERENCES } from '../../shared/settings.ts'

const register = (email = 'settings@example.test') =>
  new WorkspaceService().register({ email, password: 'test-password-123' })

test.group('User settings', (group) => {
  group.each.setup(reset)

  test('settings require authentication', async ({ client }) => {
    const response = await client.get('/settings').header('Accept', 'application/json')
    response.assertStatus(401)
  })

  test('returns profile, default preferences and no credentials', async ({ client, assert }) => {
    const user = await register()
    const response = await client.get('/settings').loginAs(user)
    response.assertStatus(200)
    const { data } = response.body()
    assert.equal(data.profile.email, 'settings@example.test')
    assert.deepEqual(data.preferences, DEFAULT_PREFERENCES)
    assert.deepEqual(data.credentials, [])
  })

  test('patches preferences partially and rejects unknown keys', async ({ client, assert }) => {
    const user = await register()
    const ok = await client
      .patch('/settings/preferences')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ editor: { spellcheck: false }, notifications: { digest: 'daily' } })
    ok.assertStatus(200)
    assert.isFalse(ok.body().data.editor.spellcheck)
    assert.isTrue(ok.body().data.editor.autosave)
    assert.equal(ok.body().data.notifications.digest, 'daily')

    const bad = await client
      .patch('/settings/preferences')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ editor: { spellcheck: 'nope' } })
    bad.assertStatus(422)
    const forged = await client
      .patch('/settings/preferences')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ admin: { role: 'owner' } })
    forged.assertStatus(422)

    await user.refresh()
    assert.isFalse(user.preferences.editor.spellcheck)
    assert.notProperty(user.preferences, 'admin')
  })

  test('updates the profile and refuses an email already in use', async ({ client, assert }) => {
    const user = await register()
    await register('taken@example.test')
    const ok = await client
      .patch('/settings/profile')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ fullName: 'Ada Lovelace', email: 'ADA@example.test' })
    ok.assertStatus(200)
    assert.deepEqual(ok.body().data, { fullName: 'Ada Lovelace', email: 'ada@example.test' })

    const taken = await client
      .patch('/settings/profile')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ fullName: null, email: 'taken@example.test' })
    taken.assertStatus(422)
    assert.equal(taken.body().errors[0].field, 'email')
  })

  test('changes the password only with the current password', async ({ client, assert }) => {
    const user = await register()
    const wrong = await client
      .put('/settings/password')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({
        currentPassword: 'not-my-password',
        password: 'brand-new-pass-1',
        passwordConfirmation: 'brand-new-pass-1',
      })
    wrong.assertStatus(422)
    assert.equal(wrong.body().errors[0].field, 'currentPassword')

    const ok = await client
      .put('/settings/password')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({
        currentPassword: 'test-password-123',
        password: 'brand-new-pass-1',
        passwordConfirmation: 'brand-new-pass-1',
      })
    ok.assertStatus(200)
    const fresh = await User.findOrFail(user.id)
    assert.isTrue(await hash.verify(fresh.password, 'brand-new-pass-1'))
  })

  test('stores API keys encrypted, exposes only a hint, and removes them', async ({
    client,
    assert,
  }) => {
    const user = await register()
    const secret = 'sk-or-v1-0123456789abcdefWXYZ'
    const saved = await client
      .put('/settings/credentials/model/openrouter')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ secret })
    saved.assertStatus(200)
    assert.equal(saved.body().data.hint, '…WXYZ')
    assert.notInclude(JSON.stringify(saved.body()), secret)

    const row = await db.from('user_credentials').where('user_id', user.id).firstOrFail()
    assert.notInclude(row.encrypted_secret, secret)
    assert.equal(encryption.decrypt(row.encrypted_secret), secret)

    const listed = await client.get('/settings').loginAs(user)
    assert.notInclude(JSON.stringify(listed.body()), secret)
    assert.lengthOf(listed.body().data.credentials, 1)

    const malformed = await client
      .put('/settings/credentials/model/openai')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ secret: 'definitely-not-a-key' })
    malformed.assertStatus(422)

    const unknown = await client
      .put('/settings/credentials/connector/google_drive')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
      .json({ secret: 'whatever-value' })
    unknown.assertStatus(404)

    const removed = await client
      .delete('/settings/credentials/model/openrouter')
      .loginAs(user)
      .withCsrfToken()
      .accept('json')
    removed.assertStatus(200)
    assert.lengthOf(await db.from('user_credentials').where('user_id', user.id), 0)
  })

  test("a user's credentials are invisible to other users", async ({ client, assert }) => {
    const owner = await register()
    const other = await register('other@example.test')
    const saved = await client
      .put('/settings/credentials/connector/slack')
      .loginAs(owner)
      .withCsrfToken()
      .accept('json')
      .json({ secret: 'https://hooks.slack.com/services/T000/B000/XXXXXXXX' })
    saved.assertStatus(200)
    const response = await client.get('/settings').loginAs(other)
    assert.deepEqual(response.body().data.credentials, [])
    const removed = await client
      .delete('/settings/credentials/connector/slack')
      .loginAs(other)
      .withCsrfToken()
      .accept('json')
    removed.assertStatus(200)
    assert.lengthOf(await db.from('user_credentials').where('user_id', owner.id), 1)
  })
})
