import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import VersionAcceptance from '#models/version_acceptance'
import EvidenceService from '#services/documents/evidence_service'
import ContentService from '#services/documents/content_service'
import PublicationReviewService from '#services/documents/publication_review_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import logger from '@adonisjs/core/services/logger'
import PublicationContentService from '#services/documents/publication_content_service'
import type { PublicationDocument } from '../../../shared/publication/content.ts'
import WorkflowService from '#services/documents/workflow_service'
import AccessService, {
  conflict,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
export type AttachedVersionData = {
  /** Identity of the data, part of the save's request hash. */
  hash: string
  /** Whether the data differs from what the latest version has. */
  changedSince: (latest: DocumentVersion, trx: TransactionClientContract) => Promise<boolean>
  /** Stores the data for a version just created, inside the save transaction. */
  persist: (version: DocumentVersion, trx: TransactionClientContract) => Promise<void>
}

export default class VersionService {
  async save(
    context: WorkspaceAccessContext,
    id: string,
    input: {
      content: unknown
      baseVersionId: string | null
      mutationId: string
      /**
       * Data saved with the version beside its content (the canvas layout). A change
       * in it alone still makes a new version, and it is written in the same
       * transaction as the version it belongs to.
       */
      attached?: AttachedVersionData
    }
  ) {
    const normalized = new ContentService().normalize(input.content, {
      repair: true,
      seed: input.mutationId,
    })
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          content: normalized,
          baseVersionId: input.baseVersionId,
          ...(input.attached ? { attached: input.attached.hash } : {}),
        })
      )
      .digest('hex')
    const hydrated = await new EvidenceService().hydrate(context, id, normalized)
    // Hydration drops evidence the actor cannot use; annotations must still resolve.
    const publication = new PublicationContentService()
    const content = publication.accept(hydrated as PublicationDocument, {
      resolvers: publication.resolversFor(hydrated as PublicationDocument),
    }) as typeof hydrated
    const saved = await db.transaction(async (trx) => {
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
        JSON.stringify(new ContentService().normalize(latest.content, { repair: true })) !==
          JSON.stringify(normalized) ||
        (input.attached && (await input.attached.changedSince(latest, trx)))
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
        await input.attached?.persist(version, trx)
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
    // Best effort after commit: a failed hygiene check never fails or hides a saved version.
    try {
      await new PublicationReviewService().record(
        context,
        id,
        saved.id,
        saved.content as TipTapDocument
      )
    } catch (error) {
      logger.warn({ err: error, documentId: id, versionId: saved.id }, 'Publication check failed')
    }
    return saved
  }
}
