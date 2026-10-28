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
    const chunks = await new RetrievalService().search({
      context: lease.context,
      documentId: document.id,
      pins,
      query: `${document.title}\n${prompt}`,
      guard: () => tasks.check(lease),
    })
    await tasks.check(lease)
    const provider = new OpenRouterService()
    // Untitled documents get a model-written title; the brief stays the description.
    const title = document.templateSetup?.generateTitle
      ? await provider.generateTitle(prompt, chunks, () => tasks.check(lease))
      : document.title
    const generated = document.templateSetup?.outline
      ? await provider.generateOutlineWithEvidence(
          title,
          prompt,
          chunks,
          document.templateSetup.outline.definition,
          () => tasks.check(lease)
        )
      : await provider.generateDocumentWithEvidence(title ?? 'Untitled', prompt, chunks, () =>
          tasks.check(lease)
        )
    const normalized = new ContentService().normalize(generated)
    const { attachChunkMetadata } = await import('#services/documents/chunk_metadata_service')
    const content = attachChunkMetadata(normalized, chunks)
    await tasks.finish(lease, async (trx) => {
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
        generationStatus: 'ready',
        generationError: null,
        generationLeaseAt: null,
        status: 'edited',
        legacyApprovalUnverified: false,
      })
      await current.save()
      return { versionId: version.id }
    })
  }
  async failed(lease: TaskLease, error: unknown) {
    const localConflict = error instanceof TaskConflictException
    const imageFailure = error instanceof ModelImageException
    const status = localConflict ? undefined : OpenRouterService.status(error)
    await new TaskService().fail(
      lease,
      localConflict,
      localConflict
        ? error.safeMessage
        : imageFailure
          ? error.message
          : status
            ? config.failureMessages[status]
            : undefined,
      [400, 401, 402, 403, 404, 413, 422].includes(status ?? 0) || imageFailure
    )
  }
}
