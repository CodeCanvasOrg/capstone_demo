import { blend, contrast, requiredContrast } from './color.ts'
import { MAX_SIZE, MIN_SIZE, isTextRole, resolveText } from './style.ts'
import type {
  CanvasDesign,
  ColorRef,
  DesignFrame,
  DesignPage,
  DesignSystem,
  PaletteRole,
} from './schema.ts'

/**
 * The rules a design must meet before any text is written into it. A problem is worded so the
 * model can act on it in one corrective retry. Browser-safe.
 */
export type DesignProblem = {
  code: 'pages' | 'text' | 'size' | 'contrast' | 'overlap' | 'font' | 'palette'
  /** 1-based page, 0 for the design system. */
  page: number
  frame?: string
  message: string
}

/** Overlap tolerance in canvas units on each axis (hairline contact is not an overlap). */
const TOUCH = 15

export const hexOf = (ref: ColorRef, system: Pick<DesignSystem, 'palette'>) =>
  (system.palette as Record<string, string>)[ref as PaletteRole] ?? ref

type Rect = { x: number; y: number; w: number; h: number }
const rect = (f: DesignFrame): Rect => ({ x: f.x, y: f.y, w: f.w, h: f.h })

function intersection(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? { w, h } : null
}

const area = (r: Rect) => r.w * r.h

/** Whether a text frame paints its own (nearly) opaque background. */
const opaque = (frame: DesignFrame) => !!frame.style?.fill && (frame.style.fillAlpha ?? 100) >= 80

/** The colours that can sit behind a text frame: the page, then the shapes below it. */
function backgrounds(page: DesignPage, index: number, system: DesignSystem) {
  const text = page.frames[index]
  let set = [hexOf(page.background, system)]
  for (const shape of page.frames.slice(0, index)) {
    if (shape.kind !== 'shape' || shape.shape === 'line') continue
    const hit = intersection(rect(text), rect(shape))
    if (!hit) continue
    const share = area(hit as Rect) / area(rect(text))
    const fill = hexOf(shape.style?.fill ?? 'primary', system)
    const alpha = shape.style?.fillAlpha ?? 100
    if (share >= 0.9) set = set.map((c) => blend(fill, c, alpha))
    else if (share > 0.02) set = [...set, ...set.map((c) => blend(fill, c, alpha))]
  }
  if (text.style?.fill)
    set = set.map((c) => blend(hexOf(text.style!.fill!, system), c, text.style?.fillAlpha ?? 100))
  return set
}

export function validateDesign(
  design: CanvasDesign,
  options: { pages: number; allowBrandFont: boolean }
): DesignProblem[] {
  const problems: DesignProblem[] = []
  const { system } = design
  const add = (p: DesignProblem) => problems.push(p)
  if (design.pages.length !== options.pages)
    add({
      code: 'pages',
      page: 0,
      message: `Design exactly ${options.pages} pages; the design had ${design.pages.length}.`,
    })
  if (contrast(system.palette.ink, system.palette.paper) < 4.5)
    add({
      code: 'palette',
      page: 0,
      message: `The palette's ink (${system.palette.ink}) on paper (${system.palette.paper}) is below the WCAG AA contrast of 4.5.`,
    })
  if (
    !options.allowBrandFont &&
    (system.fonts.heading === 'brand' || system.fonts.body === 'brand')
  )
    add({
      code: 'font',
      page: 0,
      message: 'There is no brand font: use "sans" or "display".',
    })
  design.pages.forEach((page, p) => {
    const n = p + 1
    if (!page.frames.some((f) => f.kind === 'text'))
      add({ code: 'text', page: n, message: `Page ${n} has no text frame.` })
    page.frames.forEach((frame, i) => {
      if (frame.kind !== 'text' || !isTextRole(frame.role)) return
      const r = resolveText(frame, system)
      const min = MIN_SIZE[frame.role]
      if (r.size < min)
        add({
          code: 'size',
          page: n,
          frame: frame.id,
          message: `Page ${n} "${frame.id}" (${frame.role}) is ${r.size} pt; the minimum is ${min} pt.`,
        })
      else if (r.size > MAX_SIZE)
        add({
          code: 'size',
          page: n,
          frame: frame.id,
          message: `Page ${n} "${frame.id}" is ${r.size} pt; the maximum is ${MAX_SIZE} pt.`,
        })
      if (r.family === 'brand' && !options.allowBrandFont)
        add({
          code: 'font',
          page: n,
          frame: frame.id,
          message: `Page ${n} "${frame.id}" uses the brand font, which is not available: use "sans" or "display".`,
        })
      const ink = hexOf(r.color, system)
      const need = requiredContrast(r.size, r.weight)
      const worst = Math.min(...backgrounds(page, i, system).map((bg) => contrast(ink, bg)))
      if (worst < need)
        add({
          code: 'contrast',
          page: n,
          frame: frame.id,
          message: `Page ${n} "${frame.id}": ${ink} text on its background has contrast ${worst.toFixed(1)}; WCAG AA needs ${need}. Change the text colour or the colour behind it.`,
        })
    })
    for (let a = 0; a < page.frames.length; a++)
      for (let b = a + 1; b < page.frames.length; b++) {
        const first = page.frames[a]
        const second = page.frames[b]
        const kinds = [first.kind, second.kind].sort().join('+')
        const hit = intersection(rect(first), rect(second))
        if (!hit || hit.w <= TOUCH || hit.h <= TOUCH) continue
        const text = first.kind === 'text' ? first : second.kind === 'text' ? second : null
        const bad =
          kinds === 'text+text' ||
          kinds === 'image+image' ||
          // Text over a picture or art is only readable with a background of its own.
          ((kinds === 'image+text' || kinds === 'art+text') && !(text && opaque(text)))
        if (bad)
          add({
            code: 'overlap',
            page: n,
            frame: first.id,
            message: `Page ${n}: "${first.id}" and "${second.id}" overlap (${kinds.replace('+', ' and ')}). Move or shrink one so they do not touch.`,
          })
      }
  })
  return problems
}

export const problemList = (problems: readonly DesignProblem[], max = 24) =>
  problems
    .slice(0, max)
    .map((p) => p.message)
    .join('\n')
