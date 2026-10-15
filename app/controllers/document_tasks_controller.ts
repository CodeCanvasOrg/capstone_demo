import WorkflowService from '#services/documents/workflow_service'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import File from '#models/file'
import ProcessingRun from '#models/processing_run'
import AccessService, { conflict, missingResource } from '#services/workspaces/access_service'
import GenerationService from '#services/documents/generation_service'
import TaskService from '#services/workspaces/task_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import FilePolicy from '#policies/file_policy'
import { generateValidator, sourceSelectionValidator } from '#validators/document_task'
export default class DocumentTasksController {
  async generate({ workspaceAccess, params, request, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    const input = await request.validateUsing(generateValidator)
    const task = await new GenerationService().request(
      workspaceAccess!,
      params.documentId,
      input.mutationId,
      input.baseVersionId
    )
    if (request.accepts(['html', 'json']) === 'json')
      return response.accepted({ data: { id: task.id, status: task.status } })
    return response.redirect().back()
  }
  async show({ workspaceAccess, params, response }: HttpContext) {
    return response.ok({ data: await new TaskService().show(workspaceAccess!, params.taskId) })
  }
  async retry({ workspaceAccess, params, bouncer, request, response }: HttpContext) {
    const context = workspaceAccess!
    const file = await new AccessService().file(context, params.id)
    await bouncer.with(FilePolicy).authorize('update', file)
    const { mutationId } = await request.validateUsing(generateValidator)
    await db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const run = await ProcessingRun.query({ client: trx })
        .where('workspaceId', context.workspaceId)
        .whereHas('revision', (revision) => revision.where('fileId', file.id))
        .orderBy('createdAt', 'desc')
        .firstOrFail()
      if (run.status === 'ready') throw conflict('This file is already prepared')
      await new TaskService().create(
        context,
        { kind: 'ingest', fileId: file.id, runId: run.id, mutationId, payload: {} },
        trx
      )
    })
    await new TaskDispatchService().dispatch()
    return response.redirect().back()
  }
  async sources({ workspaceAccess, params, request, response }: HttpContext) {
    const context = workspaceAccess!
    await new AccessService().document(context, params.documentId)
    const input = await request.validateUsing(sourceSelectionValidator)
    await db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id: params.documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (
        document.currentVersionId !== input.baseVersionId ||
        document.selectionRevision !== input.selectionRevision
      )
        throw conflict('The source selection changed. Reload it before retrying.')
      const ids = [...new Set(input.fileIds)]
      const files = await File.query({ client: trx })
        .where('workspaceId', context.workspaceId)
        .whereIn('id', ids)
        .forUpdate()
      if (files.length !== ids.length) throw missingResource()
      if (input.sourceMode === 'input_only' && ids.length)
        throw conflict('Input-only writing cannot select files')
      await trx
        .from('document_files')
        .where({ workspace_id: context.workspaceId, document_id: document.id })
        .delete()
      if (ids.length)
        await trx.table('document_files').insert(
          ids.map((id) => ({
            workspace_id: context.workspaceId,
            document_id: document.id,
            files_id: id,
          }))
        )
      await new WorkflowService().invalidate(
        document,
        context.actorId,
        'Selected source files changed',
        trx
      )
      document.merge({
        sourceMode: input.sourceMode,
        selectionRevision: document.selectionRevision + 1,
        metadataRevision: document.metadataRevision + 1,
        status: document.currentVersionId ? 'edited' : 'draft',
      })
      await document.save()
    })
    return response.redirect().back()
  }
}
