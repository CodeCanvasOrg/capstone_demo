import type { HttpContext } from '@adonisjs/core/http'
import FilePolicy from '#policies/file_policy'
import AccessService from '#services/workspaces/access_service'
import ProjectFilesService from '#services/files/project_files_service'
import { fileProjectValidator } from '#validators/file'
export default class FileProjectsController {
  async store({ workspaceAccess, params, request, bouncer, response }: HttpContext) {
    const file = await new AccessService().file(workspaceAccess!, params.id)
    await bouncer.with(FilePolicy).authorize('manageProjects', file)
    const { projectId } = await request.validateUsing(fileProjectValidator)
    await new ProjectFilesService().attach(workspaceAccess!, file.id, projectId)
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
    return response.redirect().back()
  }
  async destroy({ workspaceAccess, params, request, bouncer, response }: HttpContext) {
    const file = await new AccessService().file(workspaceAccess!, params.id)
    await bouncer.with(FilePolicy).authorize('manageProjects', file)
    const project = await new AccessService().project(workspaceAccess!, params.projectId)
    await new ProjectFilesService().detach(workspaceAccess!, file.id, project.id)
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
    return response.redirect().back()
  }
}
