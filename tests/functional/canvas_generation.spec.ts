/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentVersion from '#models/document_version'
import WorkspaceTask from '#models/workspace_task'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import OpenRouterService from '#services/open_router_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { documentFromPages } from '../../shared/brochure/content.ts'
import type { DesignId } from '../../shared/brochure/designs.ts'
import { samples } from '../fixtures/brochure/pages.ts'
import { canvasOptionsSchema } from '../../shared/canvas/academic/options.ts'
import { wordRange, type AcademicDesignId } from '../../shared/canvas/academic/designs.ts'
import { densityReport, pageProblems } from '../../shared/canvas/density.ts'
import { walkNodes, type CanvasDocument } from '../../shared/canvas/model.ts'
import { reset } from '../helpers/workspaces.ts'
import { flagsOff, generatable, installModel } from '../helpers/canvas_generation.ts'

const defaults = canvasOptionsSchema.parse({})

async function request(g: Awaited<ReturnType<typeof generatable>>, options = defaults) {
  const service = new CanvasGenerationService()
  return service.request(g.a.context, g.a.document.id, {
    mutationId: randomUUID(),
    baseVersionId: g.baseVersionId,
    options,
  })
}
const run = async (g: Awaited<ReturnType<typeof generatable>>) => {
  await new TaskDispatchService().dispatch()
  const doc = await Document.findOrFail(g.a.document.id)
  return { doc, row: await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail() }
}
const canvasOf = async (versionId: string) =>
  await DocumentCanvas.query().where('versionId', versionId).firstOrFail()

