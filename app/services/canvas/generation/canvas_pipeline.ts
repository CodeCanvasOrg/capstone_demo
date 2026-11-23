import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type Document from '#models/document'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun, {
  type CanvasRunMetrics,
  type CanvasRunStatus,
} from '#models/canvas_generation_run'
import CanvasService from '#services/canvas/canvas_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import RetrievalService, { type ImageEvidence } from '#services/documents/retrieval_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import TaskService, { type SourcePin, type TaskLease } from '#services/workspaces/task_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import {
  composeAcademic,
  type AcademicInput,
  type AcademicMeta,
  type Reference,
} from '../../../../shared/canvas/academic/compose.ts'
import {
  citedChunks,
  pageWords,
  type AcademicPage,
  type PagePlan,
} from '../../../../shared/canvas/academic/content.ts'
import {
  ACADEMIC_DESIGNS,
  DEPTH_TOKENS,
  type AcademicDesignId,
} from '../../../../shared/canvas/academic/designs.ts'
import {
  canvasOptionsSchema,
  type CanvasOptions,
} from '../../../../shared/canvas/academic/options.ts'
import { densityReport, type DensityReport } from '../../../../shared/canvas/density.ts'
import {
  parseCanvas,
  type CanvasDocument,
  type TipTapBlock,
} from '../../../../shared/canvas/model.ts'
import type { PipelineStage } from '../../../../shared/ops/stages.ts'
import CanvasImagePlanner, { type ImageChoice } from './canvas_image_planner.ts'
import { figureNumber, imageOnSheet, replaceSheet } from './canvas_page_sheet.ts'
import CanvasPageWriter, { type WriteContext, type Written } from './canvas_page_writer.ts'
import CanvasPlanner from './canvas_planner.ts'
import { pageQueries, type PageQuery } from './page_queries.ts'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import OutlineTemplateService from '#services/documents/outline_template_service'
import { brochureQueries } from '#services/documents/section_queries'
import { BROCHURE_TEMPLATE_ID } from '../../../../shared/templates/outlines.ts'
import type { BrochureSelection } from '../../../../shared/brochure/designs.ts'
import { composeCanvas } from '../../../../shared/canvas/compose.ts'

/** Pages written at once. Each page is its own model call, so this is the call concurrency. */
export const WRITE_CONCURRENCY = 3
export const PIPELINE_VERSION = 'canvas-academic-1'

/** Runs `work` over `items`, at most `limit` at a time, results in item order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>
) {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await work(items[i], i)
      }
    })
  )
  return out
}

/** The pipeline's progress, written as it goes: nothing here is read back by the pipeline itself. */
export interface Recorder {
  stage(status: CanvasRunStatus): Promise<void>
  plan(plan: unknown, models: { planner: string; writer: string }): Promise<void>
  pages(rows: PageRecord[]): Promise<void>
}

export type PageRecord = {
  index: number
  design: string
  status: 'pending' | 'written' | 'fitted' | 'failed'
  purpose: string
  queries: string[]
  chunkIds: string[]
  citedChunkIds: string[]
  imageIds: string[]
  content: AcademicPage | null
  wordCount: number | null
  fillRatio: number | null
  attempts: number
  notes: string[]
}

export type GenerateInput = {
  context: WorkspaceAccessContext
  documentId: string
  title: string
  brief: string
  pins: SourcePin[]
  options: CanvasOptions
  guard: () => Promise<void>
  recorder?: Recorder
}

export type Generated = {
  canvas: CanvasDocument
  plan: {
    thesis: string
    audience: string
    coverageGaps: string[]
    pages: PagePlan[]
  }
  pages: PageRecord[]
  report: DensityReport
  metrics: CanvasRunMetrics
  models: { planner: string; writer: string }
}

const NO_RECORDER: Recorder = {
  stage: async () => {},
  plan: async () => {},
  pages: async () => {},
}

const LABELS = {
  academic_report: 'Academic report',
  research_brief: 'Research brief',
  brochure: 'Report',
} as const

