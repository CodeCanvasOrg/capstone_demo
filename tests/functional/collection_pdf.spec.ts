import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { account, reset } from '../helpers/workspaces.ts'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import DocumentService from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import CollectionService from '#services/layout/collection_service'
import CollectionExportService from '#services/exports/collection_export_service'
import { inspectPdf } from '#services/exports/pdf_inspector'

/**
 * Real Chromium + PyMuPDF composition of a collection. Opt in with
 * LAYOUT_NATIVE_PDF=1; once enabled a missing browser or interpreter fails.
 */
const enabled = process.env.LAYOUT_NATIVE_PDF === '1'

async function entry(a: Awaited<ReturnType<typeof account>>, title: string) {
  const doc = await new DocumentService().create(a.context, { title, sourceMode: 'input_only' }, [])
  await new DocumentService().update(a.context, doc.id, {
    title,
    projectInformation: Object.fromEntries(INFORMATION_FIELDS.map((k) => [k, 'x'])),
    metadataRevision: 0,
  })
  await new VersionService().save(a.context, doc.id, {
    baseVersionId: null,
    mutationId: randomUUID(),
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
        { type: 'paragraph', content: [{ type: 'text', text: `${title} summary.` }] },
      ],
    },
  })
  return doc
}

const inspect = async (pdf: Buffer) => {
  const file = path.join(await mkdtemp(path.join(tmpdir(), 'collection-test-')), 'out.pdf')
  await writeFile(file, pdf)
  return inspectPdf(file)
}

test.group('Collection PDF composition', (group) => {
  group.each.setup(reset)

  test('preview composes cover, introduction, contents, entries and back cover', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'Alpha rollout')
    const two = await entry(a, 'Beta rollout')
    const collection = await new CollectionService().create(a.context, {
      name: 'Selected work',
      entryIds: [one.id, two.id],
      wrapper: { about: 'We build document AI.', contact: { email: 'hi@example.com' } },
    })
    const report = await inspect(
      await new CollectionExportService().render(a.context, collection.id, { final: false })
    )
    for (const text of [
      'Selected work',
      'We build document AI.',
      'Contents',
      'Alpha rollout',
      'Beta rollout',
      'hi@example.com',
    ])
      assert.include(report.text, text)
    assert.isAtLeast(report.pages, 6)
  }).skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('the final download needs a current approval and carries no draft watermark', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'Alpha rollout')
    const service = new CollectionService()
    const collection = await service.create(a.context, {
      name: 'Selected work',
      entryIds: [one.id],
      wrapper: {},
    })
    await assert.rejects(
      () => new CollectionExportService().render(a.context, collection.id, { final: true }),
      /approval is missing/i
    )
    await service.approve(a.context, collection.id, collection.manifestHash)
    const report = await inspect(
      await new CollectionExportService().render(a.context, collection.id, { final: true })
    )
    assert.notInclude(report.text, 'NOT APPROVED')
    assert.include(report.text, 'Alpha rollout')
  }).skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')
})
