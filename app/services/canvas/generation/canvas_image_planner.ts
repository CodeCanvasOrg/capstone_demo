import type { ImageEvidence } from '#services/documents/retrieval_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { AcademicImage } from '../../../../shared/canvas/academic/compose.ts'
import type { PagePlan } from '../../../../shared/canvas/academic/content.ts'
import type { ImageSlot } from '../../../../shared/canvas/academic/designs.ts'
import type { CanvasOptions } from '../../../../shared/canvas/academic/options.ts'

/** A picture chosen for a page, before and after it is registered as a document image. */
export type ImageChoice = {
  /** The document image; null until a source image is promoted. */
  imageId: string | null
  origin: 'upload' | 'source'
  slot: ImageSlot
  /** What the picture is, for the writer and the caption. */
  description: string
  width: number
  height: number
  focus?: { x: number; y: number } | null
  caption?: string | null
  alt?: string | null
  /** The source chunk a promoted image came from. */
  chunkId?: string
}

export type ImageSelectInput = {
  context: WorkspaceAccessContext
  documentId: string
  options: CanvasOptions
  pages: PagePlan[]
  /** Image chunks that matched each page, by page index. */
  evidence: Map<number, ImageEvidence[]>
  guard: () => Promise<void>
}

/**
 * Stage 5, chosen and placed. `select` runs before the pages are written, so the
 * lead of a figure page can say what the figure shows; `place` runs after the fit,
 * captions each chosen picture and registers source images with the document.
 * (Filled in by the images phase; with no choices every page falls back to a
 * text layout.)
 */
export default class CanvasImagePlanner {
  async select(_input: ImageSelectInput): Promise<Map<number, ImageChoice>> {
    return new Map()
  }

  async place(
    _input: ImageSelectInput & { choices: Map<number, ImageChoice> }
  ): Promise<Map<number, AcademicImage & { dpi: number | null }>> {
    return new Map()
  }
}