const STAGE: Record<CanvasRunStatus, PipelineStage | null> = {
  queued: null,
  planning: 'preparing',
  retrieving: 'retrieving',
  writing: 'drafting',
  fitting: 'validating',
  images: 'validating',
  composing: 'rendering',
  ready: null,
  failed: null,
}

/** The summaries of the pages written so far, in page order, for the next page. */
const summaries = (
  plan: PagePlan[],
  written: Map<number, Written>,
  before = Number.POSITIVE_INFINITY
) =>
  [...written.entries()]
    .filter(([i]) => i < before)
    .sort(([a], [b]) => a - b)
    .map(([i, w]) => ({ page: i + 1, title: plan[i].title, summary: w.page.summary }))

const WRITTEN_DESIGNS = (design: AcademicDesignId) =>
  design !== 'contents' && design !== 'references'

/**
 * The canvas pipeline: plan, retrieve per page, choose images, write page by page,
 * fit, place images, compose. Each stage is a method over explicit inputs, so it
 * can be run and tested alone. `generate` saves nothing (the CLI's `--dry-run`
 * is exactly this); `execute` wraps it for a queued task: progress rows, the save as
 * a normal version, the run's metrics and the claim review.
 */
export default class CanvasPipeline {
  async generate(input: GenerateInput): Promise<Generated> {
    if (input.options.templateSet === 'brochure') return this.generateBrochure(input)
    const started = performance.now()
    const { options, guard } = input
    const recorder = input.recorder ?? NO_RECORDER
    const planner = new CanvasPlanner()
    const writer = new CanvasPageWriter()
    const images = new CanvasImagePlanner()
    let tokens = 0

    // 1 Plan
    await recorder.stage('planning')
    const planned = await planner.plan({ ...input })
    tokens += planned.tokens
    const models = { planner: planned.model, writer: writer.model(options) }
    const plan = planned.pages
    await recorder.plan(
      {
        thesis: planned.thesis,
        audience: planned.audience,
        coverageGaps: planned.coverageGaps,
        pages: plan,
      },
      models
    )
    await guard()

    // 2 Retrieve, one budget per page
    await recorder.stage('retrieving')
    const toWrite = plan.map((p, i) => ({ p, i })).filter(({ p }) => WRITTEN_DESIGNS(p.design))
    const queries: PageQuery[] = pageQueries(
      toWrite.map(({ p }) => p),
      input.title,
      input.brief
    ).map((q, n) => ({ ...q, key: String(toWrite[n].i) }))
    const found = await new RetrievalService().searchPages({
      context: input.context,
      documentId: input.documentId,
      pins: input.pins,
      guard,
      pages: queries,
      tokenBudget: DEPTH_TOKENS[options.depth],
    })
    const evidence = new Map(found.map((f) => [Number(f.key), f]))
    const imageEvidence = new Map<number, ImageEvidence[]>(
      found.map((f) => [Number(f.key), f.images])
    )
    const rows = new Map<number, PageRecord>(
      plan.map((p, index) => [
        index,
        {
          index,
          design: p.design,
          status: WRITTEN_DESIGNS(p.design) ? 'pending' : 'fitted',
          purpose: p.purpose,
          queries: queries.find((q) => q.key === String(index))?.queries ?? [],
          chunkIds: evidence.get(index)?.chunks.map((c) => c.id) ?? [],
          citedChunkIds: [],
          imageIds: [],
          content: null,
          wordCount: null,
          fillRatio: null,
          attempts: 0,
          notes: [],
        },
      ])
    )
    await recorder.pages([...rows.values()])

    // 5a Choose pictures first, so a figure page's lead can say what the figure shows.
    await recorder.stage('images')
    const choices = options.images
      ? await images.select({
          context: input.context,
          documentId: input.documentId,
          options,
          pages: plan,
          evidence: imageEvidence,
          chunks: new Map(found.map((f) => [Number(f.key), f.chunks])),
          guard,
        })
      : new Map<number, ImageChoice>()
    // A figure page with no picture is laid out as plain text before it is written.
    plan.forEach((p, i) => {
      if (choices.has(i)) return
      if (p.design === 'figure_text') p.design = 'two_column'
      if (p.design === 'side_figure') p.design = 'essay'
    })
    plan.forEach((p, i) => {
      rows.get(i)!.design = p.design
    })

    // 3 Write page by page, in waves, each wave given the summaries of the waves before it.
    await recorder.stage('writing')
    const ctx: WriteContext = {
      title: input.title,
      thesis: planned.thesis,
      audience: planned.audience,
      outline: plan
        .filter((p) => p.design !== 'contents')
        .map(({ design, title, purpose }) => ({ design, title, purpose })),
      options,
      guard,
    }
    const written = new Map<number, Written>()
    const content = toWrite.filter(({ p }) => p.design !== 'title_page')
    const waves: { p: PagePlan; i: number }[][] = []
    for (let n = 0; n < content.length; n += WRITE_CONCURRENCY)
      waves.push(content.slice(n, n + WRITE_CONCURRENCY))
    const title = toWrite.find(({ p }) => p.design === 'title_page')
    // The abstract is written last, from the summaries of every page.
    if (title) waves.push([title])
    for (const wave of waves) {
      await guard()
      const earlier = summaries(plan, written)
      const results = await Promise.all(
        wave.map(({ p, i }) =>
          writer.write(
            ctx,
            p,
            i,
            evidence.get(i)?.chunks ?? [],
            p.design === 'title_page' ? earlier : earlier.filter((e) => e.page - 1 < i),
            choices.get(i)?.description
          )
        )
      )
      wave.forEach(({ i }, n) => {
        written.set(i, results[n])
        tokens += results[n].tokens
        const row = rows.get(i)!
        Object.assign(row, {
          status: 'written',
          content: results[n].page,
          attempts: results[n].attempts,
          notes: results[n].notes,
          citedChunkIds: citedChunks(results[n].page),
        })
      })
      await recorder.pages([...rows.values()])
    }

    // 4 Fit: at most one expand, condense or split per page.
    await recorder.stage('fitting')
    const label = LABELS[options.templateSet]
    const keywords = [...new Set(plan.flatMap((p) => p.keyTerms))].slice(0, 6)
    const date = DateTime.utc().toFormat('d LLLL yyyy')
    const meta: AcademicMeta = { title: input.title, label, date, keywords, references: [] }
    const fitted = new Map<number, Written[]>()
    await mapLimit(
      toWrite.filter(({ i }) => written.has(i)),
      WRITE_CONCURRENCY,
      async ({ p, i }) => {
        const w = written.get(i)!
        const more = evidence.get(i)?.extra ?? []
        const result = await writer.fit(
          ctx,
          p,
          i,
          w,
          more,
          p.design === 'title_page' ? summaries(plan, written) : summaries(plan, written, i),
          meta,
          choices.get(i)?.description,
          choices.has(i) && ACADEMIC_DESIGNS[p.design].images.length > 0
        )
        fitted.set(i, result.pages)
        tokens += result.pages.reduce((n, x) => n + x.tokens, 0) - w.tokens
      }
    )
    await guard()

    // 5b Caption and register the pictures that are still placed.
    const placed = options.images
      ? await images.place({
          context: input.context,
          documentId: input.documentId,
          options,
          pages: plan,
          evidence: imageEvidence,
          choices,
          guard,
        })
      : new Map()

    // 6 Compose
    await recorder.stage('composing')
    const inputs: AcademicInput[] = []
    const final: PageRecord[] = []
    const known = new Map<string, SourceChunk>()
    for (const c of planned.chunks) known.set(c.id, c)
    for (const e of evidence.values()) for (const c of [...e.chunks, ...e.extra]) known.set(c.id, c)
    plan.forEach((p, i) => {
      const pieces = fitted.get(i)
      const base = rows.get(i)!
      if (!pieces) {
        inputs.push({ design: p.design })
        final.push({ ...base, status: 'fitted' })
        return
      }
      pieces.forEach((piece, n) => {
        const image = n === 0 ? (placed.get(i) ?? null) : null
        inputs.push({ design: p.design, page: piece.page, image })
        final.push({
          ...base,
          status: 'fitted',
          content: piece.page,
          attempts: piece.attempts,
          notes: [...piece.notes, ...piece.page.reviewer_notes].filter(
            (note, k, all) => all.indexOf(note) === k
          ),
          citedChunkIds: citedChunks(piece.page),
          imageIds: image ? [image.imageId] : [],
          wordCount: pageWords(piece.page),
        })
      })
    })
    meta.references = referencesOf(final, known)
    const canvas = composeAcademic(inputs, meta)
    const parsed = parseCanvas(canvas)
    if (!parsed.ok)
      throw Object.assign(new Error('The composed canvas was not valid.'), {
        status: 422,
        unusableOutput: true,
      })
    const sizes = new Map<string, { width: number; height: number }>()
    for (const [i, image] of placed) {
      const choice = choices.get(i)
      if (choice) sizes.set(image.imageId, { width: choice.width, height: choice.height })
    }
    const report = densityReport(canvas, { images: sizes })
    report.pages.forEach((m, i) => {
      final[i].index = i
      final[i].fillRatio = m.fill
      if (m.words) final[i].wordCount = m.words
    })
    await recorder.pages(final)
    const metrics: CanvasRunMetrics = {
      pages: canvas.sheets.length,
      words: report.words,
      avgFill: report.avgFill,
      citations: report.citations,
      placeholders: report.placeholders,
      lowDpiImages: report.lowDpiImages,
      durationMs: Math.round(performance.now() - started),
      tokens,
    }
    return {
      canvas,
      plan: {
        thesis: planned.thesis,
        audience: planned.audience,
        coverageGaps: planned.coverageGaps,
        pages: plan,
      },
      pages: final,
      report,
      metrics,
      models,
    }
  }

