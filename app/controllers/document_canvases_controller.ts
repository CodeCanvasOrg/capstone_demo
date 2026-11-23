import type { HttpContext } from '@adonisjs/core/http'
import CanvasService from '#services/canvas/canvas_service'
import DocumentImage from '#models/document_image'
import CanvasGenerationService, {
  canvasGenerationEnabled,
} from '#services/canvas/generation/canvas_generation_service'
import AccessService from '#services/workspaces/access_service'
import DocumentPolicy from '#policies/document_policy'
import { getBrandKit } from '../../shared/layout/brand.ts'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import {
  canvasDraftValidator,
  canvasEnableValidator,
  canvasSaveValidator,
} from '#validators/canvas'

/** Every canvas write needs permission to change the document. */
async function mayUpdate(
  bouncer: HttpContext['bouncer'],
  access: WorkspaceAccessContext,
  documentId: string
) {
  const doc = await new AccessService().document(access, documentId)
  await bouncer.with(DocumentPolicy).authorize('update', doc)
}

export default class DocumentCanvasesController {
  /** The editor page. */
  async show({ workspaceAccess, params, inertia, bouncer }: HttpContext) {
    const service = new CanvasService()
    const state = await service.state(workspaceAccess!, params.documentId)
    const doc = await new AccessService().document(workspaceAccess!, params.documentId)
    await bouncer.with(DocumentPolicy).authorize('edit', doc)
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
      generation: await this.generation(workspaceAccess!, doc.id, selection.options.canvas),
    })
  }

  /** What the "Generate pages" dialog needs: whether it is on, the last options and the latest run. */
  private async generation(context: WorkspaceAccessContext, documentId: string, saved: unknown) {
    if (!canvasGenerationEnabled()) return { enabled: false as const }
    const service = new CanvasGenerationService()
    return {
      enabled: true as const,
      options: service.options(saved),
      images: await DocumentImage.query()
        .where({ workspaceId: context.workspaceId, documentId })
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      run: await service.status(context, documentId),
    }
  }

  async project({ workspaceAccess, params, response }: HttpContext) {
    return response.ok({
      data: await new CanvasService().state(workspaceAccess!, params.documentId),
    })
  }

  async enable({ workspaceAccess, params, request, response, bouncer }: HttpContext) {
    await mayUpdate(bouncer, workspaceAccess!, params.documentId)
    const { mutationId } = await request.validateUsing(canvasEnableValidator)
    return response.ok({
      data: await new CanvasService().enable(workspaceAccess!, params.documentId, mutationId),
    })
  }

  async disable({ workspaceAccess, params, response, bouncer }: HttpContext) {
    await mayUpdate(bouncer, workspaceAccess!, params.documentId)
    return response.ok({
      data: await new CanvasService().disable(workspaceAccess!, params.documentId),
    })
  }

  async draft({ workspaceAccess, params, request, response, bouncer }: HttpContext) {
    await mayUpdate(bouncer, workspaceAccess!, params.documentId)
    const input = await request.validateUsing(canvasDraftValidator)
    return response.ok({
      data: await new CanvasService().draft(workspaceAccess!, params.documentId, input),
    })
  }

  async save({ workspaceAccess, params, request, response, bouncer }: HttpContext) {
    await mayUpdate(bouncer, workspaceAccess!, params.documentId)
    const input = await request.validateUsing(canvasSaveValidator)
    const { version } = await new CanvasService().save(workspaceAccess!, params.documentId, input)
    return response.ok({
      data: { versionId: version.id, version: version.version },
    })
  }
}
