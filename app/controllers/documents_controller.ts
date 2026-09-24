import Document from '#models/document'
import DocumentPolicy from '#policies/document_policy'
import initDocumentContent from '#services/documents/init_tiptap_doc'
import DocumentTransformer from '#transformers/document_transformer'
import { documentValidator } from '#validators/documents'
import type { HttpContext } from '@adonisjs/core/http'

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
    const { status, ...payload } = await request.validateUsing(documentValidator)

    const document = await auth.user!.related('documents').create({ ...payload, status: 'pending' })
    await document
      .related('documentVersions')
      .create({ content: initDocumentContent(), version: 1, userId: auth.user?.id })

    return response.redirect().toRoute('documents.edit', {
      id: document.id,
    })
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

    const { ...payload } = await request.validateUsing(documentValidator)

    document.merge(payload)
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
