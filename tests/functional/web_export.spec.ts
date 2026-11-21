import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import drive from '@adonisjs/drive/services/main'
import { account, reset } from '../helpers/workspaces.ts'
import WorkspaceTask from '#models/workspace_task'
import VersionService from '#services/documents/version_service'
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
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'The challenge' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Saved web draft <b>' }] },
      ],
    },
  })
  await a.document.refresh()
  return { ...a, version }
}

test.group('Web page export', (group) => {
  group.each.setup(reset)
  const dispatch = TaskDispatchService.prototype.dispatch
  const pdf = ExportPdfService.generate
  const disk = drive.use
  let stored: { key: string; body: Buffer; contentType?: string }[] = []
  group.each.setup(() => {
    stored = []
    TaskDispatchService.prototype.dispatch = async () => 0
    ExportPdfService.generate = async () => Buffer.from('local synthetic PDF')
    drive.use = () =>
      ({
        put: async (key: string, body: Buffer, options: { contentType?: string }) => {
          stored.push({ key, body, contentType: options.contentType })
        },
        delete: async () => {},
        getStream: async (key: string) =>
          Readable.from([stored.find((item) => item.key === key)?.body ?? Buffer.from('')]),
      }) as any
  })
  group.each.teardown(() => {
    TaskDispatchService.prototype.dispatch = dispatch
    ExportPdfService.generate = pdf
    drive.use = disk
  })

  test('a solo web export renders the saved content and downloads as an .html attachment', async ({
    client,
    assert,
  }) => {
    const a = await saved()
    const root = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const response = await client
      .post(`${root}/exports/web`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ baseVersionId: a.version.id, mutationId: randomUUID() })
    response.assertStatus(202)
    const task = await WorkspaceTask.findOrFail(response.body().data.id)
    assert.equal(task.payload.format, 'web')
    const lease = await new TaskService().claim(task.id)
    await new DocumentExportService().render(lease!)

    assert.lengthOf(stored, 1)
    assert.match(stored[0].key, new RegExp(`/exports/${task.id}\\.html$`))
    assert.include(stored[0].contentType!, 'text/html')
    const html = stored[0].body.toString('utf8')
    assert.include(html, 'The challenge')
    assert.include(html, 'Saved web draft &lt;b&gt;')
    assert.notInclude(html, 'PREVIEW · NOT APPROVED')

    const polled = await client
      .get(`/workspaces/${a.workspace.id}/tasks/${task.id}`)
      .loginAs(a.user)
    polled.assertStatus(200)
    assert.equal(polled.body().data.result.format, 'web')

    const downloaded = await client.get(`${root}/exports/${task.id}/download`).loginAs(a.user)
    downloaded.assertStatus(200)
    assert.include(downloaded.header('content-type')!, 'text/html')
    assert.equal(downloaded.header('x-content-type-options'), 'nosniff')
    assert.match(downloaded.header('content-disposition')!, /^attachment; .*\.html$/)
  })

  test('PDF requests keep their original payload and a mutation id cannot switch format', async ({
    assert,
  }) => {
    const a = await saved()
    const service = new DocumentExportService()
    const input = { baseVersionId: a.version.id, mutationId: randomUUID() }
    const first = await service.request(a.context, a.document.id, input)
    assert.notProperty(first.payload, 'format')
    await assert.rejects(() =>
      service.request(a.context, a.document.id, { ...input, format: 'web' })
    )
  })

  test('the web preview is a draft page served under the preview CSP', async ({
    client,
    assert,
  }) => {
    const a = await saved()
    const response = await client
      .get(`/workspaces/${a.workspace.id}/documents/${a.document.id}/preview/web`)
      .loginAs(a.user)
    response.assertStatus(200)
    assert.include(response.header('content-type')!, 'text/html')
    assert.include(response.header('content-security-policy')!, "default-src 'none'")
    assert.include(response.text(), 'PREVIEW · NOT APPROVED')
    assert.include(response.text(), 'name="viewport"')
  })
})
