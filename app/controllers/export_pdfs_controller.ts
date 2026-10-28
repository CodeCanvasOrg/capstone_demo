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
  async htmlPreview({ workspaceAccess, params, response }: HttpContext) {
    const html = await new DocumentExportService().preview(
      workspaceAccess!,
      params.documentId,
      'html'
    )
    return response
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .header(
        'Content-Security-Policy',
        "default-src 'none';img-src data:;style-src 'unsafe-inline';font-src data:;base-uri 'none';frame-ancestors 'self'"
      )
      .send(html)
  }
  async legacyPreview({ workspaceAccess, params, response }: HttpContext) {
    await new AccessService().document(workspaceAccess!, params.documentId)
    return response.redirect().toRoute('documentPreview.show', {
      workspaceId: workspaceAccess!.workspaceId,
      documentId: params.documentId,
    })
  }
  async preview({ workspaceAccess, params, response }: HttpContext) {
    let buffer
    try {
      buffer = await new DocumentExportService().preview(workspaceAccess!, params.documentId)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'E_PDF_UNAVAILABLE')
        return response
          .status(503)
          .header('Content-Type', 'text/plain; charset=utf-8')
          .header('Cache-Control', 'private, no-store')
          .send(error.message)
      throw error
    }
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
