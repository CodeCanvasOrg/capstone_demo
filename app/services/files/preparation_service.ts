import db from '@adonisjs/lucid/services/db'
import config from '#config/open_router'
import Document from '#models/document'
import File from '#models/file'
import FileRevision from '#models/file_revision'
import ProcessingRun from '#models/processing_run'
import WorkspaceTask from '#models/workspace_task'
import WorkflowService from '#services/documents/workflow_service'
import AccessService, {
  conflict,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import TaskService from '#services/workspaces/task_service'
import { Exception } from '@adonisjs/core/exceptions'

export default class PreparationService {
  async request(context: WorkspaceAccessContext, fileId: string, mutationId: string) {
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      // Match source selection and file deletion: documents before files.
      const linked = await trx
        .from('document_files')
        .where({ workspace_id: context.workspaceId, files_id: fileId })
        .select('document_id')
      const documents = await Document.query({ client: trx })
        .where('workspaceId', context.workspaceId)
        .whereIn(
          'id',
          linked.map((row) => row.document_id)
        )
        .orderBy('id')
        .forUpdate()
      const file = await File.query({ client: trx })
        .where({ id: fileId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (file.userId !== context.actorId)
        throw new Exception('Only the uploading owner prepares this file', { status: 403 })
      const previous = await WorkspaceTask.query({ client: trx })
        .where({
          workspaceId: context.workspaceId,
          actorId: context.actorId,
          kind: 'ingest',
          mutationId,
        })
        .first()
      if (previous) {
        if (previous.fileId !== fileId) throw conflict('This request identity was already used')
        return previous
      }
      if (
        await WorkspaceTask.query({ client: trx })
          .where({ workspaceId: context.workspaceId, fileId })
          .whereIn('status', ['queued', 'running'])
          .first()
      )
        throw conflict('Source preparation is already pending')
      const revision = await FileRevision.query({ client: trx })
        .where({ workspaceId: context.workspaceId, fileId })
        .orderBy('revision', 'desc')
        .firstOrFail()
      const latest = await ProcessingRun.query({ client: trx })
        .where({ workspaceId: context.workspaceId, fileRevisionId: revision.id })
        .orderBy('createdAt', 'desc')
        .first()
      if (
        latest?.status === 'ready' &&
        latest.pipelineVersion === config.pipelineVersion &&
        latest.embeddingModel === config.embeddingModel &&
        latest.embeddingDimensions === config.embeddingDimensions
      )
        throw conflict('This file is already prepared with the current configuration')
      // A new run retains historical evidence and cannot be overwritten by an old lease.
      const run = await ProcessingRun.create(
        {
          workspaceId: context.workspaceId,
          fileRevisionId: revision.id,
          pipelineVersion: config.pipelineVersion,
          embeddingModel: config.embeddingModel,
          embeddingDimensions: config.embeddingDimensions,
          status: 'queued',
          warnings: [],
          stageTimings: {},
        },
        { client: trx }
      )
      for (const document of documents) {
        await new WorkflowService().invalidate(
          document,
          context.actorId,
          'Source preparation was restarted',
          trx
        )
        document.metadataRevision++
        await document.save()
      }
      return new TaskService().create(
        context,
        { kind: 'ingest', fileId, runId: run.id, mutationId, payload: {} },
        trx
      )
    })
  }
}
