import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import User from '#models/user'
import Workspace from '#models/workspace'
import WorkspaceMembership from '#models/workspace_membership'
import WorkspaceService from '#services/workspaces/workspace_service'
import { DateTime } from 'luxon'

test.group('Workspace provisioning', (group) => {
  group.each.setup(async () => {
    if (!env.get('TEST_DB_URL')?.endsWith('/capstone_tenancy_test'))
      throw new Error('Requires explicit disposable capstone_tenancy_test database')
    await db.rawQuery('TRUNCATE users CASCADE')
  })
  test('registers the account, initial workspace and owner membership atomically', async ({
    assert,
  }) => {
    const user = await new WorkspaceService().register({
      fullName: 'Alice',
      email: 'ALICE@example.test',
      password: 'test-password-123',
    })
    const workspace = await Workspace.findByOrFail('initialForUserId', user.id)
    const membership = await WorkspaceMembership.findByOrFail('workspaceId', workspace.id)
    assert.equal(user.email, 'alice@example.test')
    assert.equal(membership.userId, user.id)
    assert.equal(membership.role, 'owner')
    assert.equal(user.lastWorkspaceId, workspace.id)
  })
  test('rolls back the new account when workspace insertion fails', async ({ assert }) => {
    await assert.rejects(() =>
      new WorkspaceService().register({
        fullName: 'a'.repeat(120),
        email: 'rollback@example.test',
        password: 'test-password-123',
      })
    )
    assert.isNull(await User.findBy('email', 'rollback@example.test'))
    const result1 = await Workspace.all()
    assert.equal(result1.length, 0)
  })
  test('serializes duplicate provisioning and never repairs revoked access', async ({ assert }) => {
    const user = await User.create({
      email: 'duplicate@example.test',
      password: 'test-password-123',
    })
    const service = new WorkspaceService()
    const results = await Promise.all(
      Array.from({ length: 4 }, () => service.provisionInitial(user.id))
    )
    assert.equal(new Set(results.map((w) => w.id)).size, 1)
    const membership = await WorkspaceMembership.findByOrFail('workspaceId', results[0].id)
    membership.revokedAt = DateTime.utc()
    membership.authorizationEpoch++
    await membership.save()
    await service.provisionInitial(user.id)
    await membership.refresh()
    assert.isNotNull(membership.revokedAt)
    const result2 = await WorkspaceMembership.all()
    assert.equal(result2.length, 1)
  })
  test('allows additional workspaces without duplicating the initial workspace', async ({
    assert,
  }) => {
    const service = new WorkspaceService()
    const user = await service.register({
      email: 'more@example.test',
      password: 'test-password-123',
    })
    const extra = await service.create(user.id, 'Another workspace')
    assert.isNull(extra.initialForUserId)
    const result3 = await Workspace.query().where('ownerUserId', user.id)
    assert.equal(result3.length, 2)
  })
})
