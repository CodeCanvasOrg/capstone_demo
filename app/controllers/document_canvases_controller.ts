import type { HttpContext } from '@adonisjs/core/http'
import CanvasService from '#services/canvas/canvas_service'
import AccessService from '#services/workspaces/access_service'
import { getBrandKit } from '../../shared/layout/brand.ts'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import {
  canvasDraftValidator,
  canvasEnableValidator,
  canvasSaveValidator,
} from '#validators/canvas'

export default class DocumentCanvasesController {
  /** The editor page. */
  async show({ workspaceAccess, params, inertia }: HttpContext) {
    const service = new CanvasService()
    const state = await service.state(workspaceAccess!, params.documentId)
    const doc = await new AccessService().document(workspaceAccess!, params.documentId)
    const selection = await new LayoutSelectionService().peek(
      workspaceAccess!.workspaceId,
      params.documentId
    )
    const brand = getBrandKit(selection.brandId, selection.brandVersion)
    return inertia.render('documents/canvas', {
      document: { id: doc.id, title: doc.title },
      workspaceId: workspaceAccess!.workspaceId,
      state,
      brand: brand ? { palette: brand.palette, fonts: brand.fonts.map((f) => f.family) } : null,
    })
  }

  async project({ workspaceAccess, params, response }: HttpContext) {
    return response.ok({
      data: await new CanvasService().state(workspaceAccess!, params.documentId),
    })
  }

  async enable({ workspaceAccess, params, request, response }: HttpContext) {
    const { mutationId } = await request.validateUsing(canvasEnableValidator)
    return response.ok({
      data: await new CanvasService().enable(workspaceAccess!, params.documentId, mutationId),
    })
  }

  async disable({ workspaceAccess, params, response }: HttpContext) {
    return response.ok({
      data: await new CanvasService().disable(workspaceAccess!, params.documentId),
    })
  }

  async draft({ workspaceAccess, params, request, response }: HttpContext) {
    const input = await request.validateUsing(canvasDraftValidator)
    return response.ok({
      data: await new CanvasService().draft(workspaceAccess!, params.documentId, input),
    })
  }

  async save({ workspaceAccess, params, request, response }: HttpContext) {
    const input = await request.validateUsing(canvasSaveValidator)
    const { version } = await new CanvasService().save(workspaceAccess!, params.documentId, input)
    return response.ok({
      data: { versionId: version.id, version: version.version },
    })
  }
}
