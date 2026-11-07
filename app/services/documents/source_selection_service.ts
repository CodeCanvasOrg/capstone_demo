import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import File from '#models/file'
import WorkflowService from '#services/documents/workflow_service'
import SourceScopeService from '#services/files/source_scope_service'
import AccessService, {
  conflict,
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
export default class SourceSelectionService {
  async update(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      baseVersionId: string | null
      selectionRevision: number
      sourceMode: 'files' | 'input_only'
      fileIds: string[]
    }
  ) {
    await db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
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
      await new SourceScopeService().assertSelectable(
        trx,
        context.workspaceId,
        ids,
        document.projectId
      )
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
  }
}
