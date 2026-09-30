import FilePolicy from '#policies/file_policy'
import FileTransformer from '#transformers/file_transformer'
import { fileValidator, filesValidator } from '#validators/file'
import type { HttpContext } from '@adonisjs/core/http'

export default class FilesController {
  /**
   * Display a list of resource
   */
  async index({ auth, inertia }: HttpContext) {
    const files = await auth.user!.related('files').query().orderBy('createdAt', 'desc')

    return inertia.render('files/index', {
      files: FileTransformer.transform(files),
    })
  }

  /**
   * Display form to create a new record
   */
  async create({ inertia }: HttpContext) {
    return inertia.render('files/create', {})
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, auth, response }: HttpContext) {
    const { files } = await request.validateUsing(filesValidator)

    if (files.length === 0) {
      return response.redirect().back()
    }

    await auth.user!.related('files').createMany(files)

    return response.redirect().toRoute('files.index')
  }

  /**
   * Edit individual record
   */
  async edit({ params, auth, bouncer, inertia }: HttpContext) {
    const file = await auth
      .user!.related('files')
      .query()
      .where('id', params.id)
      .preload('documents')
      .firstOrFail()

    await bouncer.with(FilePolicy).authorize('update', file)

    return inertia.render('files/edit', {
      file: FileTransformer.transform(file),
    })
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, bouncer, auth, response }: HttpContext) {
    const { ...payload } = await request.validateUsing(fileValidator)

    const file = await auth.user!.related('files').query().where('id', params.id).firstOrFail()

    await bouncer.with(FilePolicy).authorize('update', file)

    file.merge(payload)
    await file.save()

    return response.redirect().toRoute('files.edit', {
      id: file.id,
    })
  }

  /**
   * Delete record
   */
  async destroy({ params, auth, bouncer, response }: HttpContext) {
    const file = await auth.user!.related('files').query().where('id', params.id).firstOrFail()

    await bouncer.with(FilePolicy).authorize('delete', file)

    await file.delete()

    return response.redirect().toRoute('files.index')
  }
}
