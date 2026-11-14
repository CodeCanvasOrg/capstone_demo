import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import CollectionService from '#services/layout/collection_service'
import CollectionExportService from '#services/exports/collection_export_service'
import {
  collectionApprovalValidator,
  collectionBudgetValidator,
  collectionCreateValidator,
  collectionUpdateValidator,
} from '#validators/layout'

type Row = Awaited<ReturnType<CollectionService['get']>>
const view = (row: Row) => ({
  id: row.id,
  name: row.name,
  status: row.status,
  manifest: row.manifest,
  manifestHash: row.manifestHash,
  approvedAt: row.approvedAt,
})

export default class CollectionsController {
  /** The page for browsers; the same rows as JSON for the client and API callers. */
  async index({ workspaceAccess, request, response, inertia }: HttpContext) {
    const rows = await new CollectionService().list(workspaceAccess!)
    if (request.accepts(['html', 'json']) === 'json') return response.ok({ data: rows.map(view) })
    // Only saved case studies can be pinned into a collection.
    const documents = await Document.query()
      .where('workspaceId', workspaceAccess!.workspaceId)
      .whereNotNull('currentVersionId')
      .orderBy('title')
    return inertia.render('collections/index', {
      collections: rows.map((row) => ({ id: row.id, name: row.name, status: row.status })),
      documents: documents.map((document) => ({ id: document.id, title: document.title })),
    })
  }

  async store({ workspaceAccess, request, response }: HttpContext) {
    const row = await new CollectionService().create(
      workspaceAccess!,
      await request.validateUsing(collectionCreateValidator)
    )
    return response.created({ data: view(row) })
  }

  async show({ workspaceAccess, params, request, response }: HttpContext) {
    const service = new CollectionService()
    const { target } = await request.validateUsing(collectionBudgetValidator, {
      data: request.qs(),
    })
    const row = await service.get(workspaceAccess!, params.collectionId)
    return response.ok({
      data: {
        ...view(row),
        budget: await service.budget(workspaceAccess!, row.id, { target }),
        contents: await service.contents(workspaceAccess!, row.id),
        state: await service.state(workspaceAccess!, row.id),
      },
    })
  }

  async update({ workspaceAccess, params, request, response }: HttpContext) {
    const row = await new CollectionService().update(
      workspaceAccess!,
      params.collectionId,
      await request.validateUsing(collectionUpdateValidator)
    )
    return response.ok({ data: view(row) })
  }

  async approve({ workspaceAccess, params, request, response }: HttpContext) {
    const { baseHash } = await request.validateUsing(collectionApprovalValidator)
    const row = await new CollectionService().approve(
      workspaceAccess!,
      params.collectionId,
      baseHash
    )
    return response.ok({ data: view(row) })
  }

  /** Watermarked draft of the whole collection; needs no approval. */
  async preview({ workspaceAccess, params, response }: HttpContext) {
    return this.pdf(workspaceAccess!, params.collectionId, false, response)
  }

  /** Final PDF: refused unless the approval is current for every pinned entry. */
  async download({ workspaceAccess, params, response }: HttpContext) {
    return this.pdf(workspaceAccess!, params.collectionId, true, response)
  }

  private async pdf(
    access: NonNullable<HttpContext['workspaceAccess']>,
    id: string,
    final: boolean,
    response: HttpContext['response']
  ) {
    const buffer = await new CollectionExportService().render(access, id, { final })
    return response
      .header('Content-Type', 'application/pdf')
      .header('Cache-Control', 'private, no-store')
      .header(
        'Content-Disposition',
        `${final ? 'attachment' : 'inline'}; filename="collection${final ? '' : '-preview'}.pdf"`
      )
      .send(buffer)
  }
}
