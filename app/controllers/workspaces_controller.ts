import type { HttpContext } from '@adonisjs/core/http'
import WorkspaceService from '#services/workspaces/workspace_service'
import WorkspacePolicy from '#policies/workspace_policy'
import DocumentTransformer from '#transformers/document_transformer'
import ProjectTransformer from '#transformers/project_transformer'
import { createWorkspaceValidator } from '#validators/workspace'
export default class WorkspacesController {
  async index({ inertia }: HttpContext) {
    return inertia.render('workspaces/index', {})
  }
  async store({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(createWorkspaceValidator)
    const workspace = await new WorkspaceService().create(auth.user!.id, input.name)
    return response.redirect().toRoute('workspaces.show', { workspaceId: workspace.id })
  }
  async show({ workspace, workspaceAccess, bouncer, inertia }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('view', workspace!)
    const documents = await workspace!
      .related('documents')
      .query()
      .preload('user')
      .orderBy('updatedAt', 'desc')
      .limit(6)
    const projects = await workspace!
      .related('projects')
      .query()
      .orderBy('updatedAt', 'desc')
      .limit(12)
    return inertia.render('workspaces/home', {
      documents: DocumentTransformer.transform(documents, workspaceAccess!.actorId),
      projects: ProjectTransformer.transform(projects),
    })
  }
  async update({ workspace, workspaceAccess, request, bouncer, response }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('update', workspace!)
    const input = await request.validateUsing(createWorkspaceValidator)
    await new WorkspaceService().rename(workspaceAccess!, input.name)
    if (!request.header('X-Inertia') && request.accepts(['html', 'json']) === 'json')
      return response.ok({ data: { id: workspace!.id, name: input.name } })
    return response.redirect().toRoute('workspaces.show', { workspaceId: workspace!.id })
  }
  async select({ workspace, workspaceAccess, bouncer, response }: HttpContext) {
    await bouncer.with(WorkspacePolicy).authorize('view', workspace!)
    await new WorkspaceService().select(workspaceAccess!)
    return response.redirect().toRoute('workspaces.show', { workspaceId: workspace!.id })
  }
}
