import Document from '#models/document'
import DocumentPolicy from '#policies/document_policy'
import DocumentTransformer from '#transformers/document_transformer'
import { documentValidator } from '#validators/documents'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import DocumentGenerationService from '#services/documents/document_generation_service'

export default class DocumentsController {
  /**
   * Display a list of resource
   */
  async index({ auth, inertia }: HttpContext) {
    const documents = await auth.user!.related('documents').query().orderBy('updatedAt', 'desc')

    return inertia.render('documents/index', {
      documents: DocumentTransformer.transform(documents),
    })
  }

  /**
   * Display form to create a new record
   */
  async create({ inertia }: HttpContext) {
    return inertia.render('documents/create', {})
  }

  /**
   * Handle form submission for the create action
   */
  async store({ auth, request, response }: HttpContext) {
    const { files: submittedFiles, ...payload } = await request.validateUsing(documentValidator)

    try {
      const document = await new DocumentGenerationService().create(
        auth.user!,
        payload,
        submittedFiles ?? []
      )

      return response.redirect().toRoute('documents.edit', { id: document.id })
    } catch (error) {
      logger.error({ err: error }, 'Failed to create document')
      return response.redirect().toRoute('documents.create')
    }
  }

  /**
   * Edit individual record
   */
  async edit({ params, bouncer, inertia }: HttpContext) {
    const document = await Document.query()
      .where('id', params.id)
      .preload('user')
      .preload('documentShares', (share) => share.preload('user'))
      .preload('documentVersions', (version) => version.preload('user').orderBy('version', 'desc'))
      .preload('files')
      .firstOrFail()

    await bouncer.with(DocumentPolicy).authorize('edit', document)

    return inertia.render('documents/edit', {
      document: DocumentTransformer.transform(document),
    })
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, bouncer, response }: HttpContext) {
    const document = await Document.findByOrFail({ id: params.id })

    await bouncer.with(DocumentPolicy).authorize('update', document)

    const { title, description, status } = await request.validateUsing(documentValidator)

    document.merge({ title, description, status })
    await document.save()

    return response.redirect().toRoute('documents.edit', {
      id: document.id,
    })
  }

  /**
   * Delete record
   */
  async destroy({ params, bouncer, response }: HttpContext) {
    const document = await Document.findByOrFail({ id: params.id })

    await bouncer.with(DocumentPolicy).authorize('delete', document)

    await document.delete()

    return response.redirect().toRoute('documents.index')
  }
}
