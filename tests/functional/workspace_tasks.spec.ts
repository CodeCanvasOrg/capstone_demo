import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { account, reset } from '../helpers/workspaces.ts'
import TaskService from '#services/workspaces/task_service'
import WorkspaceTask from '#models/workspace_task'
import WorkspaceMembership from '#models/workspace_membership'
import MembershipService from '#services/workspaces/membership_service'
import AccessService from '#services/workspaces/access_service'

test.group('Workspace durable tasks', (group) => {
  group.each.setup(reset)
  test('duplicate intents have one accepted execution and preserve the initiating actor', async ({
    assert,
  }) => {
    const a = await account()
    const service = new TaskService()
    const mutationId = randomUUID()
    const input = { kind: 'generate' as const, documentId: a.document.id, mutationId, payload: {} }
    const first = await db.transaction((trx) => service.create(a.context, input, trx))
    const replay = await db.transaction((trx) => service.create(a.context, input, trx))
    assert.equal(first.id, replay.id)
    await assert.rejects(() =>
      db.transaction((trx) =>
        service.create(a.context, { ...input, payload: { inputHash: 'changed' } }, trx)
      )
    )
    const leases = await Promise.all([service.claim(first.id), service.claim(first.id)])
    assert.lengthOf(leases.filter(Boolean), 1)
    const lease = leases.find(Boolean)!
    assert.equal(lease.context.actorId, a.user.id)
    await service.finish(lease, async () => ({ accepted: true }))
    assert.isNull(await service.claim(first.id))
    await assert.rejects(() => service.finish(lease))
  })
  test('expired execution is fenced even after another worker claims the task', async ({
    assert,
  }) => {
    const a = await account()
    const service = new TaskService()
    const task = await db.transaction((trx) =>
      service.create(
        a.context,
        { kind: 'generate', documentId: a.document.id, mutationId: randomUUID(), payload: {} },
        trx
      )
    )
    const old = await service.claim(task.id)
    await WorkspaceTask.query()
      .where('id', task.id)
      .update({ leaseExpiresAt: DateTime.utc().minus({ seconds: 1 }) })
    await assert.rejects(() => service.check(old!))
    const next = await service.claim(task.id)
    assert.notEqual(old!.token, next!.token)
    await assert.rejects(() => service.finish(old!))
    await service.finish(next!)
  })
  test('revocation cancels tasks and rejoining cannot revive an old authorization epoch', async ({
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const member = await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: b.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    const { context } = await new AccessService().resolve(b.user.id, a.workspace.id)
    const service = new TaskService()
    const task = await db.transaction((trx) =>
      service.create(
        context,
        { kind: 'generate', documentId: a.document.id, mutationId: randomUUID(), payload: {} },
        trx
      )
    )
    const lease = await service.claim(task.id)
    await new MembershipService().revoke(a.context, member.id)
    await assert.rejects(() => service.check(lease!))
    await member.refresh()
    member.merge({ revokedAt: null, authorizationEpoch: member.authorizationEpoch + 1 })
    await member.save()
    assert.isNull(await service.claim(task.id))
    const cancelled = await WorkspaceTask.findOrFail(task.id)
    assert.equal(cancelled.status, 'cancelled')
  })
})
