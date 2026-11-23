import { clampGeo } from './geometry.ts'
import { LIMITS, SHEET, type Frame, type FrameKind, type Geo, type Sheet } from './model.ts'

/**
 * Pure editing operations the editor UI calls: fresh ids, sensible new frames
 * and sheets. Kept out of the React and GrapesJS code so they are unit tested.
 * Browser-safe.
 */

/** A new id not in `taken`, shaped like the composer's (`s3`, `s3-f7`). */
export function freshId(taken: ReadonlySet<string>, prefix: string) {
  for (let i = 0; ; i++) {
    const id = `${prefix}${i}`
    if (!taken.has(id)) return id
  }
}

export const DEFAULT_SIZE: Record<FrameKind, { w: number; h: number }> = {
  text: { w: 800, h: 300 },
  figure: { w: 600, h: 300 },
  image: { w: 800, h: 600 },
  shape: { w: 600, h: 400 },
  art: { w: SHEET.w, h: 1000 },
}

/** Centred on the sheet, nudged down-right past frames already there. */
export function placeNew(kind: FrameKind, existing: readonly Geo[]): Geo {
  const { w, h } = DEFAULT_SIZE[kind]
  let geo: Geo = { x: Math.round((SHEET.w - w) / 2), y: Math.round((SHEET.h - h) / 2), w, h }
  while (existing.some((g) => g.x === geo.x && g.y === geo.y))
    geo = { ...geo, x: geo.x + 100, y: geo.y + 100 }
  return clampGeo(geo)
}

export function newFrame(kind: FrameKind, sheet: Sheet, taken: ReadonlySet<string>): Frame {
  const id = freshId(taken, `${sheet.id}-f`)
  const z = Math.max(-1, ...sheet.frames.map((f) => f.z)) + 1
  const order = Math.max(-1, ...sheet.frames.map((f) => f.order)) + 1
  const geo = placeNew(
    kind,
    sheet.frames.map((f) => f.geo)
  )
  const base = { id, geo, z: Math.min(z, 999), order: Math.min(order, 999), style: {} }
  switch (kind) {
    case 'text':
      return {
        ...base,
        kind,
        doc: [{ type: 'paragraph', content: [{ type: 'text', text: 'New text' }] }],
      }
    case 'figure':
      return { ...base, kind, value: '0%', label: 'What it measures' }
    case 'image':
      return { ...base, kind, imageId: null, alt: '', fit: 'cover' }
    case 'shape':
      return { ...base, kind, shape: 'rect', style: { fill: 'surface' } }
    case 'art':
      return { ...base, kind, art: 'glow' }
  }
}

export function newSheet(taken: ReadonlySet<string>): Sheet {
  return { id: freshId(taken, 's'), background: 'white', frames: [] }
}

/** A copy of a sheet with fresh ids for it and every frame. */
export function duplicateSheet(sheet: Sheet, taken: ReadonlySet<string>): Sheet {
  const ids = new Set(taken)
  const id = freshId(ids, 's')
  ids.add(id)
  return {
    ...structuredClone(sheet),
    id,
    frames: sheet.frames.map((frame) => {
      const frameId = freshId(ids, `${id}-f`)
      ids.add(frameId)
      return { ...structuredClone(frame), id: frameId }
    }),
  }
}

/** A copy of a frame, offset 5 mm, on top of the others. */
export function duplicateFrame(frame: Frame, sheet: Sheet, taken: ReadonlySet<string>): Frame {
  return {
    ...structuredClone(frame),
    id: freshId(taken, `${sheet.id}-f`),
    geo: clampGeo({ ...frame.geo, x: frame.geo.x + 50, y: frame.geo.y + 50 }),
    z: Math.min(Math.max(...sheet.frames.map((f) => f.z), frame.z) + 1, 999),
    order: Math.min(Math.max(...sheet.frames.map((f) => f.order), frame.order) + 1, 999),
  }
}

/** Width a dropped or pasted picture gets on the sheet: 80 mm, at its own proportions. */
export const IMAGE_WIDTH = 800

/**
 * A box for a picture of `width` x `height` pixels, centred on `at` (tenths of
 * a mm), scaled down to fit the sheet. Unknown size gives the default image box.
 */
export function imageGeo(
  at: { x: number; y: number },
  size: { width: number | null; height: number | null } | null
): Geo {
  const ratio = size?.width && size?.height ? size.height / size.width : null
  let { w, h } = ratio ? { w: IMAGE_WIDTH, h: IMAGE_WIDTH * ratio } : DEFAULT_SIZE.image
  // Very tall pictures: shrink until they fit the sheet's height.
  const scale = Math.min(1, SHEET.h / h, SHEET.w / w)
  w = Math.max(LIMITS.minSide, w * scale)
  h = Math.max(LIMITS.minSide, h * scale)
  return clampGeo({ x: at.x - w / 2, y: at.y - h / 2, w, h })
}

/**
 * The frame resized to the picture's proportions: same width and top-left
 * corner, new height (narrower if the height would run off the sheet).
 */
export function fitToImage(geo: Geo, size: { width: number; height: number }): Geo {
  const ratio = size.height / size.width
  let w = geo.w
  let h = w * ratio
  const room = SHEET.h - geo.y
  if (h > room) {
    h = room
    w = h / ratio
  }
  return clampGeo({ ...geo, w, h })
}
