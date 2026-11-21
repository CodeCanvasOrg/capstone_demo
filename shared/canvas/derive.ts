import { STAT_SEPARATOR } from '../brochure/content.ts'
import { readingCompare } from './geometry.ts'
import type { CanvasDocument, Frame, Sheet, TipTapBlock } from './model.ts'

/**
 * The text of a canvas as an ordinary stored document: sheets in order, frames
 * in reading order, a page break between sheets. It is written to the version's
 * content on every save, so checks, citations, evidence, search and the web
 * export work on a canvas exactly as on a text-only document. Shapes and art
 * carry no text and are skipped. Browser-safe.
 */
export function readingOrder(sheet: Sheet): Frame[] {
  return [...sheet.frames].sort((a, b) => a.order - b.order || readingCompare(a.geo, b.geo))
}

const paragraph = (text: string): TipTapBlock => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
})

function blocksOf(frame: Frame): TipTapBlock[] {
  switch (frame.kind) {
    case 'text':
      return frame.doc as TipTapBlock[]
    case 'figure':
      // The same "83% — of executives" convention a text-only brochure uses.
      return [
        paragraph(frame.label ? `${frame.value}${STAT_SEPARATOR}${frame.label}` : frame.value),
      ]
    case 'image':
      return frame.imageId
        ? [{ type: 'image', attrs: { documentImageId: frame.imageId, alt: frame.alt || null } }]
        : []
    default:
      return []
  }
}

export function deriveDocument(
  canvas: CanvasDocument,
  attrs?: Record<string, unknown>
): { type: 'doc'; attrs?: Record<string, unknown>; content: TipTapBlock[] } {
  const content: TipTapBlock[] = []
  canvas.sheets.forEach((sheet, index) => {
    if (index > 0) content.push({ type: 'horizontalRule' })
    for (const frame of readingOrder(sheet)) content.push(...blocksOf(frame))
  })
  return { type: 'doc', ...(attrs ? { attrs } : {}), content }
}
