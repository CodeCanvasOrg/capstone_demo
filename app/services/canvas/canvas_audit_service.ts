import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentCanvasDraft from '#models/document_canvas_draft'
import DocumentImage from '#models/document_image'
import DocumentLayout from '#models/document_layout'
import { parseCanvas, type CanvasDocument } from '../../../shared/canvas/model.ts'

/** What changed between the saved version and the autosaved draft. */
export type CanvasDiff = {
  deletedFrames: string[]
  addedFrames: string[]
  deletedSheets: string[]
  addedSheets: string[]
}

export type CanvasAudit = {
  documentId: string
  title: string
  versionId: string | null
  /** Sheets in the saved version, or null when it has no canvas. */
  sheets: number | null
  draft: null | {
    revision: number
    /** Started from an older version: the editor ignores it and so does the preview. */
    stale: boolean
    sheets: number
    diff: CanvasDiff
  }
  images: {
    /** Image boxes with no picture yet. */
    empty: string[]
    /** Image boxes whose picture is not an image of this document. */
    missing: string[]
    /** Pictures in use whose size is unknown (`node ace images:measure`). */
    unmeasured: string[]
  }
  /** Stored canvas data that no longer passes the schema. */
  problems: string[]
}

const frameIds = (canvas: CanvasDocument) =>
  new Set(canvas.sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.id)))
const sheetIds = (canvas: CanvasDocument) => new Set(canvas.sheets.map((sheet) => sheet.id))
const minus = (a: Set<string>, b: Set<string>) => [...a].filter((id) => !b.has(id)).sort()

/**
 * Read-only health report for canvas documents, for `node ace canvas:audit`:
 * unsaved deletions and additions in drafts, and image boxes that will print
 * empty or fail to print. Reads stored rows only; changes nothing.
 */
export default class CanvasAuditService {
  static diff(saved: CanvasDocument | null, draft: CanvasDocument): CanvasDiff {
    const empty = { schemaVersion: 1, sheets: [] } as unknown as CanvasDocument
    const before = saved ?? empty
    return {
      deletedFrames: minus(frameIds(before), frameIds(draft)),
      addedFrames: minus(frameIds(draft), frameIds(before)),
      deletedSheets: minus(sheetIds(before), sheetIds(draft)),
      addedSheets: minus(sheetIds(draft), sheetIds(before)),
    }
  }

  /** Every document of the workspace open in the canvas, or just `documentId`. */
  async audit(workspaceId: string, documentId?: string): Promise<CanvasAudit[]> {
    const layouts = await DocumentLayout.query()
      .where({ workspaceId, editorMode: 'canvas' })
      .if(documentId, (query) => query.where('documentId', documentId!))
      .select('documentId')
    const reports: CanvasAudit[] = []
    for (const { documentId: id } of layouts) {
      const doc = await Document.query().where({ id, workspaceId }).first()
      if (doc) reports.push(await this.document(doc))
    }
    return reports.sort((a, b) => a.title.localeCompare(b.title))
  }

  private async document(doc: Document): Promise<CanvasAudit> {
    const workspaceId = doc.workspaceId!
    const problems: string[] = []
    const images = await DocumentImage.query()
      .where({ workspaceId, documentId: doc.id })
      .select('id', 'width', 'height')
    const imageIds = new Set(images.map((image) => image.id))
    const unmeasuredIds = new Set(images.filter((i) => !i.width || !i.height).map((i) => i.id))

    const read = (label: string, project: unknown) => {
      // Without image ids: a missing picture is reported below, not as invalid data.
      const parsed = parseCanvas(project)
      if (parsed.ok) return parsed.canvas
      problems.push(
        ...parsed.problems.slice(0, 5).map((p) => `${label}: ${p.path || '(root)'} ${p.message}`)
      )
      return null
    }

    const row = doc.currentVersionId
      ? await DocumentCanvas.query().where('versionId', doc.currentVersionId).first()
      : null
    const saved = row ? read('version', row.project) : null
    const draftRow = await DocumentCanvasDraft.query()
      .where({ documentId: doc.id, workspaceId })
      .first()
    const draft = draftRow ? read('draft', draftRow.project) : null
    const stale = !!draftRow && draftRow.baseVersionId !== doc.currentVersionId

    // Images as they will print: the draft when the preview uses it, else the version.
    const shown = draft && !stale ? draft : saved
    const empty: string[] = []
    const missing: string[] = []
    const unmeasured = new Set<string>()
    for (const frame of shown?.sheets.flatMap((sheet) => sheet.frames) ?? []) {
      if (frame.kind !== 'image') continue
      if (!frame.imageId) empty.push(frame.id)
      else if (!imageIds.has(frame.imageId)) missing.push(frame.id)
      else if (unmeasuredIds.has(frame.imageId)) unmeasured.add(frame.imageId)
    }

    return {
      documentId: doc.id,
      title: doc.title,
      versionId: doc.currentVersionId,
      sheets: saved?.sheets.length ?? null,
      draft:
        draftRow && draft
          ? {
              revision: draftRow.revision,
              stale,
              sheets: draft.sheets.length,
              diff: CanvasAuditService.diff(saved, draft),
            }
          : null,
      images: { empty: empty.sort(), missing: missing.sort(), unmeasured: [...unmeasured].sort() },
      problems,
    }
  }
}
