import FilePolicy from '#policies/file_policy'
import FileTransformer from '#transformers/file_transformer'
import { fileValidator } from '#validators/file'
import AccessService from '#services/workspaces/access_service'
import LibraryService from '#services/files/library_service'
import type { HttpContext } from '@adonisjs/core/http'
export default class FilesController {
  async index({ workspace, workspaceAccess, bouncer, request, inertia }: HttpContext) {
    await bouncer.with(FilePolicy).authorize('create', workspaceAccess!.workspaceId)
    const query = workspace!
      .related('files')
      .query()
      .preload('revisions', (revision) =>
        revision
          .orderBy('revision', 'desc')
          .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
      )
      .orderBy('createdAt', 'desc')
    const q = String(request.input('q', '')).slice(0, 200)
    if (q) query.whereILike('filename', `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
    const page = await query.paginate(
      Math.min(100000, Math.max(1, Math.floor(Number(request.input('page', 1)) || 1))),
      20
    )
    return inertia.render('files/index', {
      files: FileTransformer.transform(page.all(), workspaceAccess!.actorId),
      pagination: page.getMeta(),
      filters: { q },
    })
  }
  async create({ workspaceAccess, bouncer, inertia }: HttpContext) {
    await bouncer.with(FilePolicy).authorize('create', workspaceAccess!.workspaceId)
    return inertia.render('files/create', {})
  }
  async store({ workspaceAccess, response }: HttpContext) {
    return response.redirect().toRoute('files.index', { workspaceId: workspaceAccess!.workspaceId })
  }
  async edit({ workspaceAccess, params, bouncer, inertia }: HttpContext) {
    const file = await new AccessService().file(workspaceAccess!, params.id)
    await bouncer.with(FilePolicy).authorize('view', file)
    await file.load('documents', (query) =>
      query.where('documents.workspace_id', workspaceAccess!.workspaceId)
    )
    await file.load('revisions', (revision) =>
      revision
        .orderBy('revision', 'desc')
        .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
    )
    return inertia.render('files/edit', {
      file: FileTransformer.transform(file, workspaceAccess!.actorId),
    })
  }
  async update({ workspaceAccess, params, request, bouncer, response }: HttpContext) {
    const file = await new AccessService().file(workspaceAccess!, params.id)
    await bouncer.with(FilePolicy).authorize('update', file)
    const { filename } = await request.validateUsing(fileValidator)
    await new LibraryService().change(workspaceAccess!, file.id, filename ?? '')
    return response
      .redirect()
      .toRoute('files.edit', { workspaceId: workspaceAccess!.workspaceId, id: file.id })
  }
  async destroy({ workspaceAccess, params, bouncer, response }: HttpContext) {
    const file = await new AccessService().file(workspaceAccess!, params.id)
    await bouncer.with(FilePolicy).authorize('delete', file)
    await new LibraryService().change(workspaceAccess!, file.id)
    return response.redirect().toRoute('files.index', { workspaceId: workspaceAccess!.workspaceId })
  }
}
