import Document from '#models/document'
import WorkflowService from '#services/documents/workflow_service'
import db from '@adonisjs/lucid/services/db'
import File from '#models/file'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'
import { Exception } from '@adonisjs/core/exceptions'
export default class LibraryService {
  async change(context: WorkspaceAccessContext, id: string, filename?: string) {
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const linked = await trx
        .from('document_files')
        .where({ workspace_id: context.workspaceId, files_id: id })
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
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (file.userId !== context.actorId)
        throw new Exception('Only the uploading owner manages this file', { status: 403 })
      if (filename === undefined)
        for (const document of documents) {
          await new WorkflowService().invalidate(
            document,
            context.actorId,
            'A source file was deleted; its evidence is unavailable',
            trx
          )
          document.selectionRevision++
          document.metadataRevision++
          await document.save()
        }
      return filename === undefined ? file.delete() : file.merge({ filename }).save()
    })
  }
}
