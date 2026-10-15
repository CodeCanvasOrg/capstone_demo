import type { HttpContext } from '@adonisjs/core/http'
import AccessService from '#services/workspaces/access_service'
import DocumentExportService from '#services/exports/document_export_service'
import { exportValidator } from '#validators/document_review'
export default class ExportPdfsController {
  async handle({ workspaceAccess, params, request, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    const task = await new DocumentExportService().request(
      workspaceAccess!,
      params.documentId,
      await request.validateUsing(exportValidator)
    )
    return response.accepted({ data: { id: task.id, status: task.status } })
  }
  async preview({ workspaceAccess, params, response }: HttpContext) {
    const buffer = await new DocumentExportService().preview(workspaceAccess!, params.documentId)
    return response
      .header('Content-Type', 'application/pdf')
      .header('Cache-Control', 'private, no-store')
      .header('Content-Disposition', 'inline; filename="case-study-preview.pdf"')
      .send(buffer)
  }
  async download({ workspaceAccess, params, response }: HttpContext) {
    const result = await new DocumentExportService().download(
      workspaceAccess!,
      params.documentId,
      params.taskId
    )
    return response
      .header('Content-Type', 'application/pdf')
      .header('Cache-Control', 'private, no-store')
      .header(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(`${result.title}.pdf`)}`
      )
      .stream(result.stream)
  }
}
