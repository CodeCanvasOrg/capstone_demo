import { STAT_SEPARATOR } from '../brochure/content.ts'
import { readingCompare } from './geometry.ts'
import {
  FONT_SCALE,
  type CanvasDocument,
  type Frame,
  type Sheet,
  type TextFrame,
  type TipTapBlock,
} from './model.ts'

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

/** All the text of a frame's blocks, for picking frames by what they say. */
const frameText = (frame: TextFrame): string => {
  const parts: string[] = []
  const visit = (node: { text?: string; content?: unknown[] }) => {
    if (typeof node.text === 'string') parts.push(node.text)
    node.content?.forEach((child) => visit(child as typeof node))
  }
  frame.doc.forEach((block) => visit(block as { text?: string; content?: unknown[] }))
  return parts.join('').trim()
}

/**
 * The frames a document's hero should point at: the largest type on the first sheet is the title,
 * the next text frame in reading order its summary. Works for any layout (the portfolio cover, an
 * AI-designed first page), so a generated canvas can rebind publication metadata to them.
 */
export function heroFrames(canvas: CanvasDocument): { title?: TextFrame; summary?: TextFrame } {
  const first = canvas.sheets[0]
  if (!first) return {}
  const texts = readingOrder(first).filter(
    (frame): frame is TextFrame => frame.kind === 'text' && frameText(frame) !== ''
  )
  const size = (frame: TextFrame) =>
    frame.style?.size ?? (frame.style?.font ? FONT_SCALE[frame.style.font] : FONT_SCALE.md)
  let title: TextFrame | undefined
  for (const frame of texts) if (!title || size(frame) > size(title)) title = frame
  const summary = title ? texts[texts.indexOf(title) + 1] : undefined
  return { title, summary }
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
