import type { HttpContext } from '@adonisjs/core/http'
import CanvasTemplateService from '#services/canvas/canvas_template_service'
import AccessService from '#services/workspaces/access_service'
import DocumentPolicy from '#policies/document_policy'

export default class CanvasTemplatesController {
  /** Templates for the gallery, optionally one category. */
  async index({ workspaceAccess, params, request, response, bouncer }: HttpContext) {
    const doc = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentPolicy).authorize('edit', doc)
    return response.ok({
      data: await new CanvasTemplateService().list(
        workspaceAccess!,
        params.documentId,
        request.qs().category
      ),
    })
  }

  /** The templates for a workspace's New case study form, which has no document yet. */
  async workspaceIndex({ workspaceAccess, request, response, bouncer }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    return response.ok({
      data: await new CanvasTemplateService().list(workspaceAccess!, null, request.qs().category),
    })
  }

  /** The thumbnail of one template, for the New case study form. */
  async workspacePreview({ workspaceAccess, params, response, bouncer }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    const preview = await new CanvasTemplateService().preview(
      workspaceAccess!,
      null,
      params.templateId
    )
    return response
      .header('Cache-Control', 'private, max-age=300')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Type', 'image/png')
      .stream(preview.stream)
  }

  /** The thumbnail of one template. */
  async preview({ workspaceAccess, params, response, bouncer }: HttpContext) {
    const doc = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentPolicy).authorize('edit', doc)
    const preview = await new CanvasTemplateService().preview(
      workspaceAccess!,
      params.documentId,
      params.templateId
    )
    return response
      .header('Cache-Control', 'private, max-age=300')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Type', 'image/png')
      .stream(preview.stream)
  }
}