  /**
   * The Brochure template set: the existing brochure writer (one call, the marketing
   * designs and their character limits), laid out as a canvas. The depth and image
   * options do not apply; the academic stages are not run.
   */
  private async generateBrochure(input: GenerateInput): Promise<Generated> {
    const started = performance.now()
    const recorder = input.recorder ?? NO_RECORDER
    const { guard, options } = input
    await recorder.stage('retrieving')
    const template = await new OutlineTemplateService().resolve(BROCHURE_TEMPLATE_ID)
    const selection: BrochureSelection = {
      source: 'ai',
      pages:
        options.pages === 'auto' ? ['auto'] : Array.from({ length: options.pages }, () => 'auto'),
    }
    const found = await new RetrievalService().searchSections({
      context: input.context,
      documentId: input.documentId,
      pins: input.pins,
      sections: brochureQueries(selection, input.title, input.brief),
      guard,
    })
    await recorder.stage('writing')
    const brochure = await new OpenRouterService().generateBrochure(
      input.title,
      input.brief,
      found.chunks,
      template.definition,
      guard,
      selection,
      found.sections
    )
    await recorder.stage('composing')
    const canvas = composeCanvas(brochure.document as { content?: TipTapBlock[] }, brochure.designs)
    const report = densityReport(canvas)
    const pages: PageRecord[] = canvas.sheets.map((_, index) => ({
      index,
      design: brochure.designs[index] ?? 'article',
      status: 'fitted',
      purpose: '',
      queries: [],
      chunkIds: [],
      citedChunkIds: [],
      imageIds: [],
      content: null,
      wordCount: report.pages[index].words,
      fillRatio: null,
      attempts: 1,
      notes: index === 0 ? brochure.notes : [],
    }))
    await recorder.pages(pages)
    const models = { planner: config.model, writer: config.model }
    await recorder.plan({ thesis: '', audience: '', coverageGaps: [], pages: [] }, models)
    return {
      canvas,
      plan: { thesis: '', audience: '', coverageGaps: [], pages: [] },
      pages,
      report,
      models,
      metrics: {
        pages: canvas.sheets.length,
        words: report.words,
        avgFill: 0,
        citations: report.citations,
        placeholders: report.placeholders,
        lowDpiImages: 0,
        durationMs: Math.round(performance.now() - started),
        tokens: 0,
      },
    }
  }

