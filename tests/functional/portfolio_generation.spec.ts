/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentVersion from '#models/document_version'
import PortfolioRenderService from '#services/canvas/portfolio/portfolio_render_service'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { canvasOptionsSchema } from '../../shared/canvas/academic/options.ts'
import { walkNodes, type TextFrame } from '../../shared/canvas/model.ts'
import { citationNumbers } from '../../shared/canvas/portfolio/citations.ts'
import { entryOverBudget, type EntryPage } from '../../shared/canvas/portfolio/content.ts'
import { reset } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

const defaults = canvasOptionsSchema.parse({})
type G = Awaited<ReturnType<typeof portfolioGeneratable>>

const request = (g: G, options = defaults) =>
  new CanvasGenerationService().request(g.a.context, g.a.document.id, {
    mutationId: randomUUID(),
    baseVersionId: g.baseVersionId,
    options,
  })
const run = async (g: G) => {
  await new TaskDispatchService().dispatch()
  const doc = await Document.findOrFail(g.a.document.id)
  return { doc, row: await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail() }
}
const textOf = (frame: TextFrame) => {
  const parts: string[] = []
  walkNodes(frame.doc, (n) => {
    if (n.type === 'text') parts.push(String((n as { text?: string }).text))
  })
  return parts.join('')
}

test.group('Portfolio generation', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installPortfolioModel>
  group.each.teardown(() => {
    model?.restore()
    flagsOff()
  })

  test('a request queues a portfolio run, whatever set the options name', async ({ assert }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    const { runId } = await request(
      g,
      canvasOptionsSchema.parse({ templateSet: 'academic_report', depth: 'detailed' })
    )
    const row = await CanvasGenerationRun.findOrFail(runId)
    assert.equal(row.templateSet, 'portfolio')
    assert.equal(row.pipelineVersion, 'portfolio-1')
    assert.equal(row.depth, 'detailed')
    assert.equal(row.status, 'queued')
  })

  test('executing the task saves a portfolio: a cover, then each entry with its sources page', async ({
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    await request(g)
    const { doc, row } = await run(g)
    assert.equal(row.status, 'ready')
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    assert.equal(saved.source, 'generated')
    assert.equal(saved.templateKey, 'portfolio')
    assert.equal(saved.templateVersion, 1)
    assert.deepEqual(saved.project.template, { id: 'portfolio', version: 1 })

    // cover, entry, sources, entry, sources
    const pages = await CanvasGenerationPage.query().where('runId', row.id).orderBy('pageIndex')
    assert.deepEqual(
      pages.map((p) => p.designId),
      ['cover', 'entry', 'sources', 'entry', 'sources']
    )
    assert.equal(saved.sheetCount, 5)

    // Every entry fits its slots, every row cites a document, and rows are within three to eight.
    for (const p of pages.filter((x) => x.designId === 'entry')) {
      const page = p.content as EntryPage
      assert.deepEqual(entryOverBudget(page), [])
      assert.isAtLeast(page.rows.length, 3)
      assert.isAtMost(page.rows.length, 8)
      assert.isTrue(page.rows.every((r) => r.chunks.length > 0))
      assert.equal(p.status, 'fitted')
    }

    // Footnote numbers: the sources page prints the numbers the export will give the superscripts.
    const numbers = citationNumbers(saved.project)
    assert.isAbove(numbers.size, 0)
    const sourcesFrames = saved.project.sheets[2].frames.filter(
      (f): f is TextFrame => f.kind === 'text' && f.id.includes('-sources-references-')
    )
    const printed = sourcesFrames
      .filter((f) => f.id.endsWith('-number'))
      .map((f) => Number(textOf(f)))
    assert.deepEqual(
      printed,
      [...new Set(printed)].sort((a, b) => a - b)
    )
    assert.isTrue(printed.every((n) => n >= 1 && n <= numbers.size))
    // Documents are named by file, without the extension.
    assert.match(sourcesFrames.map(textOf).join(' '), /Research summary \d/)
    assert.notMatch(sourcesFrames.map(textOf).join(' '), /\.pdf/)

    // Metrics, plan and models are recorded; the version's text is derived from the canvas.
    assert.equal(row.writerModel, 'test/canvas-writer')
    assert.equal(row.metrics!.pages, 5)
    assert.isAbove(row.metrics!.citations, 5)
    assert.equal((row.plan as { pages: unknown[] }).pages.length, 2)
    const version = await DocumentVersion.findOrFail(doc.currentVersionId!)
    assert.include(JSON.stringify(version.content), 'Cooling district 1')
  })

  test('a fixed number of entries is kept exactly', async ({ assert }) => {
    model = installPortfolioModel({ entries: 4 })
    const g = await portfolioGeneratable()
    await request(g, { ...defaults, entries: 1 })
    const { doc } = await run(g)
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    assert.equal(saved.sheetCount, 3)
    // The planner was asked again once, then the plan was cut.
    assert.equal(model.calls.filter((c) => c.kind === 'plan').length, 2)
  })

  test('a row over its space is condensed once', async ({ assert }) => {
    model = installPortfolioModel({ entries: 1, overflow: true })
    const g = await portfolioGeneratable()
    await request(g)
    const { row } = await run(g)
    const entryCalls = model.calls.filter((c) => c.kind === 'entry')
    assert.lengthOf(entryCalls, 2)
    assert.match(
      entryCalls[1].corrections.join(' '),
      /rows\[0\]\.body takes \d+ lines \(limit \d\)/
    )
    const [entry] = (
      await CanvasGenerationPage.query().where('runId', row.id).where('designId', 'entry')
    ).map((p) => p.content as EntryPage)
    assert.deepEqual(entryOverBudget(entry), [])
  })

  test('a row that stays over its space after the condense call is cut and noted', async ({
    assert,
  }) => {
    model = installPortfolioModel({ entries: 1, overflow: true, stubborn: true })
    const h = await portfolioGeneratable()
    await request(h)
    const { row: second } = await run(h)
    const [cut] = await CanvasGenerationPage.query()
      .where('runId', second.id)
      .where('designId', 'entry')
    assert.deepEqual(entryOverBudget(cut.content as EntryPage), [])
    assert.match(cut.notes.join(' '), /shortened to fit/)
  })

  test('a writer failure fails the run, keeps the previous version and shows a safe message', async ({
    assert,
  }) => {
    model = installPortfolioModel({ fail: true })
    const g = await portfolioGeneratable()
    await request(g)
    // Failures are retried by the task; run the retries out.
    for (let i = 0; i < 4; i++) await new TaskDispatchService().dispatch()
    const { doc, row } = await run(g)
    assert.equal(row.status, 'failed')
    assert.equal(doc.currentVersionId, g.baseVersionId)
    assert.equal(doc.generationStatus, 'failed')
    assert.isString(row.error)
    assert.notInclude(row.error!, 'boom')
  })

  test('the export draws the portfolio: Inter, gold superscripts and no generic sources sheet', async ({
    assert,
  }) => {
    model = installPortfolioModel({ entries: 1 })
    const g = await portfolioGeneratable()
    await request(g)
    const { doc } = await run(g)
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    const html = await new PortfolioRenderService().html(saved.project)
    assert.include(html, '@font-face{font-family:"Inter"')
    assert.include(html, 'format("truetype")')
    assert.notInclude(html, 'font-family:"Manrope"')
    assert.include(html, '<sup class="ref">1</sup>')
    assert.notInclude(html, 'class="cv-sources"')
  })
})
