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
import TaskService, { type SourcePin, type TaskLease } from '#services/workspaces/task_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import { canvasOptionsSchema, type CanvasOptions } from '../../../../shared/canvas/options.ts'
import { type DensityReport } from '../../../../shared/canvas/density.ts'
import { type CanvasDocument } from '../../../../shared/canvas/model.ts'
import type { PipelineStage } from '../../../../shared/ops/stages.ts'

/** Entries written at once. Each entry is its own model call, so this is the call concurrency. */
export const WRITE_CONCURRENCY = 3

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
  /** The validated page content before compose: a portfolio cover or entry. */
  content: unknown
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
    pages: {
      design: string
      title: string
      purpose: string
      questions: string[]
      keyTerms: string[]
      wantsImage: boolean
    }[]
  }
  pages: PageRecord[]
  report: DensityReport
  metrics: CanvasRunMetrics
  models: { planner: string; writer: string }
  /** Text of every chunk the pages were given, by id: what their citations are checked against. */
  evidence: Record<string, string>
  /** Set when "Let AI choose" could not use the model's design and made the portfolio instead. */
  fallback?: { reason: string }
}

/** What a page action on an AI-designed page answers. */
export const AI_PAGE_ACTIONS =
  'AI-designed pages are generated again as a whole; use Generate pages.'

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

/**
 * The canvas pipeline. `generate` dispatches `ai_design` ("Let AI choose") to `AiDesignPipeline` and
 * everything else to `PortfolioPipeline`; `regenerate` is the portfolio's only (AI-designed pages are
 * generated again as a whole). Stored legacy option values (`academic_report`,
 * `research_brief`, `brochure`) are coerced to `portfolio` by the options schema; runs made with
 * a retired template are never regenerated (`CanvasGenerationService` answers 409). `generate`
 * saves nothing (the CLI's `--dry-run` is exactly this); `execute` wraps it for a queued task:
 * progress rows, the save as a normal version, the run's metrics and the claim review.
 */
export default class CanvasPipeline {
  async generate(input: GenerateInput): Promise<Generated> {
    if (input.options.templateSet === 'ai_design') {
      const { default: AiDesignPipeline } = await import('../ai_design/ai_design_pipeline.ts')
      return new AiDesignPipeline().generate(input)
    }
    const { default: PortfolioPipeline } = await import('../portfolio/portfolio_pipeline.ts')
    return new PortfolioPipeline().generate(input)
  }

  /** One page of the current canvas, again: only that sheet changes. */
  async regenerate(
    input: GenerateInput & {
      run: CanvasGenerationRun
      baseVersionId: string | null
      index: number
      mode: 'rewrite' | 'expand' | 'condense'
    }
  ): Promise<Pick<Generated, 'canvas' | 'metrics'>> {
    if (input.options.templateSet === 'ai_design')
      throw Object.assign(new Error(AI_PAGE_ACTIONS), { status: 409, unusableOutput: true })
    const { default: PortfolioPipeline } = await import('../portfolio/portfolio_pipeline.ts')
    return new PortfolioPipeline().regenerate(input)
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
    // A design the model could not deliver became the portfolio: the run says so, and its page actions are the portfolio's.
    if ('fallback' in generated && generated.fallback) {
      const { PORTFOLIO_PIPELINE_VERSION } = await import('../portfolio/portfolio_pipeline.ts')
      run.merge({ templateSet: 'portfolio', pipelineVersion: PORTFOLIO_PIPELINE_VERSION })
      await run.save()
    }
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