  /**
   * One page of the current canvas, again: rewritten from fresh retrieval, or the
   * stored page made deeper or shorter. Only that sheet changes; the other sheets
   * (which the author may have edited) are carried over exactly.
   */
  async regenerate(
    input: GenerateInput & {
      run: CanvasGenerationRun
      baseVersionId: string | null
      index: number
      mode: 'rewrite' | 'expand' | 'condense'
    }
  ): Promise<Pick<Generated, 'canvas' | 'metrics'>> {
    const started = performance.now()
    const { options, guard, index, mode } = input
    const recorder = input.recorder ?? NO_RECORDER
    const previous = await CanvasGenerationRun.query()
      .where({ documentId: input.documentId, status: 'ready' })
      .whereNot('id', input.run.id)
      .orderBy('createdAt', 'desc')
      .firstOrFail()
    const stored = await CanvasGenerationPage.query()
      .where('runId', previous.id)
      .orderBy('pageIndex')
    const current = input.baseVersionId
      ? await new CanvasService().forVersion(input.baseVersionId)
      : null
    const row = stored.find((r) => r.pageIndex === index)
    if (!current || !row || stored.length !== current.project.sheets.length)
      throw Object.assign(new Error('The pages changed after they were generated.'), {
        status: 422,
        unusableOutput: true,
      })
    const writer = new CanvasPageWriter()
    const content = row.content as AcademicPage | null
    const planned = (previous.plan as { pages?: PagePlan[] } | null)?.pages ?? []
    const page: PagePlan = {
      design: row.designId as AcademicDesignId,
      title: content?.title ?? planned[index]?.title ?? `Page ${index + 1}`,
      purpose: row.purpose,
      questions: row.queries.slice(1),
      keyTerms: planned[index]?.keyTerms ?? [],
      wantsImage: false,
    }
    // A fixed page count: a regenerated page never turns into two.
    const ctx: WriteContext = {
      title: input.title,
      thesis: (previous.plan as { thesis?: string } | null)?.thesis ?? '',
      audience: (previous.plan as { audience?: string } | null)?.audience ?? '',
      outline: stored.map((r) => ({
        design: r.designId as AcademicDesignId,
        title: (r.content as AcademicPage | null)?.title ?? r.purpose,
        purpose: r.purpose,
      })),
      options: { ...options, pages: 8 },
      guard,
    }
    const meta: AcademicMeta = {
      title: input.title,
      label: LABELS[options.templateSet],
      keywords: [],
      references: [],
    }
    const earlier = stored
      .filter((r) => r.pageIndex < index && r.content)
      .map((r) => ({
        page: r.pageIndex + 1,
        title: (r.content as AcademicPage).title,
        summary: (r.content as AcademicPage).summary,
      }))
    const image = await imageOnSheet(
      input.context.workspaceId,
      input.documentId,
      current.project,
      index
    )
    const withImage = !!image && ACADEMIC_DESIGNS[page.design].images.length > 0
    await recorder.stage('retrieving')
    const [found] = await new RetrievalService().searchPages({
      context: input.context,
      documentId: input.documentId,
      pins: input.pins,
      guard,
      pages: [{ key: '0', label: page.title, queries: row.queries }],
      tokenBudget: DEPTH_TOKENS[options.depth],
    })
    const chunks = found?.chunks ?? []
    await recorder.stage('writing')
    let written: Written
    if (mode === 'rewrite' || !content) {
      const first = await writer.write(ctx, page, index, chunks, earlier)
      await recorder.stage('fitting')
      const fitted = await writer.fit(
        ctx,
        page,
        index,
        first,
        found?.extra ?? [],
        earlier,
        meta,
        undefined,
        withImage
      )
      written = fitted.pages[0]
    } else {
      await recorder.stage('fitting')
      const base: Written = {
        page: content,
        attempts: row.attempts,
        tokens: 0,
        notes: row.notes,
        supplied: chunks,
      }
      written = await writer.adjust(
        ctx,
        page,
        index,
        base,
        found?.extra ?? [],
        earlier,
        mode,
        meta,
        undefined,
        withImage
      )
    }
    await recorder.stage('composing')
    const figure = figureNumber(
      stored.map((r) => ({
        index: r.pageIndex,
        design: r.designId,
        imageIds: r.imageIds,
      })),
      index
    )
    const canvas = replaceSheet(
      current.project,
      index,
      { design: page.design, page: written.page, image },
      meta,
      figure
    )
    const report = densityReport(canvas)
    await recorder.pages(
      stored.map((r) => ({
        index: r.pageIndex,
        design: r.designId,
        status: 'fitted' as const,
        purpose: r.purpose,
        queries: r.queries,
        chunkIds: r.pageIndex === index ? chunks.map((c) => c.id) : r.chunkIds,
        citedChunkIds: r.pageIndex === index ? citedChunks(written.page) : r.citedChunkIds,
        imageIds: r.imageIds,
        content: r.pageIndex === index ? written.page : (r.content as AcademicPage | null),
        wordCount: r.pageIndex === index ? report.pages[index].words : r.wordCount,
        fillRatio:
          r.pageIndex === index
            ? report.pages[index].fill
            : r.fillRatio === null
              ? null
              : Number(r.fillRatio),
        attempts: r.pageIndex === index ? written.attempts : r.attempts,
        notes: r.pageIndex === index ? written.notes : r.notes,
      }))
    )
    await recorder.plan(previous.plan, {
      planner: previous.plannerModel,
      writer: previous.writerModel,
    })
    return {
      canvas,
      metrics: {
        pages: canvas.sheets.length,
        words: report.words,
        avgFill: report.avgFill,
        citations: report.citations,
        placeholders: report.placeholders,
        lowDpiImages: report.lowDpiImages,
        durationMs: Math.round(performance.now() - started),
        tokens: written.tokens,
      },
    }
  }

