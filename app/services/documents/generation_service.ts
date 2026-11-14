import ModelImageException from '#exceptions/model_image_exception'
import WorkflowService from '#services/documents/workflow_service'
import TaskConflictException from '#exceptions/task_conflict_exception'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import WorkspaceTask from '#models/workspace_task'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import RetrievalService from '#services/documents/retrieval_service'
import ContentService from '#services/documents/content_service'
import type { PublicationDocument } from '../../../shared/publication/content.ts'
import PublicationContentService from '#services/documents/publication_content_service'
import BrandedEntryService from '#services/documents/branded_entry_service'
import type { EntrySidecar } from '../../../shared/layout/entry.ts'
import PublicationReviewService from '#services/documents/publication_review_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import ClaimReviewService from '#services/documents/claim_review_service'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import AccessService, {
  conflict,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import TaskService, {
  fingerprint,
  type SourcePin,
  type TaskLease,
} from '#services/workspaces/task_service'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
export const generationInput = (doc: Document) => ({
  ...(doc.templateSetup?.outline ? { outline: doc.templateSetup.outline } : {}),
  title: doc.title,
  description: doc.description,
  information: doc.projectInformation,
  ...(doc.projectInformationContent ? { informationContent: doc.projectInformationContent } : {}),
  sourceMode: doc.sourceMode,
  selectionRevision: doc.selectionRevision,
  model: config.model,
  pipeline: config.pipelineVersion,
})
export default class GenerationService {
  async request(
    context: WorkspaceAccessContext,
    documentId: string,
    mutationId: string,
    baseVersionId: string | null,
    client?: TransactionClientContract
  ) {
    const request = async (trx: TransactionClientContract) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const previous = await WorkspaceTask.query({ client: trx })
        .where({
          workspaceId: context.workspaceId,
          actorId: context.actorId,
          kind: 'generate',
          mutationId,
        })
        .first()
      if (previous) {
        if (previous.documentId !== documentId || previous.payload.baseVersionId !== baseVersionId)
          throw conflict('This request identity was already used')
        return previous
      }
      if (document.currentVersionId !== baseVersionId)
        throw conflict('Save and reload the latest version before generating')
      const selected = await trx.rawQuery<{
        rows: {
          file_id: string
          revision_id: string
          run_id: string
          status: string
          pipeline_version: string
          embedding_model: string
        }[]
      }>(
        `SELECT f.id AS file_id,latest.* FROM document_files df JOIN files f ON f.id=df.files_id AND f.workspace_id=df.workspace_id JOIN LATERAL (SELECT fr.id AS revision_id,pr.id AS run_id,pr.status,pr.pipeline_version,pr.embedding_model FROM file_revisions fr JOIN processing_runs pr ON pr.file_revision_id=fr.id AND pr.workspace_id=fr.workspace_id WHERE fr.file_id=f.id AND fr.workspace_id=f.workspace_id ORDER BY fr.revision DESC,pr.created_at DESC LIMIT 1) latest ON true WHERE df.document_id=? AND df.workspace_id=? ORDER BY f.id`,
        [documentId, context.workspaceId]
      )
      const count = await trx
        .from('document_files')
        .where({ workspace_id: context.workspaceId, document_id: documentId })
        .count('* as total')
        .first()
      if (
        Number(count.total) !== selected.rows.length ||
        (document.sourceMode === 'files' && !selected.rows.length) ||
        (document.sourceMode === 'input_only' && selected.rows.length)
      )
        throw conflict('Prepare the selected sources or explicitly select input-only writing')
      if (selected.rows.some((row) => row.status === 'failed'))
        throw new TaskConflictException('source_unavailable')
      const pins: SourcePin[] = selected.rows.map((row) => ({
        fileId: row.file_id,
        revisionId: row.revision_id,
        runId: row.run_id,
        pipelineVersion: row.pipeline_version,
        embeddingModel: row.embedding_model,
      }))
      const created = await new TaskService().create(
        context,
        {
          kind: 'generate',
          documentId,
          mutationId,
          payload: {
            pins,
            inputHash: fingerprint(generationInput(document)),
            baseVersionId,
            selectionRevision: document.selectionRevision,
          },
        },
        trx
      )
      await new WorkflowService().invalidate(
        document,
        context.actorId,
        'Generation was requested',
        trx
      )
      document.merge({
        generationTaskId: created.id,
        generationStatus: 'processing',
        generationError: null,
      })
      await document.save()
      return created
    }
    return client ? request(client) : db.transaction(request)
  }
  async execute(lease: TaskLease) {
    const tasks = new TaskService()
    await tasks.check(lease)
    const document = await new AccessService().document(lease.context, lease.task.documentId!)
    const input = lease.task.payload
    if (
      document.generationTaskId !== lease.task.id ||
      document.currentVersionId !== input.baseVersionId ||
      fingerprint(generationInput(document)) !== input.inputHash
    )
      throw new TaskConflictException('inputs_changed')
    const pins = input.pins ?? []
    if (pins.length) {
      const rows = await db
        .from('processing_runs')
        .where('workspace_id', lease.context.workspaceId)
        .whereIn(
          'id',
          pins.map((pin) => pin.runId)
        )
        .select('id', 'status')
      if (rows.length !== pins.length || rows.some((row) => row.status === 'failed'))
        throw new TaskConflictException('source_unavailable')
      if (rows.some((row) => row.status !== 'ready')) {
        await tasks.defer(lease)
        return
      }
    }
    const prompt = [
      document.description,
      ...Object.entries(document.projectInformation ?? {}).map(
        ([key, value]) => `${key}: ${value}`
      ),
    ]
      .filter(Boolean)
      .join('\n\n')
    const retrievalStart = performance.now()
    const chunks = await new RetrievalService().search({
      context: lease.context,
      documentId: document.id,
      pins,
      query: `${document.title}\n${prompt}`,
      guard: () => tasks.check(lease),
    })
    console.log(
      `[generation ${document.id}] retrieval finished in ${Math.round(performance.now() - retrievalStart)}ms with ${chunks.length} chunks`
    )
    await tasks.check(lease)
    const provider = new OpenRouterService()
    // Untitled documents get a model-written title; the brief stays the description.
    const title = document.templateSetup?.generateTitle
      ? await provider.generateTitle(prompt, chunks, () => tasks.check(lease))
      : document.title
    const generationStart = performance.now()
    console.log(
      `[generation ${document.id}] generation started (${document.templateSetup?.outline ? 'outline' : 'freeform'})`
    )
    const outline = document.templateSetup?.outline
    let sidecar: EntrySidecar | undefined
    let generated: Awaited<ReturnType<OpenRouterService['generateDocumentWithEvidence']>>
    if (outline?.definition.format === 'branded_entry') {
      // Structured fields become ordinary editable blocks; evidence labels and
      // reviewer notes travel in the sidecar and land in publication metadata.
      const entry = await provider.generateBrandedEntry(
        title ?? 'Untitled',
        prompt,
        chunks,
        outline.definition,
        () => tasks.check(lease)
      )
      generated = entry.document
      sidecar = entry.sidecar
    } else {
      generated = outline
        ? await provider.generateOutlineWithEvidence(
            title,
            prompt,
            chunks,
            outline.definition,
            () => tasks.check(lease)
          )
        : await provider.generateDocumentWithEvidence(title ?? 'Untitled', prompt, chunks, () =>
            tasks.check(lease)
          )
    }
    console.log(
      `[generation ${document.id}] generation finished in ${Math.round(performance.now() - generationStart)}ms`
    )
    const normalized = new ContentService().normalize(generated, { repair: true })
    const { attachChunkMetadata } = await import('#services/documents/chunk_metadata_service')
    const content = this.annotate(
      attachChunkMetadata(normalized, chunks),
      `${document.id}:${lease.task.mutationId}`,
      sidecar
    )
    const accepted = await tasks.finish(lease, async (trx) => {
      const current = await Document.query({ client: trx })
        .where({ id: document.id, workspaceId: lease.context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (
        current.generationTaskId !== lease.task.id ||
        current.currentVersionId !== input.baseVersionId ||
        fingerprint(generationInput(current)) !== input.inputHash
      )
        throw new TaskConflictException('inputs_changed')
      // Recheck renderable prose after live input/lease checks and before publishing.
      new ContentService().normalizeGenerated(content)
      const latest = await DocumentVersion.query({ client: trx })
        .where({ documentId: current.id, workspaceId: lease.context.workspaceId })
        .orderBy('version', 'desc')
        .first()
      const version = await DocumentVersion.create(
        {
          workspaceId: lease.context.workspaceId,
          documentId: current.id,
          userId: lease.context.actorId,
          version: (latest?.version ?? 0) + 1,
          content,
          mutationId: lease.task.mutationId,
          requestHash: lease.task.requestHash,
        },
        { client: trx }
      )
      await new WorkflowService().invalidate(
        current,
        lease.context.actorId,
        'Generated content was accepted',
        trx
      )
      if (current.templateSetup?.generateTitle) {
        const templateSetup = { ...current.templateSetup }
        delete templateSetup.generateTitle
        current.merge({ title, templateSetup })
      }
      current.merge({
        currentVersionId: version.id,
        // The draft is shown right away; issue checks run next while the editor stays usable.
        generationStatus: 'checking_issues',
        generationError: null,
        generationLeaseAt: DateTime.utc(),
        status: 'edited',
        legacyApprovalUnverified: false,
      })
      await current.save()
      return { versionId: version.id }
    })
    await this.reviewClaims(lease, document.id, String(accepted.versionId), content)
  }
  /**
   * Deterministic publication mapping of accepted model output. Model-proposed
   * IDs, URLs and authorship are never read; identity comes from the task's
   * mutation, so a replayed task yields the same IDs. A draft that cannot be
   * mapped (e.g. no title) stays an ordinary editable document.
   */
  private annotate<T extends Parameters<PublicationContentService['mapLegacy']>[0]>(
    content: T,
    namespace: string,
    sidecar?: EntrySidecar
  ): T {
    try {
      const service = new PublicationContentService()
      // Model-proposed identity and root metadata are untrusted: discard, then allocate.
      const untrusted = structuredClone(content) as PublicationDocument
      delete untrusted.attrs
      const strip = (nodes?: PublicationDocument['content']) =>
        nodes?.forEach((node) => {
          if (node.attrs) delete node.attrs.nodeId
          strip(node.content)
        })
      strip(untrusted.content)
      const { document, report } = service.mapLegacy(untrusted, namespace)
      if (!report.mapped) return content
      if (sidecar) new BrandedEntryService().apply(service, document, sidecar, namespace)
      const resolvers = service.resolversFor(document)
      return service.accept(document, { resolvers }) as T
    } catch (error) {
      logger.warn({ err: error, namespace }, 'Generated content kept without publication metadata')
      return content
    }
  }
  /** Best effort: a failed check must never fail or hide an accepted draft. */
  private async reviewClaims(
    lease: TaskLease,
    documentId: string,
    versionId: string,
    content: Parameters<ClaimReviewService['review']>[3]
  ) {
    try {
      await new ClaimReviewService().review(lease.context, documentId, versionId, content)
    } catch (error) {
      logger.error({ err: error, documentId, versionId }, 'Generated claim review failed')
    }
    try {
      await new PublicationReviewService().record(
        lease.context,
        documentId,
        versionId,
        content as TipTapDocument
      )
    } catch (error) {
      logger.error({ err: error, documentId, versionId }, 'Publication check failed')
    } finally {
      await db
        .from('documents')
        .where({
          id: documentId,
          workspace_id: lease.context.workspaceId,
          generation_task_id: lease.task.id,
          generation_status: 'checking_issues',
        })
        .update({ generation_status: 'ready', generation_lease_at: null })
    }
  }
  async failed(lease: TaskLease, error: unknown) {
    const localConflict = error instanceof TaskConflictException
    const imageFailure = error instanceof ModelImageException
    const unusableOutput = OpenRouterService.isUnusableOutput(error)
    const status = localConflict ? undefined : OpenRouterService.status(error)
    await new TaskService().fail(
      lease,
      localConflict,
      localConflict
        ? error.safeMessage
        : imageFailure
          ? error.message
          : unusableOutput
            ? 'The model returned incomplete or unreadable content. Your previous draft is unchanged. Try generating again.'
            : status
              ? config.failureMessages[status]
              : OpenRouterService.isTimeout(error)
                ? 'The model took too long to respond. Try again in a moment.'
                : undefined,
      [400, 401, 402, 403, 404, 413, 422].includes(status ?? 0) || imageFailure || unusableOutput
    )
  }
}