test.group('Canvas generation', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installModel>
  group.each.teardown(() => {
    model?.restore()
    flagsOff()
  })

  test('a request queues a generate task with a canvas target and a queued run', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const { taskId, runId } = await request(g, { ...defaults, depth: 'detailed', pages: 8 })
    const task = await WorkspaceTask.findOrFail(taskId)
    assert.equal(task.kind, 'generate')
    assert.equal(task.payload.target, 'canvas')
    assert.deepInclude(task.payload.canvas as object, { depth: 'detailed', pages: 8 })
    const row = await CanvasGenerationRun.findOrFail(runId)
    assert.equal(row.status, 'queued')
    assert.equal(row.depth, 'detailed')
    assert.equal(row.baseVersionId, g.baseVersionId)
    assert.equal((await Document.findOrFail(g.a.document.id)).generationStatus, 'processing')
  })

  test('executing the task saves a generated canvas version with filled, cited pages', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    await request(g)
    const { doc, row } = await run(g)

    assert.equal(row.status, 'ready')
    assert.notEqual(doc.currentVersionId, g.baseVersionId)
    assert.equal(row.resultVersionId, doc.currentVersionId)
    assert.equal(doc.generationStatus, 'ready')
    const saved = await canvasOf(doc.currentVersionId!)
    assert.equal(saved.source, 'generated')
    assert.equal(saved.generationRunId, row.id)

    // title, contents, four content pages, references
    assert.equal(saved.sheetCount, 7)
    const report = densityReport(saved.project)
    assert.deepEqual(
      report.pages.map((p) => p.kind),
      ['title', 'contents', 'content', 'content', 'content', 'content', 'references']
    )
    for (const page of report.pages.filter((p) => p.kind === 'content')) {
      assert.deepEqual(pageProblems(page), [], `page ${page.index + 1}`)
      assert.isAtLeast(page.citations, 2)
    }
    assert.isAbove(report.avgFill, 0.7)
    assert.isAtMost(report.avgFill, 1)

    // Every citation is a chunk the model was given.
    const supplied = new Set<string>(g.sources.map((s) => s.chunkId))
    const cited = new Set<string>()
    for (const sheet of saved.project.sheets)
      for (const f of sheet.frames)
        if (f.kind === 'text')
          walkNodes(f.doc, (n: any) => {
            if (n.type === 'sourceCitation') cited.add(n.attrs.sourceChunkId)
          })
    assert.isAbove(cited.size, 0)
    for (const id of cited) assert.isTrue(supplied.has(id), id)

    // The run records its plan, models and metrics, and one row per page.
    assert.equal(row.plannerModel, 'test/canvas-planner')
    assert.equal(row.writerModel, 'test/canvas-writer')
    assert.equal(row.metrics!.pages, 7)
    assert.isAbove(row.metrics!.words, 1000)
    assert.isAbove(row.metrics!.tokens, 0)
    assert.equal((row.plan as { pages: unknown[] }).pages.length, 7)
    const pages = await CanvasGenerationPage.query().where('runId', row.id).orderBy('pageIndex')
    assert.lengthOf(pages, 7)
    assert.equal(pages[0].designId, 'title_page')
    assert.equal(pages[2].status, 'fitted')
    assert.isAbove(pages[2].citedChunkIds.length, 1)
    assert.isAbove(pages[2].chunkIds.length, 0)

    // The version's text is derived from the canvas, like any canvas save.
    const version = await DocumentVersion.findOrFail(doc.currentVersionId!)
    assert.include(JSON.stringify(version.content), 'Built surfaces absorb')
    assert.include(JSON.stringify(version.content), 'sourceCitation')
  })

  test('the writer model writes the pages; concise depth uses the planner model', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    await request(g)
    await run(g)
    assert.isAtLeast(model.calls.length, 5)
    assert.isTrue(model.calls.every((c) => c.model === 'test/canvas-writer'))
    assert.equal(model.plans[0].model, 'test/canvas-planner')
    model.calls.length = 0
    await db.rawQuery('TRUNCATE canvas_generation_runs CASCADE')
    const doc = await Document.findOrFail(g.a.document.id)
    await new CanvasGenerationService().request(g.a.context, g.a.document.id, {
      mutationId: randomUUID(),
      baseVersionId: doc.currentVersionId,
      options: { ...defaults, depth: 'concise' },
    })
    await new TaskDispatchService().dispatch()
    assert.isTrue(model.calls.every((c) => c.model === 'test/canvas-planner'))
  })

  test('each page is written from its own evidence, in waves, with earlier summaries', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    await request(g)
    await run(g)
    const designs = model.calls.map((c) => c.design)
    // The abstract is written last, after every content page.
    assert.equal(designs.at(-1), 'title_page')
    assert.deepEqual(designs.slice(0, 4).sort(), [
      'conclusion',
      'data_findings',
      'essay',
      'two_column',
    ])
  })

  test('a thin first draft gets exactly one expand call', async ({ assert }) => {
    model = installModel({ first: { two_column: 0.3 } })
    const g = await generatable()
    await request(g)
    const { row } = await run(g)
    assert.equal(row.status, 'ready')
    const twoColumn = model.calls.filter((c) => c.design === 'two_column')
    assert.lengthOf(twoColumn, 2)
    assert.match(twoColumn[1].corrections.join('\n'), /fills \d+% of its layout/)
    assert.lengthOf(
      model.calls.filter((c) => c.design === 'essay'),
      1
    )
    const page = await CanvasGenerationPage.query()
      .where('runId', row.id)
      .where('designId', 'two_column')
      .firstOrFail()
    assert.equal(page.attempts, 2)
  })

  test('an overflowing essay continues on a second page of the same design', async ({ assert }) => {
    model = installModel({
      first: { essay: 1.35 },
      designs: ['essay', 'data_findings', 'two_column', 'conclusion'],
    })
    const g = await generatable()
    await request(g)
    const { row, doc } = await run(g)
    assert.equal(row.status, 'ready')
    // Splitting needs no model call.
    assert.lengthOf(
      model.calls.filter((c) => c.design === 'essay'),
      1
    )
    const saved = await canvasOf(doc.currentVersionId!)
    assert.equal(saved.sheetCount, 8)
    const titles = saved.project.sheets.map((s) =>
      JSON.stringify(s.frames.find((f) => f.id.endsWith('-ttl')))
    )
    assert.isTrue(titles.some((t) => t.includes('(continued)')))
    const report = densityReport(saved.project)
    assert.isAtMost(Math.max(...report.pages.map((p) => p.maxFrameFill ?? 0)), 1)
  })

  test('an overflowing page that cannot split is condensed once', async ({ assert }) => {
    model = installModel({
      first: { data_findings: 1.8 },
      designs: ['essay', 'key_concepts', 'data_findings', 'conclusion'],
    })
    const g = await generatable()
    await request(g)
    const { row } = await run(g)
    assert.equal(row.status, 'ready')
    const calls = model.calls.filter((c) => c.design === 'data_findings')
    assert.lengthOf(calls, 2)
    assert.match(calls[1].corrections.join('\n'), /exceeds its layout/)
  })

  test('a fixed page count is kept exactly, with no continuation pages', async ({ assert }) => {
    model = installModel({ first: { essay: 1.8 }, designs: ['essay', 'two_column', 'conclusion'] })
    const g = await generatable()
    await request(g, { ...defaults, pages: 8 })
    // 8 pages = title, contents, five content pages, references: the plan gave three, repaired to what it gave.
    const { row, doc } = await run(g)
    assert.equal(row.status, 'ready')
    const saved = await canvasOf(doc.currentVersionId!)
    // The essay was condensed or trimmed instead of continuing.
    assert.notInclude(JSON.stringify(saved.project), '(continued)')
    const report = densityReport(saved.project)
    assert.isAtMost(Math.max(...report.pages.map((p) => p.maxFrameFill ?? 0)), 1)
  })

  test('a plan that breaks the template set is asked again once and then repaired', async ({
    assert,
  }) => {
    model = installModel({ designs: ['essay', 'essay'] })
    const g = await generatable()
    await request(g)
    const { row, doc } = await run(g)
    assert.equal(row.status, 'ready')
    assert.lengthOf(model.plans, 2)
    assert.match(model.plans[1].corrections.join(' '), /content pages/)
    // Repaired: the last page is a conclusion.
    const plan = (row.plan as { pages: { design: AcademicDesignId }[] }).pages
    assert.equal(plan.at(-2)?.design, 'conclusion')
    assert.equal(plan.at(-1)?.design, 'references')
    assert.equal((await canvasOf(doc.currentVersionId!)).source, 'generated')
  })

  test('uncited paragraphs are corrected with the problem named', async ({ assert }) => {
    model = installModel()
    const g = await generatable()
    // First answer cites nothing; the corrected one does.
    const proto = (await import('#services/open_router_service')).default.prototype
    const inner = proto.writeCanvasPage
    let first = true
    proto.writeCanvasPage = async function (input, guard) {
      const page = await inner.call(this, input, guard)
      if (first && page.design === 'essay') {
        first = false
        page.sections.forEach((s) => s.paragraphs.forEach((p) => (p.chunks = [])))
      }
      return page
    }
    await request(g)
    const { row } = await run(g)
    assert.equal(row.status, 'ready')
    const essay = model.calls.filter((c) => c.design === 'essay')
    assert.lengthOf(essay, 2)
    assert.match(essay[1].corrections.join('\n'), /uncited/)
  })

  test('a writer failure fails the run, keeps the previous version and shows a safe message', async ({
    assert,
  }) => {
    model = installModel({ fail: 'two_column' })
    const g = await generatable()
    await request(g)
    // Failures are retried by the task; run the retries out.
    for (let i = 0; i < 4; i++) await new TaskDispatchService().dispatch()
    const doc = await Document.findOrFail(g.a.document.id)
    const row = await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail()
    assert.equal(row.status, 'failed')
    assert.isString(row.error)
    assert.notInclude(row.error!, 'boom')
    assert.equal(doc.currentVersionId, g.baseVersionId)
    assert.equal(doc.generationStatus, 'failed')
    assert.equal((await DocumentCanvas.query().where('source', 'generated')).length, 0)
    // The failed run no longer blocks a new one.
    model.restore()
    model = installModel()
    const doc2 = await Document.findOrFail(g.a.document.id)
    await new CanvasGenerationService().request(g.a.context, g.a.document.id, {
      mutationId: randomUUID(),
      baseVersionId: doc2.currentVersionId,
      options: defaults,
    })
    await new TaskDispatchService().dispatch()
    const latest = await CanvasGenerationRun.query()
      .where('documentId', doc.id)
      .orderBy('createdAt', 'desc')
      .firstOrFail()
    assert.equal(latest.status, 'ready')
  })

  test('a stale base version and a second active run are refused', async ({ assert }) => {
    model = installModel()
    const g = await generatable()
    const service = new CanvasGenerationService()
    await assert.rejects(
      () =>
        service.request(g.a.context, g.a.document.id, {
          mutationId: randomUUID(),
          baseVersionId: randomUUID(),
          options: defaults,
        }),
      /Save and reload/
    )
    await request(g)
    await assert.rejects(() => request(g), /already|identity|Save and reload/)
    assert.equal((await CanvasGenerationRun.query().where('documentId', g.a.document.id)).length, 1)
  })

  test('with the flag off, nothing is requested', async ({ assert }) => {
    model = installModel()
    const g = await generatable()
    env.set('CANVAS_GENERATION', undefined as never)
    await assert.rejects(() => request(g), /Resource unavailable/)
    env.set('CANVAS_GENERATION', 'on')
    env.set('CANVAS_EDITOR', undefined as never)
    await assert.rejects(() => request(g), /Resource unavailable/)
  })

  test('an ordinary regeneration of a canvas document follows the canvas pipeline when it is on', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const GenerationService = (await import('#services/documents/generation_service')).default
    const task = await new GenerationService().request(
      g.a.context,
      g.a.document.id,
      randomUUID(),
      g.baseVersionId
    )
    assert.equal(task.payload.target, 'canvas')
    assert.deepEqual(task.payload.canvas, defaults)
    assert.exists(await CanvasGenerationRun.query().where('taskId', task.id).first())
  })

  test('the writer is told the design, its word range and the pages around it', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    await request(g)
    const proto = (await import('#services/open_router_service')).default.prototype
    const seen: Record<string, any> = {}
    const inner = proto.writeCanvasPage
    proto.writeCanvasPage = async function (input, guard) {
      const payload = JSON.parse(input.user)
      seen[payload.page.design] = payload
      return inner.call(this, input, guard)
    }
    await run(g)
    const range = wordRange('essay', 'standard')
    assert.deepEqual(seen.essay.page.words, { min: range.min, max: range.max })
    assert.equal(seen.essay.thesis, 'Combined heat programmes outperform single measures.')
    assert.isAbove(seen.essay.plan.length, 5)
    assert.deepEqual(seen.essay.earlierPages, [])
    // A later page is told what the earlier ones established.
    assert.isAbove(seen.conclusion.earlierPages.length, 0)
    assert.include(JSON.stringify(seen.conclusion.earlierPages), 'page argues one point')
    // The abstract sees every page.
    assert.isAtLeast(seen.title_page.earlierPages.length, 4)
    assert.include(seen.essay.sources, 'Source chunk ID')
  })
})