  /** The task path: runs the pipeline with progress rows, then saves the result as a new version. */
  async execute(input: {
    lease: TaskLease
    document: Document
    title: string
    brief: string
    pins: SourcePin[]
    generationInput: (doc: Document) => unknown
    review: (versionId: string, content: unknown) => Promise<void>
  }) {
    const { lease, document } = input
    const tasks = new TaskService()
    const options = canvasOptionsSchema.parse(lease.task.payload.canvas ?? {})
    const run = await CanvasGenerationRun.query().where('taskId', lease.task.id).firstOrFail()
    const recorder = new RunRecorder(run, lease, tasks)
    await recorder.start()
    const common = {
      context: lease.context,
      documentId: document.id,
      title: input.title,
      brief: input.brief,
      pins: input.pins,
      options,
      guard: () => tasks.check(lease),
      recorder,
    }
    const target = lease.task.payload.canvasPage
    const generated: Pick<Generated, 'canvas' | 'metrics'> = target
      ? await this.regenerate({
          ...common,
          run,
          baseVersionId: lease.task.payload.baseVersionId ?? null,
          index: Number(target.index),
          mode: target.mode as 'rewrite' | 'expand' | 'condense',
        })
      : await this.generate(common)
    await tasks.check(lease)
    const saved = await new CanvasService().saveGenerated(lease.context, document.id, {
      canvas: generated.canvas,
      baseVersionId: lease.task.payload.baseVersionId ?? null,
      mutationId: lease.task.mutationId,
      generationRunId: run.id,
    })
    const accepted = await tasks.finish(lease, async (trx) => {
      await trx
        .from('canvas_generation_runs')
        .where({ id: run.id })
        .update({
          status: 'ready',
          result_version_id: saved.version.id,
          metrics: JSON.stringify(generated.metrics),
          updated_at: DateTime.utc().toSQL(),
        })
      await trx
        .from('documents')
        .where({
          id: document.id,
          workspace_id: lease.context.workspaceId,
          generation_task_id: lease.task.id,
        })
        .update({
          // The draft is shown right away; issue checks run next while the editor stays usable.
          generation_status: 'checking_issues',
          generation_error: null,
          generation_lease_at: DateTime.utc().toSQL(),
        })
      return { versionId: saved.version.id, runId: run.id }
    })
    if (!target) await this.rememberOptions(lease.context, document.id, options)
    await input.review(String(accepted.versionId), saved.version.content)
  }

