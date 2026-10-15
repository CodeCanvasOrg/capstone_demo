import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Document from '#models/document'
import DocumentVersion from '#models/document_version'
import DocumentReview from '#models/document_review'
import DocumentApproval from '#models/document_approval'
import ContentService from '#services/documents/content_service'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import { fingerprint, type SourcePin } from '#services/workspaces/task_service'
import config from '#config/open_router'
export const reviewInputHash = (doc: Document) =>
  fingerprint({
    title: doc.title,
    description: doc.description,
    information: doc.projectInformation,
    sourceMode: doc.sourceMode,
    selectionRevision: doc.selectionRevision,
  })
export type ReadinessStage = {
  key: 'project_information' | 'source_preparation' | 'editorial_readiness' | 'approval'
  label: string
  complete: boolean
  reasons: string[]
}
export default class ReadinessService {
  async inspect(document: Document, trx?: TransactionClientContract) {
    const connection = trx ?? db
    const selected = await connection.rawQuery<{
      rows: {
        file_id: string
        revision_id: string | null
        run_id: string | null
        status: string | null
        pipeline_version: string | null
        embedding_model: string | null
        embedding_dimensions: number | null
        warnings: string[] | null
      }[]
    }>(
      `SELECT f.id AS file_id,latest.* FROM document_files df JOIN files f ON f.id=df.files_id AND f.workspace_id=df.workspace_id LEFT JOIN LATERAL(SELECT fr.id AS revision_id,pr.id AS run_id,pr.status,pr.pipeline_version,pr.embedding_model,pr.embedding_dimensions,pr.warnings FROM file_revisions fr LEFT JOIN processing_runs pr ON pr.file_revision_id=fr.id AND pr.workspace_id=fr.workspace_id WHERE fr.file_id=f.id AND fr.workspace_id=f.workspace_id ORDER BY fr.revision DESC,pr.created_at DESC NULLS LAST LIMIT 1) latest ON true WHERE df.workspace_id=? AND df.document_id=? ORDER BY f.id`,
      [document.workspaceId!, document.id]
    )
    const pins: SourcePin[] = selected.rows
      .filter((row) => !!row.run_id && !!row.revision_id)
      .map((row) => ({
        fileId: row.file_id,
        revisionId: row.revision_id!,
        runId: row.run_id!,
        pipelineVersion: row.pipeline_version!,
        embeddingModel: row.embedding_model!,
      }))
    const warnings = selected.rows.flatMap((row) =>
      (row.warnings ?? []).map((text) => ({
        id: `${row.run_id}:${fingerprint(text).slice(0, 16)}`,
        text,
      }))
    )
    if (document.sourceMode === 'input_only')
      warnings.push({
        id: 'input-only',
        text: 'This case study is based on entered project information without source files.',
      })
    const information = INFORMATION_FIELDS.filter(
      (key) =>
        typeof document.projectInformation?.[key] !== 'string' ||
        !document.projectInformation[key].trim()
    )
    const sourcesReady =
      document.sourceMode === 'input_only'
        ? selected.rows.length === 0
        : selected.rows.length > 0 &&
          selected.rows.every(
            (row) =>
              row.status === 'ready' &&
              row.pipeline_version === config.pipelineVersion &&
              row.embedding_model === config.embeddingModel &&
              row.embedding_dimensions === config.embeddingDimensions
          )
    const blocked = await connection
      .from('document_issues')
      .where({
        workspace_id: document.workspaceId!,
        document_id: document.id,
        state: 'open',
        blocking: true,
      })
      .first()
    const generation = document.generationTaskId
      ? await connection
          .from('workspace_tasks')
          .where({ id: document.generationTaskId, workspace_id: document.workspaceId! })
          .whereIn('status', ['queued', 'running'])
          .first()
      : null
    const version = document.currentVersionId
      ? await DocumentVersion.query({ client: trx })
          .where({
            id: document.currentVersionId,
            documentId: document.id,
            workspaceId: document.workspaceId,
          })
          .first()
      : null
    let contentReady = false
    if (version) {
      try {
        const content = new ContentService().normalize(version.content)
        const meaningful = (node: (typeof content.content)[number]): boolean =>
          !!node.text?.trim() || node.type === 'image' || !!node.content?.some(meaningful)
        contentReady = content.content.some(meaningful)
      } catch {
        contentReady = false
      }
    }
    const review = document.activeReviewId
      ? await DocumentReview.query({ client: trx })
          .where({
            id: document.activeReviewId,
            documentId: document.id,
            workspaceId: document.workspaceId,
          })
          .first()
      : null
    const currentReview =
      !!review &&
      !review.invalidatedAt &&
      review.versionId === document.currentVersionId &&
      review.inputHash === reviewInputHash(document) &&
      fingerprint(review.sourcePins) === fingerprint(pins)
    const editorialPrerequisites = contentReady && !blocked && !generation
    const approval = document.activeApprovalId
      ? await DocumentApproval.query({ client: trx })
          .where({
            id: document.activeApprovalId,
            documentId: document.id,
            workspaceId: document.workspaceId,
          })
          .first()
      : null
    const approved =
      !!approval &&
      !approval.invalidatedAt &&
      approval.reviewId === review?.id &&
      approval.versionId === document.currentVersionId &&
      approval.approvedById === document.userId &&
      document.status === 'approved' &&
      !document.legacyApprovalUnverified &&
      currentReview &&
      sourcesReady &&
      !information.length &&
      editorialPrerequisites &&
      warnings.every(
        (warning) =>
          Array.isArray(approval.warningAcknowledgments) &&
          approval.warningAcknowledgments.includes(warning.id)
      )
    const editorialReasons = [
      ...(!contentReady ? ['Save nonempty document content.'] : []),
      ...(blocked ? ['Resolve all open blocking issues.'] : []),
      ...(generation ? ['Wait for the active generation request.'] : []),
      ...(!currentReview ? ['Submit the current saved version for review.'] : []),
    ]
    const stages: ReadinessStage[] = [
      {
        key: 'project_information',
        label: 'Project information',
        complete: !information.length,
        reasons: information.map(
          (key) => `Complete ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}.`
        ),
      },
      {
        key: 'source_preparation',
        label: 'Source preparation',
        complete: sourcesReady,
        reasons: sourcesReady
          ? []
          : [
              document.sourceMode === 'input_only'
                ? 'Remove selected files for input-only writing.'
                : 'Select source files and wait for their current processing runs to be ready.',
            ],
      },
      {
        key: 'editorial_readiness',
        label: 'Editorial readiness',
        complete: editorialPrerequisites && currentReview,
        reasons: editorialReasons,
      },
      {
        key: 'approval',
        label: 'Current-version approval',
        complete: approved,
        reasons: approved
          ? []
          : [
              'The document owner must approve the exact current review and acknowledge its evidence warnings.',
            ],
      },
    ]
    return {
      stages,
      percentage: stages.filter((stage) => stage.complete).length * 25,
      warnings,
      pins,
      review,
      approval,
      canSubmit: !information.length && sourcesReady && editorialPrerequisites,
      approved,
    }
  }
}
