import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import File from '#models/file'
import AccessService, { missingResource, uuid } from '#services/workspaces/access_service'
export default class LegacyResourcesController {
  async document({ auth, params, response }: HttpContext) {
    if (!uuid(params.id ?? params.documentId)) throw missingResource()
    const document = await Document.find(params.id ?? params.documentId)
    if (
      !document?.workspaceId ||
      !(await new AccessService().active(auth.user!.id, document.workspaceId))
    )
      throw missingResource()
    return response
      .redirect()
      .toRoute('documents.edit', { workspaceId: document.workspaceId, id: document.id })
  }
  async file({ auth, params, response }: HttpContext) {
    if (!uuid(params.id)) throw missingResource()
    const file = await File.find(params.id)
    if (!file?.workspaceId || !(await new AccessService().active(auth.user!.id, file.workspaceId)))
      throw missingResource()
    return response.redirect().toRoute('files.edit', { workspaceId: file.workspaceId, id: file.id })
  }
  async retired({ response }: HttpContext) {
    return response.status(410).send({
      error: {
        code: 'E_LEGACY_ROUTE',
        message: 'Open the workspace page and retry this action',
        retryable: false,
      },
    })
  }
}
