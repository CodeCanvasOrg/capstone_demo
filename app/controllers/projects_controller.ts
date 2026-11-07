import type { HttpContext } from '@adonisjs/core/http'
import ProjectPolicy from '#policies/project_policy'
import ProjectService from '#services/workspaces/project_service'
import AccessService from '#services/workspaces/access_service'
import ProjectTransformer from '#transformers/project_transformer'
import DocumentTransformer from '#transformers/document_transformer'
import FileTransformer from '#transformers/file_transformer'
import { createProjectValidator } from '#validators/project'
export default class ProjectsController {
  async index({ workspace, workspaceAccess, bouncer, request, inertia }: HttpContext) {
    await bouncer.with(ProjectPolicy).authorize('create', workspaceAccess!.workspaceId)
    const q = String(request.input('q', '')).slice(0, 200)
    const query = workspace!.related('projects').query().orderBy('updatedAt', 'desc')
    if (q) query.whereILike('name', `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
    const projects = await query.paginate(
      Math.min(100000, Math.max(1, Math.floor(Number(request.input('page', 1)) || 1))),
      20
    )
    return inertia.render('projects/index', {
      projects: ProjectTransformer.transform(projects.all()),
      pagination: projects.getMeta(),
      filters: { q },
    })
  }
  async show({ workspaceAccess, workspace, params, bouncer, inertia }: HttpContext) {
    const project = await new AccessService().project(workspaceAccess!, params.projectId)
    await bouncer.with(ProjectPolicy).authorize('view', project)
    const documents = await workspace!
      .related('documents')
      .query()
      .where('projectId', project.id)
      .preload('user')
      .orderBy('updatedAt', 'desc')
    const files = await project
      .related('files')
      .query()
      .preload('projects')
      .preload('revisions', (revision) =>
        revision
          .orderBy('revision', 'desc')
          .preload('processingRuns', (run) => run.orderBy('createdAt', 'desc'))
      )
      .orderBy('createdAt', 'desc')
    // Linking is owner-only, so only the actor's own unlinked files are offered.
    const attachable = await workspace!
      .related('files')
      .query()
      .where('userId', workspaceAccess!.actorId)
      .whereDoesntHave('projects', (projects) => projects.where('projects.id', project.id))
      .orderBy('filename')
    return inertia.render('projects/show', {
      project: ProjectTransformer.transform(project),
      documents: DocumentTransformer.transform(documents, workspaceAccess!.actorId),
      files: FileTransformer.transform(files, workspaceAccess!.actorId),
      attachableFiles: FileTransformer.transform(attachable, workspaceAccess!.actorId),
    })
  }
  async store({ workspaceAccess, request, bouncer, response }: HttpContext) {
    await bouncer.with(ProjectPolicy).authorize('create', workspaceAccess!.workspaceId)
    const input = await request.validateUsing(createProjectValidator)
    const project = await new ProjectService().save(workspaceAccess!, input)
    return response.redirect().toRoute('projects.show', {
      workspaceId: workspaceAccess!.workspaceId,
      projectId: project.id,
    })
  }
  async update({ workspaceAccess, request, params, bouncer, response }: HttpContext) {
    const project = await new AccessService().project(workspaceAccess!, params.projectId)
    await bouncer.with(ProjectPolicy).authorize('update', project)
    await new ProjectService().save(
      workspaceAccess!,
      await request.validateUsing(createProjectValidator),
      project.id
    )
    return response.redirect().toRoute('projects.show', {
      workspaceId: workspaceAccess!.workspaceId,
      projectId: project.id,
    })
  }
}
