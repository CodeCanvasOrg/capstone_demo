import DocumentIssue from '#models/document_issue'
import DocumentIssueTransformer from '#transformers/document_issue_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
import IssueService from '#services/documents/issue_service'
import { issueValidator, issueUpdateValidator } from '#validators/document_issue'
export default class DocumentIssuesController {
  async index(ctx: HttpContext) {
    const { workspaceAccess, params, response } = ctx
    await new AccessService().document(workspaceAccess!, params.documentId)
    const issues = await DocumentIssue.query()
      .where({ workspaceId: workspaceAccess!.workspaceId, documentId: params.documentId })
      .orderBy('createdAt', 'desc')
    return response.ok(await ctx.serialize(DocumentIssueTransformer.transform(issues)))
  }
  async store({ workspaceAccess, params, request, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    await new IssueService().save(
      workspaceAccess!,
      params.documentId,
      await request.validateUsing(issueValidator)
    )
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
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
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
    return response.redirect().back()
  }
}
