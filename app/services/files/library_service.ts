import db from '@adonisjs/lucid/services/db'
import File from '#models/file'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'
import { Exception } from '@adonisjs/core/exceptions'
export default class LibraryService {
  async change(context: WorkspaceAccessContext, id: string, filename?: string) {
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const file = await File.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (file.userId !== context.actorId)
        throw new Exception('Only the uploading owner manages this file', { status: 403 })
      return filename === undefined ? file.delete() : file.merge({ filename }).save()
    })
  }
}
