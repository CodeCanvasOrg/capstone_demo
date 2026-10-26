import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import { account, reset, source } from '../helpers/workspaces.ts'
import WorkspaceMembership from '#models/workspace_membership'
import WorkspaceInvitation from '#models/workspace_invitation'
import DocumentReview from '#models/document_review'
import DocumentApproval from '#models/document_approval'
import WorkspaceTask from '#models/workspace_task'
import VersionService from '#services/documents/version_service'
import DocumentService, { INFORMATION_FIELDS } from '#services/documents/document_service'
import WorkflowService from '#services/documents/workflow_service'
import IssueService from '#services/documents/issue_service'
import ReadinessService from '#services/documents/readiness_service'
import DocumentExportService from '#services/exports/document_export_service'
import ExportPdfService from '#services/exports/pdf_service'
import TaskService from '#services/workspaces/task_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'

async function saved() {
  const a = await account()
  const version = await new VersionService().save(a.context, a.document.id, {
    baseVersionId: null,
    mutationId: randomUUID(),
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved solo draft' }] }],
    },
  })
  await a.document.refresh()
  return { ...a, version }
}
async function join(a: Awaited<ReturnType<typeof saved>>) {
  const b = await account(`member-${randomUUID()}@example.test`)
  return WorkspaceMembership.create({
    workspaceId: a.workspace.id,
    userId: b.user.id,
    role: 'member',
    authorizationEpoch: 0,
  })
}

