import { effectiveDpi, PRINT_DPI } from './fit.ts'

/**
 * How pictures are chosen, matched to a layout slot and printed: pure rules over
 * sizes and hashes, so the image planner, the renderer and the tests agree.
 * Browser-safe.
 */
export type AspectClass = 'landscape' | 'portrait' | 'square'

/** Landscape from 1.2:1, portrait up to 0.83:1, square between. */
export function aspectClass(width: number, height: number): AspectClass {
  const ratio = width / height
  return ratio >= 1.2 ? 'landscape' : ratio <= 0.83 ? 'portrait' : 'square'
}

/** The design variant a picture's shape asks for: landscape text-and-figure, else the side figure. */
export const designForAspect = (aspect: AspectClass) =>
  aspect === 'landscape' ? ('figure_text' as const) : ('side_figure' as const)

/** Number of differing bits between two 64-bit hashes written as 16 hex digits. */
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64
  let bits = 0
  for (const [i, digit] of [...a].entries()) {
    let x = Number.parseInt(digit, 16) ^ Number.parseInt(b[i], 16)
    while (x) {
      bits += x & 1
      x >>= 1
    }
  }
  return bits
}

/** Pictures this close are the same picture (a crop or recompression of it). */
export const DUPLICATE_DISTANCE = 6
export const isDuplicate = (
  hash: string | null | undefined,
  others: readonly (string | null | undefined)[]
) => !!hash && others.some((other) => !!other && hamming(hash, other) <= DUPLICATE_DISTANCE)

export const MIN_BYTES = 4096
export const MAX_ASPECT = 4

export type Candidate = { width: number; height: number; bytes: number }

/** Why a picture cannot go in a slot, or null when it can. */
export function rejection(image: Candidate, minEdge: number): string | null {
  if (image.bytes < MIN_BYTES) return 'too small a file'
  const long = Math.max(image.width, image.height)
  const short = Math.min(image.width, image.height)
  if (short < minEdge) return `shorter edge ${short}px is under ${minEdge}px`
  if (long / short > MAX_ASPECT) return 'too narrow'
  return null
}

/** Relevance of a picture to its page: similarity, plus its source page, less reuse. */
export function scoreCandidate(input: {
  similarity: number
  /** The picture sits on the same source page as a text chunk the page draws on. */
  sameSourcePage?: boolean
  alreadyUsed?: boolean
}): number {
  return Number(
    (input.similarity + (input.sameSourcePage ? 0.2 : 0) - (input.alreadyUsed ? 0.3 : 0)).toFixed(3)
  )
}

export type VariantSize = { purpose: 'thumb' | 'screen' | 'print'; width: number; height: number }

/** Pixels a frame of `w` x `h` tenths of a millimetre needs at `dpi`. */
export const framePixels = (frame: { w: number; h: number }, dpi = PRINT_DPI) => ({
  w: Math.ceil((frame.w / 10 / 25.4) * dpi),
  h: Math.ceil((frame.h / 10 / 25.4) * dpi),
})

/**
 * The smallest variant that still has the pixels the frame needs at print
 * resolution; the largest one when none has. Null when there are no variants.
 */
export function chooseVariant<T extends VariantSize>(
  variants: readonly T[],
  frame: { w: number; h: number },
  dpi = PRINT_DPI
): T | null {
  if (!variants.length) return null
  const need = framePixels(frame, dpi)
  const area = (v: T) => v.width * v.height
  // Of two copies the same size, the better made one: print, then screen, then thumb.
  const quality = (v: T) => ['thumb', 'screen', 'print'].indexOf(v.purpose)
  const enough = variants
    .filter((v) => v.width >= need.w && v.height >= need.h)
    .sort((a, b) => area(a) - area(b) || quality(b) - quality(a))
  return enough[0] ?? [...variants].sort((a, b) => area(b) - area(a) || quality(b) - quality(a))[0]
}

/**
 * Size to resize a picture to so that it covers the frame at print resolution and
 * no more: never enlarged, aspect kept, so `object-fit: cover` can crop it.
 */
export function coverSize(
  image: { width: number; height: number },
  frame: { w: number; h: number },
  dpi = PRINT_DPI
) {
  const need = framePixels(frame, dpi)
  const scale = Math.min(1, Math.max(need.w / image.width, need.h / image.height))
  return {
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
  }
}

/** Resolution a picture prints at in a frame (the plan's short-edge formula). */
export const printDpi = (
  image: { width: number; height: number },
  frame: { w: number; h: number }
) => effectiveDpi(Math.min(image.width, image.height), Math.min(frame.w, frame.h) / 10)
