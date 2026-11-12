import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import DocumentExportService from '#services/exports/document_export_service'
import ExportPdfService from '#services/exports/pdf_service'
import VersionService from '#services/documents/version_service'
import { account, reset } from '../helpers/workspaces.ts'

const t = (text: string, marks?: unknown[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) })
const doc = (body: unknown[]) => ({
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [t('Title')] },
    { type: 'paragraph', content: [t('Summary.')] },
    { type: 'paragraph', content: body },
  ],
})

test.group('Publication export boundary', (group) => {
  group.each.setup(reset)
  const generate = ExportPdfService.generate
  const html = ExportPdfService.html
  group.each.teardown(() => {
    ExportPdfService.generate = generate
    ExportPdfService.html = html
  })

  test('both layouts receive only the client data, never the saved record', async ({ assert }) => {
    const a = await account()
    await new VersionService().save(a.context, a.document.id, {
      content: doc([t('Up to 30% faster (estimated).')]),
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    const received: any[] = []
    ExportPdfService.generate = async (data) => {
      received.push(data)
      return Buffer.from('PDF')
    }
    for (const layout of ['legacy', 'pilot']) {
      process.env.PUBLICATION_LAYOUT = layout
      await new DocumentExportService().preview(a.context, a.document.id)
    }
    delete process.env.PUBLICATION_LAYOUT
    assert.lengthOf(received, 2)
    for (const data of received) {
      assert.equal(data.schemaVersion, 1)
      assert.notProperty(data, 'content')
      assert.notProperty(data, 'identity')
      assert.include(JSON.stringify(data), 'Up to 30% faster (estimated).')
    }
  })

  test('a confirmed private route stops preview before any rendering, with field paths only', async ({
    assert,
  }) => {
    const a = await account()
    await new VersionService().save(a.context, a.document.id, {
      content: doc([t('Read /workspaces/0f8fad5b-d9cb/files/secret.pdf now')]),
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    let rendered = 0
    ExportPdfService.generate = async () => {
      rendered++
      return Buffer.from('PDF')
    }
    for (const layout of ['legacy', 'pilot']) {
      process.env.PUBLICATION_LAYOUT = layout
      try {
        await new DocumentExportService().preview(a.context, a.document.id)
        assert.fail('expected rejection')
      } catch (error) {
        assert.equal((error as any).code, 'E_PUBLICATION_UNSAFE')
        assert.equal((error as any).status, 422)
        assert.include((error as Error).message, 'body[0].content[0].text')
        assert.notInclude((error as Error).message, 'secret.pdf')
      }
    }
    delete process.env.PUBLICATION_LAYOUT
    assert.equal(rendered, 0)
  })

  test('ambiguous prose is only a warning and still renders, unchanged', async ({ assert }) => {
    const a = await account()
    await new VersionService().save(a.context, a.document.id, {
      content: doc([t('Results have not been independently measured [TODO confirm].')]),
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    let sent = ''
    ExportPdfService.generate = async (data) => {
      sent = JSON.stringify(data)
      return Buffer.from('PDF')
    }
    await new DocumentExportService().preview(a.context, a.document.id)
    assert.include(sent, 'not been independently measured [TODO confirm].')
  })
})
