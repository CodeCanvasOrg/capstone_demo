import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { account, reset, source } from '../helpers/workspaces.ts'
import GenerationService from '#services/documents/generation_service'
import TaskService from '#services/workspaces/task_service'
import WorkspaceTask from '#models/workspace_task'
import TaskDispatch from '#models/task_dispatch'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import TaskConflictException from '#exceptions/task_conflict_exception'
import OpenRouterService from '#services/open_router_service'

const unavailable =
  'A selected source could not be prepared. Retry source preparation, then generate again.'

test.group('Generation conflicts', (group) => {
  group.each.setup(reset)

  test('rejects a newer failed source without falling back or mutating generation state', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const evidence = await source(a)
    const run = await db.from('processing_runs').where('id', evidence.pin.runId).first()
    await db.table('processing_runs').insert({
      ...run,
      id: randomUUID(),
      status: 'failed',
      created_at: DateTime.utc().plus({ seconds: 1 }).toSQL(),
    })
    await a.document.refresh()
    const before = a.document.serialize()
    const response = await client
      .post(`/workspaces/${a.workspace.id}/documents/${a.document.id}/generation`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ mutationId: randomUUID(), baseVersionId: null })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WORKSPACE_CONFLICT')
    assert.equal(response.body().error.message, unavailable)
    assert.lengthOf(await WorkspaceTask.all(), 0)
    assert.lengthOf(await TaskDispatch.all(), 0)
    await a.document.refresh()
    assert.deepEqual(a.document.serialize(), before)
  })

  test('an Inertia request rejects failed evidence with a safe flash and no task', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const evidence = await source(a)
    await db.from('processing_runs').where('id', evidence.pin.runId).update({ status: 'failed' })
    const root = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const response = await client
      .post(`${root}/generation`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('x-inertia', 'true')
      .header('referer', `http://localhost:3345${root}/edit`)
      .redirects(0)
      .json({ mutationId: randomUUID(), baseVersionId: null })

    response.assertStatus(302)
    response.assertFlashMessage('error', unavailable)
    assert.lengthOf(await WorkspaceTask.all(), 0)
  })

  for (const status of ['queued', 'processing']) {
    test(`a ${status} source is accepted and defers execution without consuming an attempt`, async ({
      assert,
    }) => {
      const a = await account()
      const evidence = await source(a)
      await db.from('processing_runs').where('id', evidence.pin.runId).update({ status })
      const service = new GenerationService()
      const task = await service.request(a.context, a.document.id, randomUUID(), null)
      const lease = await new TaskService().claim(task.id)
      assert.isNotNull(lease)
      await service.execute(lease!)
      await task.refresh()
      assert.equal(task.status, 'queued')
      assert.equal(task.attempts, 0)
      assert.isNull(task.leaseToken)
      assert.lengthOf(await a.document.related('documentVersions').query(), 0)
    })
  }

  for (const state of ['failed', 'missing']) {
    test(`a source becoming ${state} after acceptance preserves its actionable failure`, async ({
      assert,
    }) => {
      const a = await account()
      const evidence = await source(a)
      const service = new GenerationService()
      const task = await service.request(a.context, a.document.id, randomUUID(), null)
      if (state === 'failed')
        await db
          .from('processing_runs')
          .where('id', evidence.pin.runId)
          .update({ status: 'failed' })
      else
        await task
          .merge({ payload: { ...task.payload, pins: [{ ...evidence.pin, runId: randomUUID() }] } })
          .save()

      await new TaskDispatchService().dispatch()
      await task.refresh()
      await a.document.refresh()
      assert.equal(task.status, 'conflict')
      assert.equal(task.attempts, 1)
      assert.equal(task.safeError, unavailable)
      assert.equal(a.document.generationError, unavailable)
      assert.equal(a.document.generationStatus, 'failed')
      assert.lengthOf(await a.document.related('documentVersions').query(), 0)
    })
  }

  test('a replay keeps its terminal task while fresh generation pins the newer ready run', async ({
    assert,
  }) => {
    const a = await account()
    const evidence = await source(a)
    const service = new GenerationService()
    const mutationId = randomUUID()
    const original = await service.request(a.context, a.document.id, mutationId, null)
    await db.from('processing_runs').where('id', evidence.pin.runId).update({ status: 'failed' })
    await new TaskDispatchService().dispatch()

    // Replay is handled before preflight, even while the latest source remains failed.
    const failedReplay = await service.request(a.context, a.document.id, mutationId, null)
    assert.equal(failedReplay.id, original.id)
    assert.equal(failedReplay.status, 'conflict')
    const run = await db.from('processing_runs').where('id', evidence.pin.runId).first()
    const readyRunId = randomUUID()
    await db.table('processing_runs').insert({
      ...run,
      id: readyRunId,
      status: 'ready',
      created_at: DateTime.utc().plus({ seconds: 1 }).toSQL(),
    })
    const fresh = await service.request(a.context, a.document.id, randomUUID(), null)
    assert.notEqual(fresh.id, original.id)
    assert.equal(fresh.payload.pins![0].runId, readyRunId)
    const replay = await service.request(a.context, a.document.id, mutationId, null)
    assert.equal(replay.id, original.id)
    assert.equal(replay.payload.pins![0].runId, evidence.pin.runId)
    await a.document.refresh()
    assert.equal(a.document.generationTaskId, fresh.id)
    assert.lengthOf(await WorkspaceTask.all(), 2)
    assert.lengthOf(await TaskDispatch.all(), 2)
  })

  test('changed inputs still conflict without publishing a version', async ({ assert }) => {
    const a = await account()
    const task = await new GenerationService().request(a.context, a.document.id, randomUUID(), null)
    await a.document.merge({ title: 'Changed after acceptance' }).save()
    await new TaskDispatchService().dispatch()
    await task.refresh()
    await a.document.refresh()
    assert.equal(task.status, 'conflict')
    assert.equal(task.safeError, 'Inputs changed. Start a new request.')
    assert.equal(a.document.generationError, task.safeError)
    assert.lengthOf(await a.document.related('documentVersions').query(), 0)
  })

  test('changes during provider execution still prevent version publication', async ({
    assert,
  }) => {
    const a = await account()
    const task = await new GenerationService().request(a.context, a.document.id, randomUUID(), null)
    const original = OpenRouterService.prototype.generateDocumentWithEvidence
    OpenRouterService.prototype.generateDocumentWithEvidence = async () => {
      await a.document.merge({ title: 'Changed while generating' }).save()
      return { type: 'doc', content: [] }
    }
    try {
      await new TaskDispatchService().dispatch()
    } finally {
      OpenRouterService.prototype.generateDocumentWithEvidence = original
    }
    await task.refresh()
    assert.equal(task.status, 'conflict')
    assert.equal(task.safeError, 'Inputs changed. Start a new request.')
    assert.lengthOf(await a.document.related('documentVersions').query(), 0)
  })

  test('provider 409 follows bounded retries without becoming an input conflict or leaking details', async ({
    assert,
  }) => {
    const a = await account()
    const task = await new GenerationService().request(a.context, a.document.id, randomUUID(), null)
    const original = OpenRouterService.prototype.generateDocumentWithEvidence
    OpenRouterService.prototype.generateDocumentWithEvidence = async () => {
      throw Object.assign(new Error('Sensitive provider response'), {
        status: 409,
        code: 'E_WORKSPACE_CONFLICT',
      })
    }
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        await new TaskDispatchService().dispatch()
        await task.refresh()
        assert.equal(task.attempts, attempt)
        assert.equal(task.status, attempt < 3 ? 'queued' : 'failed')
        assert.equal(task.safeError, 'Processing failed. Retry is available.')
        assert.notInclude(task.safeError!, 'Sensitive provider response')
        const intent = await TaskDispatch.findByOrFail('taskId', task.id)
        if (attempt < 3) assert.isNull(intent.dispatchedAt)
      }
    } finally {
      OpenRouterService.prototype.generateDocumentWithEvidence = original
    }
    await a.document.refresh()
    assert.equal(a.document.generationStatus, 'failed')
    assert.equal(a.document.generationError, task.safeError)
    assert.lengthOf(await a.document.related('documentVersions').query(), 0)
  })

  test('an expired lease has its own failure reason', async ({ assert }) => {
    const a = await account()
    const service = new GenerationService()
    const tasks = new TaskService()
    const task = await service.request(a.context, a.document.id, randomUUID(), null)
    const lease = (await tasks.claim(task.id))!
    await WorkspaceTask.query()
      .where('id', task.id)
      .update({ leaseExpiresAt: DateTime.utc().minus({ seconds: 1 }) })
    try {
      await service.execute(lease)
      assert.fail('An expired lease must not execute generation')
    } catch (error) {
      assert.instanceOf(error, TaskConflictException)
      assert.equal((error as TaskConflictException).reason, 'lease_lost')
      await service.failed(lease, error)
    }
    await task.refresh()
    assert.equal(task.status, 'conflict')
    assert.equal(
      task.safeError,
      'This task no longer owns its execution lease. Start a new request.'
    )
  })

  test('a replaced lease cannot fail another worker or overwrite its document', async ({
    assert,
  }) => {
    const a = await account()
    const service = new GenerationService()
    const tasks = new TaskService()
    const task = await service.request(a.context, a.document.id, randomUUID(), null)
    const old = (await tasks.claim(task.id))!
    await WorkspaceTask.query()
      .where('id', task.id)
      .update({ leaseExpiresAt: DateTime.utc().minus({ seconds: 1 }) })
    const next = (await tasks.claim(task.id))!
    await service.failed(old, new TaskConflictException('lease_lost'))
    await task.refresh()
    await a.document.refresh()
    assert.equal(task.status, 'running')
    assert.equal(task.leaseToken, next.token)
    assert.isNull(task.safeError)
    assert.equal(a.document.generationStatus, 'processing')
    assert.isNull(a.document.generationError)
    await tasks.finish(next)
  })

  test('shared callers retain the default conflict message when none is provided', async ({
    assert,
  }) => {
    const a = await account()
    const tasks = new TaskService()
    const task = await new GenerationService().request(a.context, a.document.id, randomUUID(), null)
    const lease = (await tasks.claim(task.id))!
    await tasks.fail(lease, true)
    await task.refresh()
    assert.equal(task.status, 'conflict')
    assert.equal(task.safeError, 'Inputs changed. Start a new request.')
  })
})
