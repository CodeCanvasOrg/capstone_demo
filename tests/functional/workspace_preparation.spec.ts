import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { account, source, reset } from '../helpers/workspaces.ts'
import PreparationService from '#services/files/preparation_service'
import WorkspaceMembership from '#models/workspace_membership'
import AccessService from '#services/workspaces/access_service'

test.group('Workspace source preparation', (group) => {
  group.each.setup(reset)
  test('outdated sources get an attributed duplicate-safe run while old evidence is retained', async ({
    assert,
  }) => {
    const a = await account()
    const evidence = await source(a)
    const service = new PreparationService()
    await assert.rejects(() => service.request(a.context, evidence.file.id, randomUUID()))
    await db
      .from('processing_runs')
      .where('id', evidence.pin.runId)
      .update({ pipeline_version: 'old-configuration' })
    const mutationId = randomUUID()
    const task = await service.request(a.context, evidence.file.id, mutationId)
    assert.notEqual(task.runId, evidence.pin.runId)
    assert.equal(task.actorId, a.user.id)
    const replay = await service.request(a.context, evidence.file.id, mutationId)
    assert.equal(replay.id, task.id)
    await assert.rejects(() => service.request(a.context, evidence.file.id, randomUUID()))
    assert.exists(await db.from('chunks').where('id', evidence.chunkId).first())
    await a.document.refresh()
    assert.equal(a.document.metadataRevision, 1)
    const b = await account('member@example.test')
    await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: b.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    const { context } = await new AccessService().resolve(b.user.id, a.workspace.id)
    await assert.rejects(() => service.request(context, evidence.file.id, randomUUID()))
  })
})
