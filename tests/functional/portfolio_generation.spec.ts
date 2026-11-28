/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import PublicationContentService from '#services/documents/publication_content_service'
import type { PublicationDocument } from '../../shared/publication/content.ts'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentVersion from '#models/document_version'
import PortfolioRenderService from '#services/canvas/portfolio/portfolio_render_service'
import GenerationService from '#services/documents/generation_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { canvasOptionsSchema } from '../../shared/canvas/options.ts'
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

  test('an ordinary regeneration with stored legacy options follows the portfolio pipeline', async ({
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    // Stored the way CanvasPipeline.rememberOptions saves them: the retired set is still read.
    const layouts = new LayoutSelectionService()
    const layout = await layouts.peek(g.a.context.workspaceId, g.a.document.id)
    await layouts.save(g.a.context, g.a.document.id, {
      templateId: layout.templateId,
      templateVersion: layout.templateVersion,
      brandId: layout.brandId,
      brandVersion: layout.brandVersion,
      options: {
        ...layout.options,
        canvas: {
          profile: 'academic',
          templateSet: 'academic_report',
          depth: 'standard',
          pages: 'auto',
        },
      },
      baseRevision: layout.revision,
      presetId: layout.presetId,
    })
    const task = await new GenerationService().request(
      g.a.context,
      g.a.document.id,
      randomUUID(),
      g.baseVersionId
    )
    const payload = task.payload as { target: string; canvas: { templateSet: string } }
    assert.equal(payload.target, 'canvas')
    assert.equal(payload.canvas.templateSet, 'portfolio')
    const row = await CanvasGenerationRun.query().where('taskId', task.id).firstOrFail()
    assert.equal(row.templateSet, 'portfolio')
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

  test('a document with publication metadata saves its generated portfolio, the hero rebound to the cover', async ({
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    // A case study written by the publication flow: its hero and sections point at blocks of the
    // text version (valid there), none of which survive into the generated canvas.
    const base = await DocumentVersion.findOrFail(g.baseVersionId)
    const textVersion = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Old title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Old summary of the case study.' }] },
      ],
    } as PublicationDocument
    const identified = new PublicationContentService().assignIds(textVersion, 'text-version')
    const [titleId, summaryId] = identified.content.map((block) => block.attrs!.nodeId as string)
    await db
      .from('document_versions')
      .where({ id: base.id })
      .update({
        content: JSON.stringify({
          ...identified,
          attrs: {
            publication: {
              schemaVersion: 1,
              docType: 'case_study',
              hero: { title: { nodeId: titleId }, summary: { nodeId: summaryId } },
              sections: [{ id: randomUUID(), type: 'narrative', nodeIds: [summaryId] }],
            },
          },
        }),
      })
    await request(g)
    const { doc, row } = await run(g)
    assert.equal(row.status, 'ready', row.error ?? '')
    const version = await DocumentVersion.findOrFail(doc.currentVersionId!)
    const saved = version.content as {
      attrs: { publication: { hero: { title: { nodeId: string }; summary?: { nodeId: string } } } }
      content: { type: string; attrs?: { nodeId?: string } }[]
    }
    const ids = new Set(saved.content.map((block) => block.attrs?.nodeId))
    const hero = saved.attrs.publication.hero
    assert.isTrue(ids.has(hero.title.nodeId))
    if (hero.summary) assert.isTrue(ids.has(hero.summary.nodeId))
    // The title is the cover's title frame, not its eyebrow or an entry title.
    const canvas = await DocumentCanvas.query().where('versionId', version.id).firstOrFail()
    const coverTitle = canvas.project.sheets[0].frames.find((f) => f.id === 's0-cover-title')
    assert.exists(coverTitle)
    const block = saved.content.find((b) => b.attrs?.nodeId === hero.title.nodeId) as {
      content?: unknown
    }
    const frameBlock = (coverTitle as TextFrame).doc[0] as { content?: unknown }
    assert.deepEqual(block.content, frameBlock.content)
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
