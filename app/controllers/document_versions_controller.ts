import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
import VersionService from '#services/documents/version_service'
import { documentVersionValidator } from '#validators/document_version'
import DocumentVersionPolicy from '#policies/document_version_policy'
export default class DocumentVersionsController {
  async handle({ request, params, workspaceAccess, response, bouncer }: HttpContext) {
    const document = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentVersionPolicy).authorize('create', document)
    const payload = await request.validateUsing(documentVersionValidator)
    const version = await new VersionService().save(workspaceAccess!, document.id, payload)
    if (request.accepts(['html', 'json']) === 'json')
      return response.ok({ data: { version: { id: version.id, version: version.version } } })
    return response
      .redirect()
      .toRoute('documents.edit', { workspaceId: workspaceAccess!.workspaceId, id: document.id })
  }
}
