import env from '#start/env'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import CanvasGenerationPage from '#models/canvas_generation_page'
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
import type { CanvasOptions } from '../../../../shared/canvas/academic/options.ts'

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
    return CanvasGenerationRun.create(
      {
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
      plan: run.plan,
      metrics: run.metrics,
      createdAt: run.createdAt,
      pages: pages.map((page) => ({
        index: page.pageIndex,
        design: page.designId,
        status: page.status,
        purpose: page.purpose,
        words: page.wordCount,
        fill: page.fillRatio === null ? null : Number(page.fillRatio),
        citations: page.citedChunkIds.length,
        attempts: page.attempts,
        notes: page.notes,
      })),
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
