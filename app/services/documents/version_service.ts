import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import VersionAcceptance from '#models/version_acceptance'
import EvidenceService from '#services/documents/evidence_service'
import ContentService from '#services/documents/content_service'
import WorkflowService from '#services/documents/workflow_service'
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
    const normalized = new ContentService().normalize(input.content)
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ content: normalized, baseVersionId: input.baseVersionId }))
      .digest('hex')
    const content = await new EvidenceService().hydrate(context, id, normalized)
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const accepted = await VersionAcceptance.query({ client: trx })
        .where({
          workspaceId: context.workspaceId,
          documentId: id,
          actorId: context.actorId,
          mutationId: input.mutationId,
        })
        .first()
      if (accepted) {
        if (accepted.requestHash !== requestHash)
          throw conflict('This save identity was used for different content')
        return DocumentVersion.findOrFail(accepted.versionId, { client: trx })
      }
      if (document.currentVersionId !== input.baseVersionId)
        throw conflict(
          'A newer version exists. Keep your local content and compare it before saving again.'
        )
      const latest = document.currentVersionId
        ? await DocumentVersion.findOrFail(document.currentVersionId, { client: trx })
        : null
      let version = latest
      if (
        !latest ||
        JSON.stringify(new ContentService().normalize(latest.content)) !==
          JSON.stringify(normalized)
      ) {
        version = await DocumentVersion.create(
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
        await new WorkflowService().invalidate(
          document,
          context.actorId,
          'Document content changed',
          trx
        )
        document.merge({
          currentVersionId: version.id,
          status: 'edited',
          legacyApprovalUnverified: false,
        })
        await document.save()
      }
      await VersionAcceptance.create(
        {
          workspaceId: context.workspaceId,
          documentId: id,
          versionId: version!.id,
          actorId: context.actorId,
          mutationId: input.mutationId,
          requestHash,
        },
        { client: trx }
      )
      return version!
    })
  }
}