test.group('Membership-aware PDF export', (group) => {
  group.each.setup(reset)
  const dispatch = TaskDispatchService.prototype.dispatch
  const pdf = ExportPdfService.generate
  const disk = drive.use
  group.each.setup(() => {
    // Exercise the real task lifecycle explicitly, without a queue or external PDF/storage service.
    TaskDispatchService.prototype.dispatch = async () => 0
    ExportPdfService.generate = async () => Buffer.from('local synthetic PDF')
    drive.use = () =>
      ({
        put: async () => {},
        delete: async () => {},
        getStream: async () => Readable.from([Buffer.from('local PDF')]),
      }) as any
  })
  group.each.teardown(() => {
    TaskDispatchService.prototype.dispatch = dispatch
    ExportPdfService.generate = pdf
    drive.use = disk
  })
  test('solo HTTP export ignores incomplete checklist without creating an approval', async ({
    client,
    assert,
  }) => {
    const a = await saved()
    await new IssueService().save(a.context, a.document.id, {
      title: 'Optional solo issue',
      blocking: true,
    })
    const root = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const view = await client
      .get(`${root}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    view.assertStatus(200)
    assert.isFalse(view.body().props.workflow.readiness.reviewRequired)
    assert.isTrue(view.body().props.workflow.readiness.canExport)
    const response = await client
      .post(`${root}/exports/pdf`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ baseVersionId: a.version.id, mutationId: randomUUID() })
    response.assertStatus(202)
    const task = await WorkspaceTask.findOrFail(response.body().data.id)
    assert.equal(task.payload.exportMode, 'solo')
    const lease = await new TaskService().claim(task.id)
    assert.isNotNull(lease)
    await new DocumentExportService().render(lease!)
    const downloaded = await client.get(`${root}/exports/${task.id}/download`).loginAs(a.user)
    downloaded.assertStatus(200)
    assert.include(downloaded.header('content-type')!, 'application/pdf')
    assert.lengthOf(await DocumentReview.all(), 0)
    assert.lengthOf(await DocumentApproval.all(), 0)
    await a.document.refresh()
    assert.notEqual(a.document.status, 'approved')
  })
  test('solo review is optional and may be submitted without completing the checklist', async ({
    assert,
  }) => {
    const a = await saved()
    const review = await new WorkflowService().transition(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    assert.isString(review.reviewId)
    assert.lengthOf(await DocumentApproval.all(), 0)
  })
  test('team requests cannot bypass checklist or approval and approved team export still works', async ({
    client,
    assert,
  }) => {
    const a = await saved()
    await join(a)
    const service = new DocumentExportService()
    const root = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const view = await client
      .get(`${root}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    assert.isTrue(view.body().props.workflow.readiness.reviewRequired)
    assert.isFalse(view.body().props.workflow.readiness.canExport)
    const denied = await client
      .post(`${root}/exports/pdf`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ baseVersionId: a.version.id, mutationId: randomUUID() })
    denied.assertStatus(409)
    await assert.rejects(() =>
      new WorkflowService().transition(a.context, a.document.id, {
        baseVersionId: a.version.id,
        mutationId: randomUUID(),
      })
    )
    await new DocumentService().update(a.context, a.document.id, {
      title: a.document.title!,
      metadataRevision: 0,
      projectInformation: Object.fromEntries(INFORMATION_FIELDS.map((key) => [key, 'Complete'])),
    })
    const review = await new WorkflowService().transition(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    const approval = await new WorkflowService().transition(
      a.context,
      a.document.id,
      {
        baseVersionId: a.version.id,
        reviewId: String(review.reviewId),
        warningAcknowledgments: ['input-only'],
        mutationId: randomUUID(),
      },
      true
    )
    const task = await service.request(a.context, a.document.id, {
      approvalId: String(approval.approvalId),
      mutationId: randomUUID(),
    })
    assert.equal(task.payload.exportMode, 'approved')
    await service.render((await new TaskService().claim(task.id))!)
    await service.download(a.context, a.document.id, task.id)
  })
  test('pending invitations and revoked memberships do not turn a solo workspace into a team', async ({
    assert,
  }) => {
    const a = await saved()
    const member = await join(a)
    member.revokedAt = DateTime.utc()
    await member.save()
    await WorkspaceInvitation.create({
      workspaceId: a.workspace.id,
      inviterId: a.user.id,
      email: 'pending@example.test',
      tokenHash: randomUUID(),
      expiresAt: DateTime.utc().plus({ days: 7 }),
      deliveryState: 'pending',
      deliveryAttempts: 0,
    })
    const state = await new ReadinessService().inspect(a.document)
    assert.isFalse(state.reviewRequired)
    assert.isTrue(state.canExport)
  })
  test('solo export requires the saved nonempty current version and preserves replay identity', async ({
    assert,
  }) => {
    const a = await account()
    const service = new DocumentExportService()
    await assert.rejects(() =>
      service.request(a.context, a.document.id, {
        baseVersionId: randomUUID(),
        mutationId: randomUUID(),
      })
    )
    const version = await new VersionService().save(a.context, a.document.id, {
      content: { type: 'doc', content: [] },
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    await assert.rejects(() =>
      service.request(a.context, a.document.id, {
        baseVersionId: version.id,
        mutationId: randomUUID(),
      })
    )
    const meaningful = await new VersionService().save(a.context, a.document.id, {
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ready' }] }],
      },
      baseVersionId: version.id,
      mutationId: randomUUID(),
    })
    await assert.rejects(() =>
      service.request(a.context, a.document.id, {
        baseVersionId: version.id,
        mutationId: randomUUID(),
      })
    )
    const input = { baseVersionId: meaningful.id, mutationId: randomUUID() }
    const first = await service.request(a.context, a.document.id, input)
    const replay = await service.request(a.context, a.document.id, input)
    assert.equal(first.id, replay.id)
  })
  test('a second member blocks an already queued solo render and a completed solo download', async ({
    assert,
  }) => {
    const a = await saved()
    const service = new DocumentExportService()
    const first = await service.request(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    await service.render((await new TaskService().claim(first.id))!)
    await service.download(a.context, a.document.id, first.id)
    const queued = await service.request(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    const lease = await new TaskService().claim(queued.id)
    await join(a)
    await assert.rejects(() => service.render(lease!))
    await assert.rejects(() => service.download(a.context, a.document.id, first.id))
  })
  test('membership changes during PDF rendering prevent artifact publication', async ({
    assert,
  }) => {
    const a = await saved()
    const service = new DocumentExportService()
    const task = await service.request(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    const lease = await new TaskService().claim(task.id)
    let writes = 0
    drive.use = () =>
      ({
        put: async () => {
          writes++
        },
        delete: async () => {},
      }) as any
    ExportPdfService.generate = async () => {
      await join(a)
      return Buffer.from('PDF')
    }
    await assert.rejects(() => service.render(lease!))
    assert.equal(writes, 0)
  })
  test('source or version changes invalidate a solo export snapshot', async ({ assert }) => {
    const a = await saved()
    const evidence = await source(a)
    const service = new DocumentExportService()
    const task = await service.request(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    const lease = await new TaskService().claim(task.id)
    await db
      .from('processing_runs')
      .where('id', evidence.pin.runId)
      .update({ pipeline_version: 'changed' })
    await assert.rejects(() => service.render(lease!))
    const fresh = await service.request(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    const freshLease = await new TaskService().claim(fresh.id)
    await new VersionService().save(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New version' }] }],
      },
    })
    await assert.rejects(() => service.render(freshLease!))
  })
})
