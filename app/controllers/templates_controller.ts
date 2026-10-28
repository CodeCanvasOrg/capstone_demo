import type { HttpContext } from '@adonisjs/core/http'
import DocumentPolicy from '#policies/document_policy'
import OutlineTemplateService from '#services/documents/outline_template_service'
export default class TemplatesController {
  async index({ workspaceAccess, bouncer, response }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    return response.ok({ data: await new OutlineTemplateService().list(workspaceAccess!) })
  }
}
