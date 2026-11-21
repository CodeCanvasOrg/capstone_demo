import { clampGeo } from './geometry.ts'
import { SHEET, type Frame, type FrameKind, type Geo, type Sheet } from './model.ts'

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
