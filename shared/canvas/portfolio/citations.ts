import { readingOrder } from '../derive.ts'
import { walkNodes, type CanvasDocument, type Sheet } from '../model.ts'

/**
 * Footnote numbers of a canvas, the way the export numbers them: one number per distinct
 * `sourceChunkId`, in reading order across the sheets (sheet order, then each sheet's frame
 * order). The editor draws these numbers, the sources pages print them, and a test checks
 * them against the real projection. Browser-safe.
 */
export function citationNumbers(canvas: Pick<CanvasDocument, 'sheets'> | readonly Sheet[]) {
  const sheets = Array.isArray(canvas)
    ? (canvas as readonly Sheet[])
    : (canvas as CanvasDocument).sheets
  const numbers = new Map<string, number>()
  for (const sheet of sheets)
    for (const frame of readingOrder(sheet)) {
      if (frame.kind !== 'text') continue
      walkNodes(frame.doc, (node) => {
        const id = node.type === 'sourceCitation' ? node.attrs?.sourceChunkId : undefined
        if (typeof id === 'string' && !numbers.has(id)) numbers.set(id, numbers.size + 1)
      })
    }
  return numbers
}
