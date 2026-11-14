/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { account, reset } from '../helpers/workspaces.ts'
import TaskService from '#services/workspaces/task_service'
import WorkspaceTask from '#models/workspace_task'

async function claimed() {
  const a = await account()
  const service = new TaskService()
  const task = await db.transaction((trx) =>
    service.create(
      a.context,
      { kind: 'render', documentId: a.document.id, mutationId: randomUUID(), payload: {} },
      trx
    )
  )
  return { a, service, task, lease: (await service.claim(task.id))! }
}

test.group('Durable stage progress (OPS-01A)', (group) => {
  group.each.setup(reset)

  test('stages persist with durations and the status DTO has stage but no percentage', async ({
    assert,
  }) => {
    const { a, service, task, lease } = await claimed()
    await service.recordStage(lease, 'preparing')
    await service.recordStage(lease, 'rendering')
    const shown = await service.show(a.context, task.id)
    assert.equal(shown.stage, 'rendering')
    assert.deepEqual(Object.keys(shown.timings), ['preparing'])
    assert.notProperty(shown, 'percent')
    assert.notProperty(shown, 'telemetry')
  })

  test('a refresh sees the same stage; finishing marks ready for review', async ({ assert }) => {
    const { a, service, task, lease } = await claimed()
    await service.recordStage(lease, 'validating')
    assert.equal((await service.show(a.context, task.id)).stage, 'validating')
    await service.finish(lease)
    assert.equal((await service.show(a.context, task.id)).stage, 'ready_for_review')
  })

  test('an expired or replaced worker cannot record a stage', async ({ assert }) => {
    const { service, task, lease } = await claimed()
    await WorkspaceTask.query()
      .where('id', task.id)
      .update({ leaseExpiresAt: DateTime.utc().minus({ seconds: 1 }) })
    await assert.rejects(() => service.recordStage(lease, 'rendering'))
  })

  test('unknown stages are refused and another workspace cannot read the task', async ({
    assert,
  }) => {
    const { service, task, lease } = await claimed()
    await assert.rejects(() => service.recordStage(lease, 'banana' as never))
    const b = await account('bob@example.test')
    await assert.rejects(() => service.show(b.context, task.id))
  })
})
