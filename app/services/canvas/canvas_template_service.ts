import drive from '@adonisjs/drive/services/main'
import CanvasTemplate from '#models/canvas_template'
import CanvasService from '#services/canvas/canvas_service'
import AccessService, {
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'

/** The templates a canvas offers: system ones and the workspace's own, with their previews. */
export default class CanvasTemplateService {
  /** Without a document (the New case study form) the previews are served by the workspace-level route. */
  async list(context: WorkspaceAccessContext, documentId: string | null, category?: string) {
    new CanvasService().assertEnabled()
    if (documentId) await new AccessService().document(context, documentId)
    const rows = await CanvasTemplate.query()
      .withScopes((scopes) => scopes.visibleTo(context.workspaceId))
      .if(category === 'academic' || category === 'brochure' || category === 'portfolio', (query) =>
        query.where('category', category!)
      )
      .orderBy('category')
      // The whole sample first, then its pages in reading order (cover, entry, sources).
      .orderByRaw("kind asc, array_position(array['cover','entry','sources'], design_id), name")
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      category: row.category,
      designId: row.designId,
      templateKey: row.templateKey,
      version: row.version,
      system: row.isSystem,
      slots: row.slots,
      // A document's gallery and the New case study form (no document) have their own routes.
      previewUrl: row.previewKey
        ? documentId
          ? `/workspaces/${context.workspaceId}/documents/${documentId}/canvas/templates/${row.id}/preview`
          : `/workspaces/${context.workspaceId}/canvas-templates/${row.id}/preview`
        : null,
    }))
  }

  /** The thumbnail image of a template the workspace may see. */
  async preview(context: WorkspaceAccessContext, documentId: string | null, templateId: string) {
    new CanvasService().assertEnabled()
    if (!uuid(templateId)) throw missingResource()
    if (documentId) await new AccessService().document(context, documentId)
    const row = await CanvasTemplate.query()
      .withScopes((scopes) => scopes.visibleTo(context.workspaceId))
      .where('id', templateId)
      .first()
    if (!row?.previewKey) throw missingResource()
    return { stream: await drive.use().getStream(row.previewKey) }
  }
}
