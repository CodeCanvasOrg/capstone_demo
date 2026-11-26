import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentImage from '#models/document_image'
import DocumentLayout from '#models/document_layout'
import WorkspaceMembership from '#models/workspace_membership'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import CanvasGenerationRun from '#models/canvas_generation_run'
import CanvasService from '#services/canvas/canvas_service'
import {
  PIPELINE_VERSION,
  writePageRows,
  type Generated,
} from '#services/canvas/generation/canvas_pipeline'
import { PORTFOLIO_PIPELINE_VERSION } from '#services/canvas/portfolio/portfolio_pipeline'
import { isPortfolio, portfolioReport } from '../../../../shared/canvas/portfolio/quality.ts'
import type { CanvasOptions } from '../../../../shared/canvas/academic/options.ts'
import AccessService, {
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import type { SourcePin } from '#services/workspaces/task_service'
import {
  densityReport,
  type DensityReport,
  type ImageSize,
} from '../../../../shared/canvas/density.ts'

/**
 * What the operator commands need that a request supplies: who to act as, the
 * document's brief and the sources it is pinned to. Maintenance and debugging
 * only (`canvas:generate`, `canvas:plan`, `canvas:density`): the web request path
 * uses `GenerationService.request`.
 */
export default class CanvasOperator {
  /** The workspace's owner, as the acting member (a command has no signed-in user). */
  async context(workspaceId: string): Promise<WorkspaceAccessContext> {
    const owner = await WorkspaceMembership.query()
      .where({ workspaceId, role: 'owner' })
      .whereNull('revokedAt')
      .orderBy('createdAt', 'asc')
      .first()
    if (!owner) throw missingResource()
    const access = await new AccessService().resolve(owner.userId, workspaceId)
    return access.context
  }

  /** The brief and the pinned sources, as the generation task would build them. */
  async inputs(context: WorkspaceAccessContext, documentId: string) {
    const document = await new AccessService().document(context, documentId)
    const prompt = [
      document.description,
      ...Object.entries(document.projectInformation ?? {}).map(
        ([key, value]) => `${key}: ${value}`
      ),
    ]
      .filter(Boolean)
      .join('\n\n')
    const instructions: string | undefined = document.templateSetup?.instructions
    const brief = instructions
      ? `${prompt}\n\nAuthor's writing instructions (follow them unless they conflict with the output rules or the evidence):\n${instructions}`
      : prompt
    return {
      document,
      title: document.title ?? 'Untitled',
      brief,
      pins: await this.pins(context, document),
    }
  }

  /** The newest ready processing run of each source selected for the document. */
  async pins(context: WorkspaceAccessContext, document: Document): Promise<SourcePin[]> {
    const result = await db.rawQuery<{
      rows: {
        file_id: string
        revision_id: string
        run_id: string
        pipeline_version: string
        embedding_model: string
      }[]
    }>(
      `SELECT f.id AS file_id,latest.* FROM document_files df JOIN files f ON f.id=df.files_id AND f.workspace_id=df.workspace_id JOIN LATERAL (SELECT fr.id AS revision_id,pr.id AS run_id,pr.pipeline_version,pr.embedding_model FROM file_revisions fr JOIN processing_runs pr ON pr.file_revision_id=fr.id AND pr.workspace_id=fr.workspace_id WHERE fr.file_id=f.id AND fr.workspace_id=f.workspace_id AND pr.status='ready' ORDER BY fr.revision DESC,pr.created_at DESC LIMIT 1) latest ON true WHERE df.document_id=? AND df.workspace_id=? ORDER BY f.id`,
      [document.id, context.workspaceId]
    )
    return result.rows.map((row) => ({
      fileId: row.file_id,
      revisionId: row.revision_id,
      runId: row.run_id,
      pipelineVersion: row.pipeline_version,
      embeddingModel: row.embedding_model,
    }))
  }

  /** Documents of a workspace open in the canvas editor, or just `documentId`. */
  async canvasDocuments(workspaceId: string, documentId?: string) {
    const layouts = await DocumentLayout.query()
      .where({ workspaceId, editorMode: 'canvas' })
      .if(documentId, (query) => query.where('documentId', documentId!))
      .select('documentId')
    if (!layouts.length) return []
    return Document.query()
      .where('workspaceId', workspaceId)
      .whereIn(
        'id',
        layouts.map((l) => l.documentId)
      )
      .orderBy('title')
  }

  /** Quality of a document's current canvas (the saved version), or null when it has none. */
  async density(document: Document): Promise<DensityReport | null> {
    if (!document.currentVersionId) return null
    const canvas = await DocumentCanvas.query()
      .where('versionId', document.currentVersionId)
      .first()
    if (!canvas) return null
    const images = await DocumentImage.query()
      .where({ workspaceId: document.workspaceId!, documentId: document.id })
      .whereNotNull('width')
    const sizes = new Map<string, ImageSize>(
      images.map((i) => [i.id, { width: i.width!, height: i.height! }])
    )
    return isPortfolio(canvas.project)
      ? portfolioReport(canvas.project, { images: sizes })
      : densityReport(canvas.project, { images: sizes })
  }

  /**
   * Saves a canvas the command generated, as a normal version with its run and page
   * rows, so it is reviewed, approved and exported like any other. Refuses a document
   * that has a run in progress; a failed save leaves a failed run, not a half version.
   */
  async save(
    context: WorkspaceAccessContext,
    document: Document,
    generated: Generated,
    options: CanvasOptions
  ) {
    const run = await CanvasGenerationRun.create({
      workspaceId: context.workspaceId,
      documentId: document.id,
      taskId: null,
      baseVersionId: document.currentVersionId,
      profile: options.profile,
      depth: options.depth,
      templateSet: options.templateSet,
      status: 'composing',
      plannerModel: generated.models.planner,
      writerModel: generated.models.writer,
      pipelineVersion:
        options.templateSet === 'portfolio' ? PORTFOLIO_PIPELINE_VERSION : PIPELINE_VERSION,
      plan: generated.plan,
      createdBy: context.actorId,
    })
    try {
      const saved = await new CanvasService().saveGenerated(context, document.id, {
        canvas: generated.canvas,
        baseVersionId: document.currentVersionId,
        mutationId: randomUUID(),
        generationRunId: run.id,
      })
      await writePageRows(run, generated.pages)
      run.merge({ status: 'ready', resultVersionId: saved.version.id, metrics: generated.metrics })
      await run.save()
      return { run, version: saved.version }
    } catch (error) {
      run.merge({ status: 'failed', error: (error as Error).message.slice(0, 500) })
      await run.save()
      throw error
    }
  }
}
