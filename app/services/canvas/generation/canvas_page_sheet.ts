import DocumentImage from '#models/document_image'
import {
  composeAcademicSheet,
  type AcademicImage,
  type AcademicInput,
  type AcademicMeta,
} from '../../../../shared/canvas/academic/compose.ts'
import { ACADEMIC_DESIGNS } from '../../../../shared/canvas/academic/designs.ts'
import type { CanvasDocument } from '../../../../shared/canvas/model.ts'
import type { PageRecord } from './canvas_pipeline.ts'

/**
 * The picture already on a sheet, for a page that is rewritten or re-laid out: the
 * canvas keeps its image, caption and focal point when only the text changes.
 */
export async function imageOnSheet(
  workspaceId: string,
  documentId: string,
  canvas: CanvasDocument,
  index: number
): Promise<AcademicImage | null> {
  const frame = canvas.sheets[index]?.frames.find((f) => f.kind === 'image')
  if (!frame || frame.kind !== 'image' || !frame.imageId) return null
  const image = await DocumentImage.query()
    .where({ id: frame.imageId, workspaceId, documentId })
    .first()
  return {
    imageId: frame.imageId,
    alt: frame.alt || image?.altText || '',
    caption: image?.caption ?? '',
    focus: frame.focus ?? null,
  }
}

/** Figure number of page `index`: pictures on the pages before it, plus one. */
export function figureNumber(
  rows: Pick<PageRecord, 'index' | 'design' | 'imageIds'>[],
  index: number
) {
  return (
    1 +
    rows.filter(
      (row) =>
        row.index < index &&
        row.imageIds.length > 0 &&
        ACADEMIC_DESIGNS[row.design as keyof typeof ACADEMIC_DESIGNS]?.images.length
    ).length
  )
}

/**
 * Replaces one sheet of a canvas with a freshly composed one, leaving every other
 * sheet exactly as it is (the author may have edited them).
 */
export function replaceSheet(
  canvas: CanvasDocument,
  index: number,
  input: AcademicInput,
  meta: AcademicMeta,
  figure: number
): CanvasDocument {
  const next = structuredClone(canvas)
  next.sheets[index] = composeAcademicSheet(input, index, meta, { figure })
  return next
}