  /** So the dialog opens with what was last chosen. Never fails generation. */
  private async rememberOptions(
    context: WorkspaceAccessContext,
    documentId: string,
    options: CanvasOptions
  ) {
    try {
      const layouts = new LayoutSelectionService()
      const layout = await layouts.peek(context.workspaceId, documentId)
      await layouts.save(context, documentId, {
        templateId: layout.templateId,
        templateVersion: layout.templateVersion,
        brandId: layout.brandId,
        brandVersion: layout.brandVersion,
        options: { ...layout.options, canvas: options },
        baseRevision: layout.revision,
        presetId: layout.presetId,
      })
    } catch (error) {
      logger.warn({ err: error, documentId }, 'The canvas generation options were not saved')
    }
  }
}

/** Numbered sources in order of first citation, one entry per file with the pages cited. */
export function referencesOf(
  pages: PageRecord[],
  known: ReadonlyMap<string, SourceChunk>
): Reference[] {
  const files = new Map<string, Set<number>>()
  for (const page of pages)
    for (const id of page.citedChunkIds) {
      const chunk = known.get(id)
      if (!chunk) continue
      const set = files.get(chunk.fileName) ?? new Set<number>()
      if (chunk.pageNumber) set.add(chunk.pageNumber)
      files.set(chunk.fileName, set)
    }
  return [...files.entries()].map(([label, set]) => {
    const list = [...set].sort((a, b) => a - b)
    return {
      label,
      ...(list.length ? { pages: `${list.length > 1 ? 'pp.' : 'p.'} ${list.join(', ')}` } : {}),
    }
  })
}

