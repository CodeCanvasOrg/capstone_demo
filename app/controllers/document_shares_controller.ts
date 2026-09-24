import Document from '#models/document'
import DocumentShare from '#models/document_share'
import User from '#models/user'
import DocumentSharePolicy from '#policies/document_share_policy'
import DocumentTransformer from '#transformers/document_transformer'
import { documentShareRoleValidator, documentShareValidator } from '#validators/document_share'
import type { HttpContext } from '@adonisjs/core/http'

export default class DocumentSharesController {
  async index({ auth, inertia }: HttpContext) {
    const shares = await auth.user!.related('documentShares').query().preload('document')
    const documents = shares.map((share) => share.document)

    return inertia.render('document_shares/index', {
      documents: DocumentTransformer.transform(documents),
    })
  }

  async store({ request, params, response, bouncer }: HttpContext) {
    const document = await Document.findByOrFail({ id: params.documentId })

    await bouncer.with(DocumentSharePolicy).authorize('store', document)

    const { emails, role } = await request.validateUsing(documentShareValidator)

    const emailList = emails
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)

    const existingShares = await document
      .related('documentShares')
      .query()
      .preload('user')
      .then((rows) => rows.map((share) => share.user.email))

    const existingEmails = new Set(existingShares.map((email) => email?.toLowerCase()))

    console.log(existingShares)

    const users = await User.query().whereIn('email', emailList)

    const shares = users
      .filter((user) => !existingEmails.has(user.email.toLowerCase()))
      .filter((user) => user.id !== document.userId)
      .map((user) => ({
        documentId: document.id,
        userId: user.id,
        role: 'view',
      }))

    if (shares.length > 0) {
      await DocumentShare.createMany(shares)
    }

    return response.redirect().toRoute('documents.edit', {
      id: params.documentId,
    })
  }

  async update({ request, params, response, bouncer }: HttpContext) {
    const documentShare = await DocumentShare.query()
      .where('id', params.id)
      .preload('document', (document) => document.preload('user'))
      .firstOrFail()

    await bouncer.with(DocumentSharePolicy).authorize('update', documentShare)

    const { role } = await request.validateUsing(documentShareRoleValidator)

    documentShare.merge({ role })
    await documentShare.save()

    return response.redirect().toRoute('documents.edit', {
      id: documentShare.documentId,
    })
  }

  async destroy({ params, response, bouncer }: HttpContext) {
    const documentShare = await DocumentShare.findByOrFail({ id: params.id })

    await bouncer.with(DocumentSharePolicy).authorize('delete', documentShare)

    await documentShare.delete()

    return response.redirect().toRoute('documents.edit', {
      id: params.documentId,
    })
  }
}
