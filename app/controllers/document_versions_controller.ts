import Document from '#models/document'
import { documentVersionValidator } from '#validators/document_version'
import type { HttpContext } from '@adonisjs/core/http'

export default class DocumentVersionsController {
  async handle({ request, params, auth, response, bouncer }: HttpContext) {
    const document = await Document.findByOrFail({ id: params.documentId })
    const userId = auth.user?.id

    // Authorize if user can update the document before continuing quering the database
    await bouncer.with('DocumentVersionPolicy').authorize('create', document)

    const latestVersion = await document
      .related('documentVersions')
      .query()
      .orderBy('version', 'desc')
      .firstOrFail()

    const validated = await request.validateUsing(documentVersionValidator)

    const payload = {
      ...validated,
      version: (latestVersion.version ?? 0) + 1,
      userId,
    }

    await document.related('documentVersions').create(payload)
    document.merge({ status: 'editing' })
    await document.save()

    return response.redirect().toRoute('documents.edit', {
      id: document.id,
    })
  }
}
