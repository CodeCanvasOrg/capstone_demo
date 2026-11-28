import { SHEET } from '../model.ts'
import {
  TEXT_ROLES,
  type CanvasDesign,
  type DesignFrame,
  type DesignPage,
  type FrameRole,
} from './schema.ts'

/**
 * What is repaired without asking the model again: ids, frame roles, geometry. Text and image
 * frames are held inside the page margins, shapes and art may bleed to the sheet edge, nothing is
 * smaller than the canvas allows, and a page keeps a bounded number of frames. Everything it
 * changes is counted into a reviewer note. Browser-safe.
 */

export const MAX_FRAMES = 40
export const MAX_IMAGES = 4
/** Smallest text or image frame, canvas units. */
const MIN_TEXT = { w: 200, h: 60 }
const MIN_IMAGE = { w: 200, h: 200 }

/** A frame id as the canvas stores it: lower case token, short enough for the sheet prefix. */
export function tokenFor(id: string, used: ReadonlySet<string>, fallback: string) {
  const base =
    id
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 26) || fallback
  const start = /^[a-z]/.test(base) ? base : `f${base}`
  let token = start
  for (let n = 2; used.has(token); n++) token = `${start.slice(0, 22)}-${n}`
  return token
}

const KIND_ROLES: Record<DesignFrame['kind'], readonly FrameRole[]> = {
  text: TEXT_ROLES,
  image: ['image'],
  shape: ['panel', 'rule', 'decor'],
  art: ['decor'],
}

const DEFAULT_ROLE: Record<DesignFrame['kind'], FrameRole> = {
  text: 'body',
  image: 'image',
  shape: 'decor',
  art: 'decor',
}

type Rect = { x: number; y: number; w: number; h: number }

/** `r` inside `bounds`: shrunk to fit if larger, moved if outside. */
function inside(r: Rect, bounds: Rect, min: { w: number; h: number }): Rect {
  const w = Math.min(Math.max(Math.round(r.w), min.w), bounds.w)
  const h = Math.min(Math.max(Math.round(r.h), min.h), bounds.h)
  const x = Math.min(Math.max(Math.round(r.x), bounds.x), bounds.x + bounds.w - w)
  const y = Math.min(Math.max(Math.round(r.y), bounds.y), bounds.y + bounds.h - h)
  return { x, y, w, h }
}

const differs = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) > 2 ||
  Math.abs(a.y - b.y) > 2 ||
  Math.abs(a.w - b.w) > 2 ||
  Math.abs(a.h - b.h) > 2

export function normalizePage(page: DesignPage, margin: number) {
  let moved = 0
  let dropped = 0
  const used = new Set<string>()
  const frames: DesignFrame[] = []
  let images = 0
  const live = { x: margin, y: margin, w: SHEET.w - 2 * margin, h: SHEET.h - 2 * margin }
  const sheet = { x: 0, y: 0, w: SHEET.w, h: SHEET.h }
  page.frames.forEach((frame, i) => {
    if (frames.length >= MAX_FRAMES || (frame.kind === 'image' && images >= MAX_IMAGES))
      return void dropped++
    if (frame.kind === 'image') images++
    const id = tokenFor(frame.id, used, `f${i + 1}`)
    used.add(id)
    const role = KIND_ROLES[frame.kind].includes(frame.role) ? frame.role : DEFAULT_ROLE[frame.kind]
    const asked = { x: frame.x, y: frame.y, w: frame.w, h: frame.h }
    const bounds = frame.kind === 'text' || frame.kind === 'image' ? live : sheet
    const min =
      frame.kind === 'text'
        ? MIN_TEXT
        : frame.kind === 'image'
          ? MIN_IMAGE
          : frame.kind === 'art'
            ? { w: 100, h: 100 }
            : { w: 2, h: 2 }
    const geo = inside(asked, bounds, min)
    if (
      differs(geo, {
        x: Math.round(asked.x),
        y: Math.round(asked.y),
        w: Math.round(asked.w),
        h: Math.round(asked.h),
      })
    )
      moved++
    frames.push({
      ...frame,
      id,
      role,
      ...geo,
      shape: frame.kind === 'shape' ? (frame.shape ?? 'rect') : frame.shape,
      art: frame.kind === 'art' ? (frame.art ?? 'glow') : frame.art,
    })
  })
  return { page: { ...page, frames }, moved, dropped }
}

export function normalizeDesign(design: CanvasDesign) {
  const margin = Math.round(design.system.grid.margin)
  const notes: string[] = []
  let moved = 0
  let dropped = 0
  const pages = design.pages.map((page) => {
    const result = normalizePage(page, margin)
    moved += result.moved
    dropped += result.dropped
    return result.page
  })
  if (moved)
    notes.push(
      `The design placed ${moved} frame${moved === 1 ? '' : 's'} outside the page margins or below the minimum size; they were moved or resized.`
    )
  if (dropped)
    notes.push(
      `${dropped} frame${dropped === 1 ? ' was' : 's were'} dropped to keep at most ${MAX_FRAMES} frames and ${MAX_IMAGES} pictures a page.`
    )
  return {
    design: {
      ...design,
      system: { ...design.system, grid: { ...design.system.grid, margin } },
      pages,
    },
    notes,
  }
}