test.group('Canvas generation: brochure set', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installModel>
  const proto = OpenRouterService.prototype
  const original = proto.generateBrochure
  group.each.teardown(() => {
    proto.generateBrochure = original
    model?.restore()
    flagsOff()
  })

  test('the Brochure template set uses the existing brochure writer and lays it out', async ({
    assert,
  }) => {
    model = installModel()
    const designs: DesignId[] = ['cover', 'offer', 'contact']
    proto.generateBrochure = async () => ({
      document: documentFromPages(designs.map((d) => samples[d])).document as never,
      designs,
      notes: ['Check the offer figures.'],
    })
    const g = await generatable()
    await request(g, { ...defaults, templateSet: 'brochure' })
    const { row, doc } = await run(g)
    assert.equal(row.status, 'ready')
    assert.lengthOf(model.plans, 0)
    assert.lengthOf(model.calls, 0)
    const saved = await canvasOf(doc.currentVersionId!)
    assert.equal(saved.source, 'generated')
    assert.equal(saved.sheetCount, 3)
    const pages = await CanvasGenerationPage.query().where('runId', row.id).orderBy('pageIndex')
    assert.deepEqual(
      pages.map((p) => p.designId),
      designs
    )
    assert.deepEqual(pages[0].notes, ['Check the offer figures.'])
  })
})

export type { CanvasDocument }
