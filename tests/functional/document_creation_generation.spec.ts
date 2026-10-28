import { test } from '@japa/runner'
import { account, reset, source } from '../helpers/workspaces.ts'
import Document from '#models/document'
import Project from '#models/project'
import WorkspaceTask from '#models/workspace_task'
import TaskDispatch from '#models/task_dispatch'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import OpenRouterService from '#services/open_router_service'
import config from '#config/open_router'

const generated = {
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A generated, saved draft.' }] }],
}

test.group('Document creation generation', (group) => {
  group.each.setup(reset)
  test('one brief redirects before provider execution, then publishes one accepted generated version', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const original = OpenRouterService.prototype.generateOutlineWithEvidence
    let calls = 0
    OpenRouterService.prototype.generateOutlineWithEvidence = async (
      _title,
      _brief,
      _chunks,
      _outline,
      guard
    ) => {
      await guard?.()
      calls++
      return generated
    }
    try {
      const response = await client
        .post(`/workspaces/${a.workspace.id}/documents`)
        .loginAs(a.user)
        .withCsrfToken()
        .redirects(0)
        .json({
          title: 'Immediate draft',
          description: 'Our supplied brief',
          sourceMode: 'input_only',
        })
      response.assertStatus(302)
      const doc = await Document.findByOrFail('title', 'Immediate draft')
      response.assertHeader('location', `/workspaces/${a.workspace.id}/documents/${doc.id}/edit`)
      assert.equal(calls, 0)
      assert.equal(doc.generationStatus, 'processing')
      assert.isNull(doc.currentVersionId)
      const task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
      assert.equal(task.actorId, a.user.id)
      assert.equal(task.workspaceId, a.workspace.id)
      assert.equal(task.status, 'queued')
      await new TaskDispatchService().dispatch()
      await doc.refresh()
      assert.equal(calls, 1)
      assert.equal(doc.generationStatus, 'ready')
      const versions = await doc.related('documentVersions').query()
      assert.lengthOf(versions, 1)
      assert.deepEqual(versions[0].content, generated)
      assert.equal(doc.currentVersionId, versions[0].id)
      await new TaskDispatchService().dispatch()
      assert.equal(calls, 1)
    } finally {
      OpenRouterService.prototype.generateOutlineWithEvidence = original
    }
  })
  test('a new project atomically creates and opens its first case study using its rich brief', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const response = await client
      .post(`/workspaces/${a.workspace.id}/projects`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({
        name: 'Project and story',
        descriptionContent: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'A supplied project brief' }] },
          ],
        },
      })
    response.assertStatus(302)
    const project = await Project.findByOrFail('name', 'Project and story')
    const doc = await Document.findByOrFail('projectId', project.id)
    response.assertHeader('location', `/workspaces/${a.workspace.id}/documents/${doc.id}/edit`)
    assert.equal(doc.description, 'A supplied project brief')
    assert.deepEqual(doc.descriptionContent, project.descriptionContent)
    assert.equal(doc.sourceMode, 'input_only')
    assert.equal(doc.projectInformation.overview, project.description)
    assert.equal(doc.generationStatus, 'processing')
    const tasks = await WorkspaceTask.query().where('documentId', doc.id)
    assert.lengthOf(tasks, 1)
    assert.equal(tasks[0].workspaceId, project.workspaceId)
    const update = await client
      .patch(`/workspaces/${a.workspace.id}/projects/${project.id}`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({ name: 'Renamed project' })
    update.assertStatus(302)
    assert.lengthOf(await Document.query().where('projectId', project.id), 1)
  })
  test('creation and generation intent roll back together when evidence is missing or foreign', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('other@example.test')
    const foreign = await source(b, false)
    for (const files of [[], [{ id: foreign.file.id }]]) {
      const response = await client
        .post(`/workspaces/${a.workspace.id}/documents`)
        .loginAs(a.user)
        .withCsrfToken()
        .header('accept', 'application/json')
        .json({ title: 'Must roll back', sourceMode: 'files', files })
      assert.include([404, 409], response.status())
      assert.isNull(await Document.findBy('title', 'Must roll back'))
    }
    assert.lengthOf(await WorkspaceTask.all(), 0)
    assert.lengthOf(await TaskDispatch.all(), 0)
  })
  test('a transient synchronous provider failure retains its delivery intent for a successful retry', async ({
    client,
    assert,
  }) => {
    const a = await account()
    await client
      .post(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({ title: 'Retryable draft', sourceMode: 'input_only' })
    const original = OpenRouterService.prototype.generateOutlineWithEvidence
    let calls = 0
    OpenRouterService.prototype.generateOutlineWithEvidence = async () => {
      if (++calls === 1)
        throw Object.assign(new Error('Synthetic upstream outage'), { statusCode: 503 })
      return generated
    }
    try {
      await new TaskDispatchService().dispatch()
      const doc = await Document.findByOrFail('title', 'Retryable draft')
      const intent = await TaskDispatch.findByOrFail('taskId', doc.generationTaskId!)
      assert.isNull(intent.dispatchedAt)
      assert.equal(doc.generationStatus, 'processing')
      await new TaskDispatchService().dispatch()
      await doc.refresh()
      assert.equal(calls, 2)
      assert.equal(doc.generationStatus, 'ready')
      assert.lengthOf(await doc.related('documentVersions').query(), 1)
    } finally {
      OpenRouterService.prototype.generateOutlineWithEvidence = original
    }
  })
  test('provider authentication failures become terminal and expose only a safe actionable error', async ({
    client,
    assert,
  }) => {
    const a = await account()
    await client
      .post(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({ title: 'Provider error', sourceMode: 'input_only' })
    const original = OpenRouterService.prototype.generateOutlineWithEvidence
    OpenRouterService.prototype.generateOutlineWithEvidence = async () => {
      throw Object.assign(new Error('Sensitive upstream details'), { statusCode: 401 })
    }
    try {
      await new TaskDispatchService().dispatch()
    } finally {
      OpenRouterService.prototype.generateOutlineWithEvidence = original
    }
    const doc = await Document.findByOrFail('title', 'Provider error')
    assert.equal(doc.generationStatus, 'failed')
    const task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
    assert.equal(task.status, 'failed')
    assert.equal(task.attempts, 1)
    const response = await client
      .get(`/workspaces/${a.workspace.id}/documents/${doc.id}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    response.assertStatus(200)
    assert.equal(response.body().props.document.generationError, config.failureMessages[401])
    assert.notInclude(JSON.stringify(response.body()), 'Sensitive upstream details')
  })
})
