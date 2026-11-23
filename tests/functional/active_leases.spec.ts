import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { account, reset } from '../helpers/workspaces.ts'
import TaskService from '#services/workspaces/task_service'
import WorkspaceTask from '#models/workspace_task'
import TaskDispatch from '#models/task_dispatch'
import {
  activeLeaseCount,
  releaseActiveLeases,
  trackLease,
} from '#services/workspaces/active_leases'

test.group('Handing running tasks back on shutdown', (group) => {
  group.each.setup(reset)

  const newTask = async (email?: string) => {
    const a = await account(email)
    return db.transaction((trx) =>
      new TaskService().create(
        a.context,
        { kind: 'generate', documentId: a.document.id, mutationId: randomUUID(), payload: {} },
        trx
      )
    )
  }

  test('a released task is queued for immediate re-dispatch and the old lease is fenced', async ({
    assert,
  }) => {
    const service = new TaskService()
    const task = await newTask()
    await TaskDispatch.query().where('task_id', task.id).update({ dispatchedAt: DateTime.utc() })
    const lease = (await service.claim(task.id))!
    trackLease(lease)

    assert.deepEqual(await releaseActiveLeases(service), [task.id])
    assert.equal(activeLeaseCount(), 0)

    const fresh = await WorkspaceTask.findOrFail(task.id)
    assert.equal(fresh.status, 'queued')
    assert.isNull(fresh.leaseToken)
    // The interrupted run does not count against the retry limit.
    assert.equal(fresh.attempts, 0)
    const dispatch = await TaskDispatch.findByOrFail('taskId', task.id)
    assert.isNull(dispatch.dispatchedAt)

    // The old process may still be running; anything it writes now is rejected.
    await assert.rejects(() => service.finish(lease))
    const next = await service.claim(task.id)
    assert.isNotNull(next)
    await service.finish(next!)
  })

  test('finished jobs untrack themselves and lost leases are skipped', async ({ assert }) => {
    const service = new TaskService()
    const done = await newTask()
    const lost = await newTask('bob@example.test')

    const doneLease = (await service.claim(done.id))!
    const untrack = trackLease(doneLease)
    await service.finish(doneLease)
    untrack()

    const lostLease = (await service.claim(lost.id))!
    trackLease(lostLease)
    await service.finish(lostLease)

    assert.deepEqual(await releaseActiveLeases(service), [])
    const finished = await WorkspaceTask.findOrFail(lost.id)
    assert.equal(finished.status, 'succeeded')
  })
})
