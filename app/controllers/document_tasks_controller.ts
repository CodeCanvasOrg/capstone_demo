import DocumentPolicy from '#policies/document_policy'
import PreparationService from '#services/files/preparation_service'
import SourceSelectionService from '#services/documents/source_selection_service'
import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
import GenerationService from '#services/documents/generation_service'
import TaskService from '#services/workspaces/task_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import FilePolicy from '#policies/file_policy'
import { generateValidator, sourceSelectionValidator } from '#validators/document_task'
export default class DocumentTasksController {
  async generate({ workspaceAccess, params, request, response, bouncer }: HttpContext) {
    const document = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentPolicy).authorize('update', document)
    const input = await request.validateUsing(generateValidator)
    const task = await new GenerationService().request(
      workspaceAccess!,
      params.documentId,
      input.mutationId,
      input.baseVersionId
    )
    if (request.accepts(['html', 'json']) === 'json')
      return response.accepted({ data: { id: task.id, status: task.status } })
    return response.redirect().back()
  }
  async show({ workspaceAccess, params, response }: HttpContext) {
    return response.ok({ data: await new TaskService().show(workspaceAccess!, params.taskId) })
  }
  async retry({ workspaceAccess, params, bouncer, request, response }: HttpContext) {
    const context = workspaceAccess!
    const file = await new AccessService().file(context, params.id)
    await bouncer.with(FilePolicy).authorize('update', file)
    const { mutationId } = await request.validateUsing(generateValidator)
    await new PreparationService().request(context, file.id, mutationId)
    await new TaskDispatchService().dispatch()
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
    return response.redirect().back()
  }
  async sources({ workspaceAccess, params, request, response, bouncer }: HttpContext) {
    const context = workspaceAccess!
    const document = await new AccessService().document(context, params.documentId)
    await bouncer.with(DocumentPolicy).authorize('update', document)
    const input = await request.validateUsing(sourceSelectionValidator)
    await new SourceSelectionService().update(context, params.documentId, input)
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: { saved: true } })
    return response.redirect().back()
  }
}
