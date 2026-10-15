import type { HttpContext } from '@adonisjs/core/http'
import ProjectPolicy from '#policies/project_policy'
import ProjectService from '#services/workspaces/project_service'
import AccessService from '#services/workspaces/access_service'
import ProjectTransformer from '#transformers/project_transformer'
import DocumentTransformer from '#transformers/document_transformer'
import { createProjectValidator } from '#validators/project'
export default class ProjectsController {
  async index({ workspace, workspaceAccess, bouncer, inertia }: HttpContext) {
    await bouncer.with(ProjectPolicy).authorize('create', workspaceAccess!.workspaceId)
    const projects = await workspace!.related('projects').query().orderBy('updatedAt', 'desc')
    return inertia.render('projects/index', { projects: ProjectTransformer.transform(projects) })
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
    return inertia.render('projects/show', {
      project: ProjectTransformer.transform(project),
      documents: DocumentTransformer.transform(documents, workspaceAccess!.actorId),
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
