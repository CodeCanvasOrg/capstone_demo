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
  async list(context: WorkspaceAccessContext, documentId: string, category?: string) {
    new CanvasService().assertEnabled()
    await new AccessService().document(context, documentId)
    const rows = await CanvasTemplate.query()
      .withScopes((scopes) => scopes.visibleTo(context.workspaceId))
      .if(category === 'academic' || category === 'brochure', (query) =>
        query.where('category', category!)
      )
      .orderBy('category')
      .orderBy('name')
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      category: row.category,
      designId: row.designId,
      version: row.version,
      system: row.isSystem,
      slots: row.slots,
      previewUrl: row.previewKey
        ? `/workspaces/${context.workspaceId}/documents/${documentId}/canvas/templates/${row.id}/preview`
        : null,
    }))
  }

  /** The thumbnail image of a template the workspace may see. */
  async preview(context: WorkspaceAccessContext, documentId: string, templateId: string) {
    new CanvasService().assertEnabled()
    if (!uuid(templateId)) throw missingResource()
    await new AccessService().document(context, documentId)
    const row = await CanvasTemplate.query()
      .withScopes((scopes) => scopes.visibleTo(context.workspaceId))
      .where('id', templateId)
      .first()
    if (!row?.previewKey) throw missingResource()
    return { stream: await drive.use().getStream(row.previewKey) }
  }
}
