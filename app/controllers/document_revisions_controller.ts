import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
import RevisionService from '#services/documents/revision_service'
import { documentRevisionValidator } from '#validators/document_revision'
import DocumentVersionPolicy from '#policies/document_version_policy'
export default class DocumentRevisionsController {
  async handle({ request, params, workspaceAccess, response, bouncer }: HttpContext) {
    const document = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentVersionPolicy).authorize('create', document)
    const payload = await request.validateUsing(documentRevisionValidator)
    return response.ok({
      data: await new RevisionService().revise(workspaceAccess!, document.id, payload),
    })
  }
}
