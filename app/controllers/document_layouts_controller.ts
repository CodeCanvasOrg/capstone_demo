import type { HttpContext } from '@adonisjs/core/http'
import DocumentExportService from '#services/exports/document_export_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { applyPresetValidator, layoutSelectionValidator } from '#validators/layout'

export default class DocumentLayoutsController {
  async show({ workspaceAccess, params, response }: HttpContext) {
    const service = new LayoutSelectionService()
    const selection = await service.resolve(workspaceAccess!, params.documentId)
    return response.ok({
      data: {
        selection,
        catalog: await service.catalog(workspaceAccess!),
        // Null until there is a saved version; never blocks reading the selection.
        report: await new DocumentExportService().layoutReport(workspaceAccess!, params.documentId),
      },
    })
  }

  async update({ workspaceAccess, params, request, response }: HttpContext) {
    const service = new LayoutSelectionService()
    const selection = await service.save(
      workspaceAccess!,
      params.documentId,
      await request.validateUsing(layoutSelectionValidator)
    )
    return response.ok({
      data: {
        selection,
        report: await new DocumentExportService().layoutReport(workspaceAccess!, params.documentId),
      },
    })
  }

  async applyPreset({ workspaceAccess, params, request, response }: HttpContext) {
    const input = await request.validateUsing(applyPresetValidator)
    const selection = await new LayoutSelectionService().applyPreset(
      workspaceAccess!,
      params.documentId,
      input.presetId,
      input.baseRevision
    )
    return response.ok({ data: { selection } })
  }
}
