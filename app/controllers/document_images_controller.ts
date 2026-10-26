import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'
import AccessService from '#services/workspaces/access_service'
import DocumentImageService from '#services/documents/document_image_service'
import DocumentPolicy from '#policies/document_policy'
import { documentImageValidator } from '#validators/document_image'

export default class DocumentImagesController {
  async store({ params, request, response, workspaceAccess, bouncer }: HttpContext) {
    const document = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentPolicy).authorize('update', document)
    const { file } = await request.validateUsing(documentImageValidator)
    if (!file.tmpPath) return response.unprocessableEntity({ message: 'Choose an image to upload' })
    const image = await new DocumentImageService().upload(workspaceAccess!, document.id, {
      filename: file.clientName,
      contents: await readFile(file.tmpPath),
    })
    return response.created({ data: image })
  }

  async show({ params, response, workspaceAccess, bouncer }: HttpContext) {
    const document = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentPolicy).authorize('edit', document)
    const asset = await new DocumentImageService().asset(
      workspaceAccess!,
      document.id,
      params.imageId
    )
    return response
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "sandbox; default-src 'none'")
      .header('Content-Type', asset.mime)
      .stream(asset.stream)
  }
}
