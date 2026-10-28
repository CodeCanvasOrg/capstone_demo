import { test } from '@japa/runner'
import { account, reset, source } from '../helpers/workspaces.ts'
import Document from '#models/document'
import Project from '#models/project'
import WorkspaceTask from '#models/workspace_task'
import TaskDispatch from '#models/task_dispatch'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import OpenRouterService from '#services/open_router_service'
import config from '#config/open_router'
import DocumentService from '#services/documents/document_service'
import { PENDING_TITLE } from '#services/documents/creation_service'

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
  test('a brief-only case study gets a model-written title and keeps the brief as its description', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const brief = 'we rebuilt the checkout flow for the mobile app and cut drop-off'
    const originalTitle = OpenRouterService.prototype.generateTitle
    const originalOutline = OpenRouterService.prototype.generateOutlineWithEvidence
    const seen: { titleBrief?: string; outlineTitle?: string } = {}
    OpenRouterService.prototype.generateTitle = async (prompt, _chunks, guard) => {
      await guard?.()
      seen.titleBrief = prompt
      return 'Mobile Checkout Redesign'
    }
    OpenRouterService.prototype.generateOutlineWithEvidence = async (
      title,
      _brief,
      _c,
      _o,
      guard
    ) => {
      await guard?.()
      seen.outlineTitle = title
      return generated
    }
    try {
      const response = await client
        .post(`/workspaces/${a.workspace.id}/documents`)
        .loginAs(a.user)
        .withCsrfToken()
        .redirects(0)
        .json({ description: brief, sourceMode: 'input_only' })
      response.assertStatus(302)
      const doc = await Document.findByOrFail('description', brief)
      assert.equal(doc.title, PENDING_TITLE)
      assert.isTrue(doc.templateSetup.generateTitle)
      await new TaskDispatchService().dispatch()
      await doc.refresh()
      assert.equal(doc.generationStatus, 'ready')
      assert.equal(doc.title, 'Mobile Checkout Redesign')
      assert.equal(doc.description, brief)
      assert.notProperty(doc.templateSetup, 'generateTitle')
      assert.include(seen.titleBrief!, brief)
      assert.equal(seen.outlineTitle, 'Mobile Checkout Redesign')
    } finally {
      OpenRouterService.prototype.generateTitle = originalTitle
      OpenRouterService.prototype.generateOutlineWithEvidence = originalOutline
    }
  })
  test('renaming before the first generation keeps the user title', async ({ client, assert }) => {
    const a = await account()
    await client
      .post(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({ description: 'A brief to rename', sourceMode: 'input_only' })
    const doc = await Document.findByOrFail('description', 'A brief to rename')
    await new DocumentService().update(a.context, doc.id, {
      title: 'My own title',
      description: doc.description,
      sourceMode: 'input_only',
      metadataRevision: doc.metadataRevision,
    })
    await doc.refresh()
    assert.equal(doc.title, 'My own title')
    assert.notProperty(doc.templateSetup, 'generateTitle')
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
  test('model timeouts re-queue the task and the last one explains itself', async ({
    client,
    assert,
  }) => {
    const a = await account()
    await client
      .post(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({ title: 'Slow provider', sourceMode: 'input_only' })
    const original = OpenRouterService.prototype.generateOutlineWithEvidence
    let calls = 0
    OpenRouterService.prototype.generateOutlineWithEvidence = async () => {
      calls++
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    }
    try {
      const doc = await Document.findByOrFail('title', 'Slow provider')
      await new TaskDispatchService().dispatch()
      let task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
      assert.equal(task.status, 'queued')
      assert.equal(task.attempts, 1)
      await new TaskDispatchService().dispatch()
      await new TaskDispatchService().dispatch()
      task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
      assert.equal(calls, 3)
      assert.equal(task.status, 'failed')
      assert.equal(task.safeError, 'The model took too long to respond. Try again in a moment.')
      await doc.refresh()
      assert.equal(doc.generationStatus, 'failed')
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
