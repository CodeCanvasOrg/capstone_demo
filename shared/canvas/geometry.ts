import { LIMITS, SHEET, type Geo } from './model.ts'

/**
 * Geometry helpers shared by the editor (dragging, snapping) and the renderer.
 * Stored values are integer tenths of a millimetre; the editor works in CSS
 * pixels at some zoom. CSS defines 1in = 96px = 25.4mm. Browser-safe.
 */
export const PX_PER_MM = 96 / 25.4

export const toPx = (tenths: number, zoom = 1) => (tenths / 10) * PX_PER_MM * zoom
export const fromPx = (px: number, zoom = 1) => Math.round((px / zoom / PX_PER_MM) * 10)

/** CSS length for a stored value, e.g. 205 → "20.5mm". */
export const mm = (tenths: number) => `${Number((tenths / 10).toFixed(1))}mm`

/** Parses "20.5mm", "77.5px" or "20%" (of the sheet axis) back to tenths of a mm. */
export function parseLength(value: string | number | undefined, axis: 'w' | 'h'): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? fromPx(value) : null
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*(mm|px|%)?\s*$/.exec(value ?? '')
  if (!match) return null
  const n = Number(match[1])
  switch (match[2]) {
    case 'mm':
      return Math.round(n * 10)
    case '%':
      return Math.round((n / 100) * SHEET[axis])
    default:
      return fromPx(n)
  }
}

/** Keeps a frame at least the minimum size and fully inside its sheet. */
export function clampGeo(geo: Geo): Geo {
  const w = Math.min(Math.max(Math.round(geo.w), LIMITS.minSide), SHEET.w)
  const h = Math.min(Math.max(Math.round(geo.h), LIMITS.minSide), SHEET.h)
  const x = Math.min(Math.max(Math.round(geo.x), 0), SHEET.w - w)
  const y = Math.min(Math.max(Math.round(geo.y), 0), SHEET.h - h)
  return { x, y, w, h }
}

/**
 * Snaps a moved frame's edges and centre to the grid, the sheet edges and
 * centre, and the edges of other frames, when within `threshold` (tenths of
 * a mm). Each axis snaps on its own.
 */
export function snapGeo(
  geo: Geo,
  others: readonly Geo[],
  { grid = 10, threshold = 15 }: { grid?: number; threshold?: number } = {}
): Geo {
  const axis = (pos: number, size: number, lines: number[]) => {
    const anchors = [0, size / 2, size]
    let best: number | null = null
    for (const anchor of anchors)
      for (const line of lines) {
        const delta = line - (pos + anchor)
        if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best)))
          best = delta
      }
    if (best !== null) return pos + best
    return Math.round(pos / grid) * grid
  }
  const xs = [0, SHEET.w / 2, SHEET.w, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])]
  const ys = [0, SHEET.h / 2, SHEET.h, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]
  return clampGeo({
    ...geo,
    x: axis(geo.x, geo.w, xs),
    y: axis(geo.y, geo.h, ys),
  })
}

/** Top-left reading order: rows first (with a 5 mm tolerance), then left to right. */
export function readingCompare(a: Geo, b: Geo) {
  if (Math.abs(a.y - b.y) > 50) return a.y - b.y
  return a.x - b.x
}
