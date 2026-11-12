import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import DocumentIssue from '#models/document_issue'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import {
  PUBLICATION_LINT_VERSION,
  type Diagnostic,
} from '#services/documents/publication_diagnostic_service'
import PublicationContentService from '#services/documents/publication_content_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import { ClientContentError } from '../../../shared/publication/client.ts'
import type { PublicationDocument } from '../../../shared/publication/content.ts'

type Finding = Pick<Diagnostic, 'code' | 'field' | 'range' | 'severity' | 'message'>

/** Pure: publication hygiene findings for exactly this saved content. */
export function publicationFindings(content: TipTapDocument): Finding[] {
  try {
    return new PublicationProjectionService().project(content).diagnostics
  } catch (error) {
    if (!(error instanceof ClientContentError)) throw error
    // Structure that cannot be projected safely: field paths and codes only, never values.
    return error.issues.map((issue) => ({
      code: issue.code,
      field: issue.field,
      severity: 'error' as const,
      message: 'This content cannot be shown to clients as written.',
    }))
  }
}

const hash = (...parts: string[]) => createHash('sha256').update(parts.join('|')).digest('hex')

/**
 * Persists deterministic publication findings as private, version-bound issues.
 * They are internal hygiene signals: not a factual verdict, not blocking, and
 * never written by preview GETs. Human issues and other versions are untouched.
 */
export default class PublicationReviewService {
  /** Returns how many new issues were recorded; replays and retries record none. */
  async record(
    context: WorkspaceAccessContext,
    documentId: string,
    versionId: string,
    content: TipTapDocument
  ) {
    const findings = publicationFindings(content)
    if (!findings.length) return 0
    const contentHash = new PublicationContentService().contentHash(content as PublicationDocument)

    return db.transaction(async (trx) => {
      // The document lock serializes concurrent writers; the table has no uniqueness constraint.
      await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      let created = 0
      for (const finding of findings) {
        const fingerprint = hash(
          context.workspaceId,
          documentId,
          versionId,
          PUBLICATION_LINT_VERSION,
          finding.code,
          finding.field,
          `${finding.range?.from ?? ''}-${finding.range?.to ?? ''}`,
          contentHash
        )
        const existing = await DocumentIssue.query({ client: trx })
          .where({ workspaceId: context.workspaceId, documentId, issueFingerprint: fingerprint })
          .first()
        if (existing) continue
        await DocumentIssue.create(
          {
            workspaceId: context.workspaceId,
            documentId,
            versionId,
            title: `Publication ${finding.severity}: ${finding.message}`.slice(0, 200),
            description: `Internal check at ${finding.field} (${finding.code}). This is a publication-hygiene check, not a factual review; edit the field or confirm it is intended.`,
            blocking: false,
            state: 'open',
            origin: 'ai',
            code: `publication_${finding.code}`.slice(0, 80),
            blockId: finding.field.slice(0, 80),
            claimHash: null,
            issueFingerprint: fingerprint,
            createdById: context.actorId,
            updatedById: context.actorId,
            revision: 0,
          },
          { client: trx }
        )
        created++
      }
      return created
    })
  }
}
