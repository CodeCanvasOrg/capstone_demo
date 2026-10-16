import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
import WorkflowService from '#services/documents/workflow_service'
import { reviewValidator, approvalValidator } from '#validators/document_review'
export default class DocumentReviewsController {
  async store({ workspaceAccess, params, request, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    await new WorkflowService().transition(
      workspaceAccess!,
      params.documentId,
      await request.validateUsing(reviewValidator)
    )
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
    return response.redirect().back()
  }
  async approve({ workspaceAccess, params, request, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    await new WorkflowService().transition(
      workspaceAccess!,
      params.documentId,
      await request.validateUsing(approvalValidator),
      true
    )
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
    return response.redirect().back()
  }
}
