import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import ContentService from '#services/documents/content_service'
import AccessService, {
  conflict,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'

export default class VersionService {
  async save(
    context: WorkspaceAccessContext,
    id: string,
    input: { content: unknown; baseVersionId: string | null; mutationId: string }
  ) {
    const content = new ContentService().normalize(input.content)
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ content, baseVersionId: input.baseVersionId }))
      .digest('hex')
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const duplicate = await DocumentVersion.query({ client: trx })
        .where({ documentId: id, userId: context.actorId, mutationId: input.mutationId })
        .first()
      if (duplicate) {
        if (duplicate.requestHash !== requestHash)
          throw conflict('This save identity was used for different content')
        return duplicate
      }
      if (document.currentVersionId !== input.baseVersionId)
        throw conflict(
          'A newer version exists. Keep your local content and compare it before saving again.'
        )
      const latest = document.currentVersionId
        ? await DocumentVersion.findOrFail(document.currentVersionId, { client: trx })
        : null
      if (
        latest &&
        JSON.stringify(new ContentService().normalize(latest.content)) === JSON.stringify(content)
      )
        return latest
      const version = await DocumentVersion.create(
        {
          workspaceId: context.workspaceId,
          documentId: id,
          userId: context.actorId,
          version: (latest?.version ?? 0) + 1,
          content,
          mutationId: input.mutationId,
          requestHash,
        },
        { client: trx }
      )
      document.merge({
        currentVersionId: version.id,
        status: 'edited',
        legacyApprovalUnverified: false,
      })
      await document.save()
      return version
    })
  }
}
