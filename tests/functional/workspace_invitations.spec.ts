import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import encryption from '@adonisjs/core/services/encryption'
import mail from '@adonisjs/mail/services/main'
import InvitationService from '#services/workspaces/invitation_service'
import WorkspaceInvitation from '#models/workspace_invitation'
import WorkspaceMembership from '#models/workspace_membership'
import { account, reset } from '../helpers/workspaces.ts'
test.group('Workspace invitations', (group) => {
  group.each.setup(reset)
  group.each.teardown(() => mail.restore())
  test('acceptance is addressed, atomic, duplicate-safe and requires a POST', async ({
    assert,
    client,
  }) => {
    mail.fake()
    const a = await account()
    const b = await account('bob@example.test')
    const stranger = await account('other@example.test')
    const service = new InvitationService()
    const invite = await service.manage(a.context, 'BOB@example.test')
    await invite.refresh()
    assert.equal(invite.deliveryState, 'sent')
    const token = encryption.decrypt<string>(invite.deliveryTokenEncrypted!)!
    const preview = await client
      .get(`/invitations/${token}`)
      .loginAs(b.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    preview.assertStatus(200)
    assert.isNull(
      await WorkspaceMembership.query()
        .where({ workspaceId: a.workspace.id, userId: b.user.id })
        .first()
    )
    await assert.rejects(() => service.accept(stranger.user, token))
    const results = await Promise.all([
      service.accept(b.user, token),
      service.accept(b.user, token),
    ])
    assert.sameMembers(
      results.map((ws) => ws.id),
      [a.workspace.id, a.workspace.id]
    )
    const memberships = await WorkspaceMembership.query().where({
      workspaceId: a.workspace.id,
      userId: b.user.id,
    })
    assert.lengthOf(memberships, 1)
    await invite.refresh()
    assert.isNull(invite.deliveryTokenEncrypted)
    assert.isNotNull(invite.emailVerifiedAt)
  })
  test('expiry, revocation and rotation reject old links without adding membership', async ({
    assert,
  }) => {
    mail.fake()
    const a = await account()
    const b = await account('bob@example.test')
    const service = new InvitationService()
    const invite = await service.manage(a.context, b.user.email)
    const old = encryption.decrypt<string>(invite.deliveryTokenEncrypted!)!
    await WorkspaceInvitation.query()
      .where('id', invite.id)
      .update({ expiresAt: DateTime.utc().minus({ days: 1 }) })
    await assert.rejects(() => service.accept(b.user, old))
    const rotated = await service.manage(a.context, '', invite.id)
    const current = encryption.decrypt<string>(rotated.deliveryTokenEncrypted!)!
    assert.notEqual(current, old)
    await assert.rejects(() => service.find(old))
    await service.manage(a.context, '', invite.id, true)
    await assert.rejects(() => service.accept(b.user, current))
  })
  test('email failure preserves a retryable invitation and membership is never granted by delivery', async ({
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const service = new InvitationService()
    mail.fake()
    const invite = await service.manage(a.context, b.user.email)
    const send = mail.send
    mail.send = async () => {
      throw new Error('SMTP unavailable')
    }
    try {
      await assert.rejects(() => service.deliver(invite.id, invite.tokenHash))
      await invite.refresh()
      assert.equal(invite.deliveryState, 'failed')
      assert.isNotNull(invite.deliveryTokenEncrypted)
      assert.isNull(
        await WorkspaceMembership.query()
          .where({ workspaceId: a.workspace.id, userId: b.user.id })
          .first()
      )
      mail.send = send
      const retry = await service.manage(a.context, '', invite.id)
      await retry.refresh()
      assert.equal(retry.deliveryState, 'sent')
    } finally {
      mail.send = send
    }
  })
})
