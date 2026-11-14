import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import Document from '#models/document'
import Workspace from '#models/workspace'
import DocumentReview from '#models/document_review'
import DocumentApproval from '#models/document_approval'
import WorkflowEvent from '#models/workflow_event'
import ReadinessService, { reviewInputHash } from '#services/documents/readiness_service'
import AccessService, {
  conflict,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { fingerprint } from '#services/workspaces/task_service'
import BundleService from '#services/layout/bundle_service'
export default class WorkflowService {
  async invalidate(
    document: Document,
    actorId: number,
    reason: string,
    trx: TransactionClientContract
  ) {
    if (!document.activeReviewId && !document.activeApprovalId) return
    const now = DateTime.utc()
    await DocumentReview.query({ client: trx })
      .where({ workspaceId: document.workspaceId, documentId: document.id })
      .whereNull('invalidatedAt')
      .update({ invalidatedAt: now, invalidationReason: reason })
    await DocumentApproval.query({ client: trx })
      .whereNull('snapshotHash')
      .where({ workspaceId: document.workspaceId, documentId: document.id })
      .whereNull('invalidatedAt')
      .update({ invalidatedAt: now, invalidationReason: reason })
    await WorkflowEvent.create(
      {
        workspaceId: document.workspaceId!,
        documentId: document.id,
        actorId,
        operation: 'invalidate',
        mutationId: randomUUID(),
        requestHash: fingerprint(reason),
        result: { reason },
      },
      { client: trx }
    )
    document.merge({
      activeReviewId: null,
      activeApprovalId: null,
      status: document.currentVersionId ? 'edited' : 'draft',
    })
  }
  async transition(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      baseVersionId: string
      mutationId: string
      reviewId?: string
      warningAcknowledgments?: string[]
    },
    approve = false
  ) {
    return db.transaction(async (trx) => {
      await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (approve && document.userId !== context.actorId)
        throw new Exception('Only the document owner can approve', { status: 403 })
      const operation = approve ? 'approve' : 'review'
      const hash = fingerprint(input)
      const previous = await WorkflowEvent.query({ client: trx })
        .where({
          workspaceId: context.workspaceId,
          documentId,
          actorId: context.actorId,
          operation,
          mutationId: input.mutationId,
        })
        .first()
      if (previous) {
        if (previous.requestHash !== hash) throw conflict('This request identity was already used')
        return previous.result
      }
      if (document.currentVersionId !== input.baseVersionId)
        throw conflict('The current document version changed')
      const readiness = await new ReadinessService().inspect(document, trx)
      if (!readiness.canSubmit)
        throw conflict(
          'Complete project information, source preparation and editorial checks before review'
        )
      let result: Record<string, unknown>
      if (approve) {
        if (
          !readiness.review ||
          readiness.review.id !== input.reviewId ||
          (readiness.reviewRequired && !readiness.stages[2].complete)
        )
          throw conflict('Submit this exact version for review before approving')
        const acknowledgments = [...new Set(input.warningAcknowledgments ?? [])].sort()
        if (readiness.warnings.some((warning) => !acknowledgments.includes(warning.id)))
          throw conflict('Acknowledge every current evidence warning before approval')
        if (document.activeApprovalId) throw conflict('This version is already approved')
        const bundle = await new BundleService().current(document, trx)
        const approval = await DocumentApproval.create(
          {
            workspaceId: context.workspaceId,
            documentId,
            reviewId: readiness.review.id,
            versionId: input.baseVersionId,
            approvedById: context.actorId,
            warningAcknowledgments: acknowledgments,
            // The exact content, template, brand, options and assets the owner reviewed.
            bundleHash: bundle?.hash ?? null,
          },
          { client: trx }
        )
        document.merge({
          activeApprovalId: approval.id,
          status: 'approved',
          legacyApprovalUnverified: false,
        })
        result = { approvalId: approval.id, versionId: input.baseVersionId }
      } else {
        await this.invalidate(document, context.actorId, 'A new review was submitted', trx)
        const review = await DocumentReview.create(
          {
            workspaceId: context.workspaceId,
            documentId,
            versionId: input.baseVersionId,
            submittedById: context.actorId,
            inputHash: reviewInputHash(document),
            sourcePins: readiness.pins,
          },
          { client: trx }
        )
        document.merge({ activeReviewId: review.id, activeApprovalId: null, status: 'in_review' })
        result = { reviewId: review.id, versionId: input.baseVersionId }
      }
      await document.save()
      await WorkflowEvent.create(
        {
          workspaceId: context.workspaceId,
          documentId,
          actorId: context.actorId,
          operation,
          mutationId: input.mutationId,
          requestHash: hash,
          result,
        },
        { client: trx }
      )
      return result
    })
  }
}