/** Writes the run's progress to the database and the task's current stage. */
export class RunRecorder implements Recorder {
  constructor(
    private run: CanvasGenerationRun,
    private lease: TaskLease,
    private tasks: TaskService
  ) {}

  async start() {
    this.run.merge({ status: 'planning', error: null })
    await this.run.save()
  }

  async stage(status: CanvasRunStatus) {
    this.run.merge({ status })
    await this.run.save()
    const stage = STAGE[status]
    if (stage) await this.tasks.recordStage(this.lease, stage)
  }

  async plan(plan: unknown, models: { planner: string; writer: string }) {
    this.run.merge({ plan, plannerModel: models.planner, writerModel: models.writer })
    await this.run.save()
  }

  /** Replaces the run's page rows: indexes shift when a page is split or added. */
  async pages(rows: PageRecord[]) {
    await writePageRows(this.run, rows)
  }
}

export async function writePageRows(run: CanvasGenerationRun, rows: PageRecord[]) {
  await db.transaction(async (trx) => {
    await CanvasGenerationPage.query({ client: trx }).where('runId', run.id).delete()
    for (const row of rows)
      await CanvasGenerationPage.create(
        {
          runId: run.id,
          workspaceId: run.workspaceId,
          pageIndex: row.index,
          designId: row.design,
          status: row.status,
          purpose: row.purpose,
          queries: row.queries,
          chunkIds: row.chunkIds,
          citedChunkIds: row.citedChunkIds,
          imageIds: row.imageIds,
          content: row.content,
          wordCount: row.wordCount,
          fillRatio: row.fillRatio === null ? null : String(Math.min(row.fillRatio, 9.999)),
          attempts: Math.max(row.attempts, 1),
          notes: row.notes,
        },
        { client: trx }
      )
  })
}
