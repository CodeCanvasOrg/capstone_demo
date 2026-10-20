import { BaseTransformer } from '@adonisjs/core/transformers'
import type ReadinessService from '#services/documents/readiness_service'
import type DocumentApproval from '#models/document_approval'
import DocumentReadinessTransformer from './document_readiness_transformer.ts'
import DocumentReviewTransformer from './document_review_transformer.ts'
import DocumentApprovalTransformer from './document_approval_transformer.ts'
export default class DocumentWorkflowTransformer extends BaseTransformer<{
  state: Awaited<ReturnType<ReadinessService['inspect']>>
  approvalHistory: DocumentApproval[]
}> {
  toObject() {
    const { state, approvalHistory } = this.resource
    return {
      readiness: DocumentReadinessTransformer.transform(state),
      review: state.review ? DocumentReviewTransformer.transform(state.review) : null,
      approval: state.approval ? DocumentApprovalTransformer.transform(state.approval) : null,
      approvalHistory: DocumentApprovalTransformer.transform(approvalHistory),
    }
  }
}
