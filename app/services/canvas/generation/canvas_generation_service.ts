import env from '#start/env'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import CanvasGenerationPage from '#models/canvas_generation_page'
import DocumentImage from '#models/document_image'
import { FIGURE_PLACEHOLDER, PLACEHOLDER } from '../../../../shared/brochure/content.ts'
import { SLOTS } from '../../../../shared/canvas/academic/designs.ts'
import { printDpi } from '../../../../shared/canvas/image_rules.ts'
import CanvasGenerationRun, { ACTIVE_RUN_STATUSES } from '#models/canvas_generation_run'
import type WorkspaceTask from '#models/workspace_task'
import config from '#config/open_router'
import CanvasService, { canvasEnabled } from '#services/canvas/canvas_service'
import AccessService, {
  conflict,
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { PIPELINE_VERSION } from '#services/canvas/generation/canvas_pipeline'
import { Exception } from '@adonisjs/core/exceptions'
import {
  figureNumber,
  imageOnSheet,
  replaceSheet,
} from '#services/canvas/generation/canvas_page_sheet'
import type { AcademicPage } from '../../../../shared/canvas/academic/content.ts'
import {
  PLANNABLE_DESIGN_IDS,
  type AcademicDesignId,
} from '../../../../shared/canvas/academic/designs.ts'
import {
  canvasOptionsSchema,
  type CanvasOptions,
} from '../../../../shared/canvas/academic/options.ts'

/** The picture frame of each design that has one, for the page's print resolution. */
const IMAGE_GEO: Partial<Record<AcademicDesignId, { w: number; h: number }>> = {
  figure_text: SLOTS.figure_text.image,
  side_figure: SLOTS.side_figure.image,
  case_box: SLOTS.case_box.image,
  title_page: SLOTS.title_page.image,
}

/** Academic generation needs the canvas editor and its own switch, so it can roll out separately. */
export const canvasGenerationEnabled = () =>
  canvasEnabled() && env.get('CANVAS_GENERATION') === 'on'

/**
 * The HTTP side of canvas generation: requesting a run, and reading its progress.
 * The run itself is a generate task with `payload.target = 'canvas'`, so the lease,
 * retry, status and claim review of ordinary generation apply unchanged.
 */
export default class CanvasGenerationService {
  assertEnabled() {
    if (!canvasGenerationEnabled()) throw missingResource()
  }

  /** The run row for a task just created, in the same transaction. One run is active per document. */
  async createRun(
    context: WorkspaceAccessContext,
    task: WorkspaceTask,
    options: CanvasOptions,
    trx: TransactionClientContract
  ) {
    const existing = await CanvasGenerationRun.query({ client: trx })
      .where('taskId', task.id)
      .first()
    if (existing) return existing
    const active = await CanvasGenerationRun.query({ client: trx })
      .where({ documentId: task.documentId! })
      .whereIn('status', ACTIVE_RUN_STATUSES)
      .first()
    if (active) throw conflict('Pages are already being generated for this document')
    // A page regeneration carries the plan of the run it builds on.
    const base = task.payload.canvasPage ? await this.latestReady(task.documentId!, trx) : null
    return CanvasGenerationRun.create(
      {
        plan: base?.plan ?? null,
        workspaceId: context.workspaceId,
        documentId: task.documentId!,
        taskId: task.id,
        baseVersionId: task.payload.baseVersionId ?? null,
        profile: options.profile,
        depth: options.depth,
        templateSet: options.templateSet,
        status: 'queued',
        plannerModel: config.canvasPlannerModel,
        writerModel:
          options.depth === 'concise' ? config.canvasPlannerModel : config.canvasWriterModel,
        pipelineVersion: PIPELINE_VERSION,
        createdBy: context.actorId,
      },
      { client: trx }
    )
  }

  private latestReady(documentId: string, client?: TransactionClientContract) {
    return CanvasGenerationRun.query({ client })
      .where({ documentId, status: 'ready' })
      .orderBy('createdAt', 'desc')
      .first()
  }

  /** Options from the request body: checked against the one schema the dialog and the CLI share. */
  options(raw: unknown): CanvasOptions {
    const parsed = canvasOptionsSchema.safeParse(raw ?? {})
    if (!parsed.success)
      throw new Exception('Choose a style, depth, template set and page count the canvas offers.', {
        status: 422,
        code: 'E_CANVAS_OPTIONS',
      })
    return parsed.data
  }

  /** Queues a canvas generation for a document open in the canvas editor. */
  async request(
    context: WorkspaceAccessContext,
    documentId: string,
    input: { mutationId: string; baseVersionId: string | null; options: CanvasOptions }
  ) {
    this.assertEnabled()
    // Access first: another workspace learns nothing, not even the editor mode.
    await new AccessService().document(context, documentId)
    if ((await new CanvasService().mode(context.workspaceId, documentId)) !== 'canvas')
      throw conflict('Open the document in the canvas editor first')
    const { default: GenerationService } = await import('#services/documents/generation_service')
    const task = await new GenerationService().request(
      context,
      documentId,
      input.mutationId,
      input.baseVersionId,
      undefined,
      input.options
    )
    const run = await CanvasGenerationRun.query().where('taskId', task.id).firstOrFail()
    return { taskId: task.id, runId: run.id }
  }

  /**
   * The run and stored pages a page action works on, checked against the current
   * canvas: the pages must still be the ones that were generated.
   */
  private async pageTarget(context: WorkspaceAccessContext, documentId: string, index: number) {
    this.assertEnabled()
    const doc = await new AccessService().document(context, documentId)
    if ((await new CanvasService().mode(context.workspaceId, documentId)) !== 'canvas')
      throw conflict('Open the document in the canvas editor first')
    const run = await this.latestReady(documentId)
    if (!run) throw conflict('Generate the pages first')
    if (run.templateSet === 'brochure')
      throw conflict('Pages of a brochure-style canvas are not regenerated one by one')
    const canvas = doc.currentVersionId
      ? await new CanvasService().forVersion(doc.currentVersionId)
      : null
    const rows = await CanvasGenerationPage.query().where('runId', run.id).orderBy('pageIndex')
    if (!canvas || rows.length !== canvas.sheetCount)
      throw conflict('The pages were rearranged after they were generated. Generate them again.')
    const row = rows.find((r) => r.pageIndex === index)
    if (!row) throw missingResource()
    if (row.designId === 'contents' || row.designId === 'references')
      throw conflict('The application writes this page; there is nothing to regenerate.')
    return { doc, run, canvas, rows, row }
  }

  /** Queues the regeneration of one page of the current canvas. */
  async requestRegenerate(
    context: WorkspaceAccessContext,
    documentId: string,
    index: number,
    input: {
      mutationId: string
      baseVersionId: string | null
      mode: 'rewrite' | 'expand' | 'condense'
    }
  ) {
    const { run } = await this.pageTarget(context, documentId, index)
    const { default: GenerationService } = await import('#services/documents/generation_service')
    const task = await new GenerationService().request(
      context,
      documentId,
      input.mutationId,
      input.baseVersionId,
      undefined,
      this.options({
        profile: run.profile,
        depth: run.depth,
        templateSet: run.templateSet,
      }),
      { index, mode: input.mode }
    )
    const created = await CanvasGenerationRun.query().where('taskId', task.id).firstOrFail()
    return { taskId: task.id, runId: created.id }
  }

  /**
   * "Change design": the stored page content laid out in another design, with no
   * model call. Only that sheet changes, in a new version.
   */
  async changeDesign(
    context: WorkspaceAccessContext,
    documentId: string,
    index: number,
    input: { mutationId: string; baseVersionId: string | null; design: string }
  ) {
    const { doc, run, canvas, row } = await this.pageTarget(context, documentId, index)
    if (!(PLANNABLE_DESIGN_IDS as readonly string[]).includes(input.design))
      throw new Exception('Choose one of the page designs', {
        status: 422,
        code: 'E_CANVAS_DESIGN',
      })
    const content = row.content as AcademicPage | null
    if (!content) throw conflict('This page has no stored content to lay out again.')
    const image = await imageOnSheet(context.workspaceId, documentId, canvas.project, index)
    const rows = await CanvasGenerationPage.query().where('runId', run.id).orderBy('pageIndex')
    const next = replaceSheet(
      canvas.project,
      index,
      { design: input.design as AcademicDesignId, page: content, image },
      {
        title: doc.title ?? 'Untitled',
        label: 'Report',
        keywords: [],
        references: [],
      },
      figureNumber(
        rows.map((r) => ({ index: r.pageIndex, design: r.designId, imageIds: r.imageIds })),
        index
      )
    )
    const saved = await new CanvasService().saveGenerated(context, documentId, {
      canvas: next,
      baseVersionId: input.baseVersionId,
      mutationId: input.mutationId,
      generationRunId: run.id,
    })
    await CanvasGenerationPage.query()
      .where({ runId: run.id, pageIndex: index })
      .update({ design_id: input.design })
    return { versionId: saved.version.id, version: saved.version.version }
  }

  /** The latest run of a document: status, stage, plan and the quality of each page. */
  async status(context: WorkspaceAccessContext, documentId: string) {
    this.assertEnabled()
    await new AccessService().document(context, documentId)
    const run = await CanvasGenerationRun.query()
      .where({ documentId, workspaceId: context.workspaceId })
      .orderBy('createdAt', 'desc')
      .first()
    if (!run) return null
    const pages = await CanvasGenerationPage.query()
      .where('runId', run.id)
      .orderBy('pageIndex', 'asc')
    const imageIds = [...new Set(pages.flatMap((page) => page.imageIds))]
    const found = imageIds.length
      ? await DocumentImage.query()
          .where('workspaceId', context.workspaceId)
          .whereIn('id', imageIds)
      : []
    const images = new Map(found.map((image) => [image.id, image]))
    return {
      id: run.id,
      taskId: run.taskId,
      status: run.status,
      profile: run.profile,
      depth: run.depth,
      templateSet: run.templateSet,
      plannerModel: run.plannerModel,
      writerModel: run.writerModel,
      error: run.error,
      resultVersionId: run.resultVersionId,
      plan: run.plan as object | null,
      metrics: run.metrics,
      createdAt: run.createdAt.toISO(),
      pages: pages.map((page) => {
        const text = JSON.stringify(page.content ?? '')
        const pictures = page.imageIds
          .map((id) => images.get(id))
          .filter((image): image is DocumentImage => !!image?.width && !!image.height)
        const geo = IMAGE_GEO[page.designId as AcademicDesignId]
        return {
          index: page.pageIndex,
          design: page.designId,
          status: page.status,
          purpose: page.purpose,
          words: page.wordCount,
          fill: page.fillRatio === null ? null : Number(page.fillRatio),
          citations: page.citedChunkIds.length,
          placeholders:
            text.split(PLACEHOLDER).length - 1 + text.split(FIGURE_PLACEHOLDER).length - 1,
          // The lowest print resolution of the page's pictures, when there are any.
          dpi:
            geo && pictures.length
              ? Math.min(
                  ...pictures.map((p) => printDpi({ width: p.width!, height: p.height! }, geo))
                )
              : null,
          attempts: page.attempts,
          notes: page.notes,
        }
      }),
    }
  }

  /** Marks the run of a task that ended without a canvas. */
  async fail(taskId: string, message: string) {
    await CanvasGenerationRun.query()
      .where('taskId', taskId)
      .whereNotIn('status', ['ready', 'failed'])
      .update({ status: 'failed', error: message.slice(0, 500) })
  }
}
