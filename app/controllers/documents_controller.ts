import Document from '#models/document'
import DocumentPolicy from '#policies/document_policy'
import { documentValidator } from '#validators/documents'
import type { HttpContext } from '@adonisjs/core/http'
export default class DocumentsController {
  private serialize(document: Document) {
    return {
      id: document.id,
      user_id: document.userId,
      title: document.title,
      description: document.description,
      status: document.status,
      createdAt: document.createdAt?.toISO() ?? null,
      updatedAt: document.updatedAt?.toISO() ?? null,
    }
  }

  /**
   * Display a list of resource
   */
  async index({ auth, inertia }: HttpContext) {
    const documents = await auth.user!.related('documents').query().orderBy('updatedAt', 'desc')

    return inertia.render('documents/index', {
      documents: documents.map((document) => this.serialize(document)),
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
    const { ...payload } = await request.validateUsing(documentValidator)

    const document = await auth.user!.related('documents').create({ ...payload })

    return response.redirect().toRoute('documents.edit', {
      id: document.id,
    })
  }

  /**
   * Edit individual record
   */
  async edit({ params, bouncer, inertia }: HttpContext) {
    const document = await Document.findByOrFail({ id: params.id })

    await bouncer.with(DocumentPolicy).authorize('edit', document)

    return inertia.render('documents/edit', { document: this.serialize(document) })
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
