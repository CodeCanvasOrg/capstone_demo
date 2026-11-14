import type { HttpContext } from '@adonisjs/core/http'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { catalogValidator } from '#validators/layout'

export default class LayoutCatalogController {
  /** Enabled templates for a content type, published brand kits and this workspace's presets. */
  async show({ workspaceAccess, request, response }: HttpContext) {
    const { docType } = await request.validateUsing(catalogValidator, { data: request.qs() })
    return response.ok({
      data: await new LayoutSelectionService().catalog(workspaceAccess!, docType),
    })
  }
}
