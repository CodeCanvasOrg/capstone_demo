import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import { Readable } from 'node:stream'
import { account, reset } from '../helpers/workspaces.ts'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import DocumentService from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import WorkflowService from '#services/documents/workflow_service'
import DocumentExportService from '#services/exports/document_export_service'
import TaskService from '#services/workspaces/task_service'
import WorkspaceTask from '#models/workspace_task'
import ExportPdfService from '#services/exports/pdf_service'
import IssueService from '#services/documents/issue_service'
test.group('Approved PDF export', (group) => {
  group.each.setup(reset)
  test('unapproved export is blocked and invalidation prevents stale render publication and downloads', async ({
    assert,
  }) => {
    const a = await account()
    const service = new DocumentExportService()
    await assert.rejects(() =>
      service.request(a.context, a.document.id, {
        approvalId: randomUUID(),
        mutationId: randomUUID(),
      })
    )
    await new DocumentService().update(a.context, a.document.id, {
      title: a.document.title!,
      projectInformation: Object.fromEntries(INFORMATION_FIELDS.map((key) => [key, 'Complete'])),
      metadataRevision: 0,
    })
    const version = await new VersionService().save(a.context, a.document.id, {
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Final text' }] }],
      },
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    const review = await new WorkflowService().transition(a.context, a.document.id, {
      baseVersionId: version.id,
      mutationId: randomUUID(),
    })
    const approval = await new WorkflowService().transition(
      a.context,
      a.document.id,
      {
        baseVersionId: version.id,
        reviewId: String(review.reviewId),
        warningAcknowledgments: ['input-only'],
        mutationId: randomUUID(),
      },
      true
    )
    const tasks = new TaskService()
    const task = await db.transaction((trx) =>
      tasks.create(
        a.context,
        {
          kind: 'render',
          documentId: a.document.id,
          mutationId: randomUUID(),
          payload: {
            versionId: version.id,
            approvalId: String(approval.approvalId),
            brandVersion: 'humblebee-1',
          },
        },
        trx
      )
    )
    const lease = await tasks.claim(task.id)
    const originalPdf = ExportPdfService.generate
    const originalDrive = drive.use
    let writes = 0
    drive.use = () =>
      ({
        put: async () => {
          writes++
        },
        delete: async () => {},
        getStream: async () => Readable.from([Buffer.from('pdf')]),
      }) as any
    ExportPdfService.generate = async () => {
      await new IssueService().save(a.context, a.document.id, {
        title: 'New blocker during render',
        blocking: true,
      })
      return Buffer.from('PDF bytes')
    }
    try {
      await assert.rejects(() => service.render(lease!))
      assert.equal(writes, 0)
      await WorkspaceTask.query()
        .where('id', task.id)
        .update({
          status: 'succeeded',
          result: {
            artifactKey: 'private.pdf',
            versionId: version.id,
            approvalId: approval.approvalId,
          },
        })
      await assert.rejects(() => service.download(a.context, a.document.id, task.id))
    } finally {
      ExportPdfService.generate = originalPdf
      drive.use = originalDrive
    }
  })
})
