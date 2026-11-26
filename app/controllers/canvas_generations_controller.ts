import type { HttpContext } from '@adonisjs/core/http'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import AccessService from '#services/workspaces/access_service'
import DocumentPolicy from '#policies/document_policy'
import { canvasGenerateValidator, canvasRegenerateValidator } from '#validators/canvas_generation'

/** Pages are generated for a document the actor may change; the flags are checked first, so off means 404. */
async function mayUpdate(ctx: HttpContext, documentId: string) {
  const service = new CanvasGenerationService()
  service.assertEnabled()
  const doc = await new AccessService().document(ctx.workspaceAccess!, documentId)
  await ctx.bouncer.with(DocumentPolicy).authorize('update', doc)
  return service
}

export default class CanvasGenerationsController {
  /** Queues the generation of the document's pages. */
  async store(ctx: HttpContext) {
    const service = await mayUpdate(ctx, ctx.params.documentId)
    const input = await ctx.request.validateUsing(canvasGenerateValidator)
    const result = await service.request(ctx.workspaceAccess!, ctx.params.documentId, {
      mutationId: input.mutationId,
      baseVersionId: input.baseVersionId,
      options: service.options(input.options),
    })
    return ctx.response.accepted({ data: result })
  }

  /** The latest run: status, stage, the plan and the quality of every page. */
  async show(ctx: HttpContext) {
    const service = new CanvasGenerationService()
    service.assertEnabled()
    const doc = await new AccessService().document(ctx.workspaceAccess!, ctx.params.documentId)
    await ctx.bouncer.with(DocumentPolicy).authorize('edit', doc)
    return ctx.response.ok({
      data: await service.status(ctx.workspaceAccess!, ctx.params.documentId),
    })
  }

  /** Rewrites, deepens or shortens one page, in a new version where only that sheet changes. */
  async regenerate(ctx: HttpContext) {
    const service = await mayUpdate(ctx, ctx.params.documentId)
    const input = await ctx.request.validateUsing(canvasRegenerateValidator)
    const result = await service.requestRegenerate(
      ctx.workspaceAccess!,
      ctx.params.documentId,
      Number(ctx.params.index),
      input
    )
    return ctx.response.accepted({ data: result })
  }
}
