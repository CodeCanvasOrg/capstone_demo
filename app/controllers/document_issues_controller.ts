import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
import IssueService from '#services/documents/issue_service'
import { issueValidator, issueUpdateValidator } from '#validators/document_issue'
export default class DocumentIssuesController {
  async store({ workspaceAccess, params, request, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    await new IssueService().save(
      workspaceAccess!,
      params.documentId,
      await request.validateUsing(issueValidator)
    )
    return response.redirect().back()
  }
  async update({ workspaceAccess, params, request, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    await new IssueService().save(
      workspaceAccess!,
      params.documentId,
      await request.validateUsing(issueUpdateValidator),
      params.issueId
    )
    return response.redirect().back()
  }
}
