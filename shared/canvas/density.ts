import { PLACEHOLDER, FIGURE_PLACEHOLDER } from '../brochure/content.ts'
import {
  FILL,
  effectiveDpi,
  fillRatio,
  fitOf,
  innerMm,
  blocksHeight,
  wordCount,
  MIN_DPI,
  type Fit,
} from './fit.ts'
import { walkNodes, type CanvasDocument, type Frame, type Sheet, type TextFrame } from './model.ts'

/**
 * Quality of a canvas, page by page: words, how full the text frames are, how
 * many citations and placeholders a page has and how sharp its pictures print.
 * The fit loop, the run's stored metrics, the page badges and `canvas:density`
 * all use these numbers. Browser-safe.
 */
export type PageKind = 'title' | 'contents' | 'references' | 'content' | 'other'

export type ImageSize = { width: number; height: number }

export type PageMetrics = {
  index: number
  id: string
  kind: PageKind
  words: number
  /** Share of the page's flowing text frames used (0 to over 1); null where there are none. */
  fill: number | null
  fit: Fit | null
  /** The fullest single frame, to find the one that overflows. */
  maxFrameFill: number | null
  citations: number
  placeholders: number
  images: { frameId: string; imageId: string; dpi: number | null }[]
  lowDpiImages: number
}

const role = (frame: Frame) => frame.id.slice(frame.id.indexOf('-') + 1).replace(/\d+$/, '')
const FLOW_ROLES = new Set(['body', 'col', 'card'])
const CHROME_ROLES = new Set(['run', 'folio'])

/** The page's purpose, read from the roles its frames carry (see academic/compose.ts). */
export function pageKind(sheet: Sheet): PageKind {
  const roles = new Set(sheet.frames.map(role))
  if (roles.has('band')) return 'title'
  if (roles.has('titles')) return 'contents'
  if (roles.has('list')) return 'references'
  if (roles.has('ttl') && [...roles].some((r) => FLOW_ROLES.has(r))) return 'content'
  return 'other'
}

const textOf = (frame: TextFrame) => {
  const parts: string[] = []
  walkNodes(frame.doc, (node) => {
    if (node.type === 'text') parts.push(String((node as { text?: unknown }).text ?? ''))
  })
  return parts.join(' ')
}

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1

export function pageMetrics(
  sheet: Sheet,
  index: number,
  { images = new Map<string, ImageSize>() }: { images?: ReadonlyMap<string, ImageSize> } = {}
): PageMetrics {
  let words = 0
  let citations = 0
  let placeholders = 0
  let used = 0
  let room = 0
  let maxFrameFill: number | null = null
  const found: PageMetrics['images'] = []
  for (const frame of sheet.frames) {
    if (frame.kind === 'image' && frame.imageId) {
      const size = images.get(frame.imageId)
      found.push({
        frameId: frame.id,
        imageId: frame.imageId,
        dpi: size
          ? effectiveDpi(Math.min(size.width, size.height), Math.min(frame.geo.w, frame.geo.h) / 10)
          : null,
      })
    }
    if (frame.kind === 'figure') {
      words += wordCount(frame.label)
      if (frame.value === FIGURE_PLACEHOLDER) placeholders++
    }
    if (frame.kind !== 'text' || CHROME_ROLES.has(role(frame))) continue
    const text = textOf(frame)
    words += wordCount(text)
    placeholders += count(text, PLACEHOLDER) + count(text, FIGURE_PLACEHOLDER)
    walkNodes(frame.doc, (node) => {
      if (node.type === 'sourceCitation') citations++
    })
    // Every text frame must hold its text; only the flowing frames count toward how full the page is.
    const fill = fillRatio(frame.doc as never, frame.geo, frame.style)
    if (FLOW_ROLES.has(role(frame))) {
      used += blocksHeight(frame.doc as never, frame.geo, frame.style)
      room += innerMm(frame.geo, frame.style).h
      maxFrameFill = Math.max(maxFrameFill ?? 0, fill)
    } else if (fill > FILL.high && room >= 0) {
      // A sidebar, lead or takeaway that runs past its frame is overflow too.
      maxFrameFill = Math.max(maxFrameFill ?? 0, fill)
    }
  }
  const fill = room > 0 ? Number((used / room).toFixed(3)) : null
  return {
    index,
    id: sheet.id,
    kind: pageKind(sheet),
    words,
    fill,
    fit: fill === null ? null : fitOf(maxFrameFill !== null && maxFrameFill > FILL.high ? 2 : fill),
    maxFrameFill: maxFrameFill === null ? null : Number(maxFrameFill.toFixed(3)),
    citations,
    placeholders,
    images: found,
    lowDpiImages: found.filter((i) => i.dpi !== null && i.dpi < MIN_DPI).length,
  }
}

export type DensityReport = {
  pages: PageMetrics[]
  words: number
  /** Average fill of content pages. */
  avgFill: number
  citations: number
  placeholders: number
  lowDpiImages: number
  /** Highest 4-word-phrase overlap between a page and any earlier page, 0 to 1. */
  maxOverlap: number
}

const grams = (text: string, n = 4) => {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  const set = new Set<string>()
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(' '))
  return set
}

/** Share of the smaller page's phrases that also appear on the other. */
export function overlap(a: string, b: string): number {
  const x = grams(a)
  const y = grams(b)
  if (!x.size || !y.size) return 0
  let shared = 0
  for (const g of x) if (y.has(g)) shared++
  return shared / Math.min(x.size, y.size)
}

export function densityReport(
  canvas: CanvasDocument,
  options: { images?: ReadonlyMap<string, ImageSize> } = {}
): DensityReport {
  const pages = canvas.sheets.map((sheet, i) => pageMetrics(sheet, i, options))
  const content = pages.filter((p) => p.kind === 'content' && p.fill !== null)
  const texts = canvas.sheets.map((sheet) =>
    sheet.frames
      .filter((f): f is TextFrame => f.kind === 'text' && !CHROME_ROLES.has(role(f)))
      .map(textOf)
      .join(' ')
  )
  let maxOverlap = 0
  for (let i = 1; i < texts.length; i++)
    for (let j = 0; j < i; j++) maxOverlap = Math.max(maxOverlap, overlap(texts[i], texts[j]))
  return {
    pages,
    words: pages.reduce((n, p) => n + p.words, 0),
    avgFill: content.length
      ? Number((content.reduce((n, p) => n + (p.fill ?? 0), 0) / content.length).toFixed(3))
      : 0,
    citations: pages.reduce((n, p) => n + p.citations, 0),
    placeholders: pages.reduce((n, p) => n + p.placeholders, 0),
    lowDpiImages: pages.reduce((n, p) => n + p.lowDpiImages, 0),
    maxOverlap: Number(maxOverlap.toFixed(3)),
  }
}

export type DensityThresholds = { minWords: number; minFill: number; minCitations: number }
export const DEFAULT_THRESHOLDS: DensityThresholds = {
  minWords: 280,
  minFill: 0.7,
  minCitations: 2,
}

export type DensityProblem = { page: number; id: string; code: string; message: string }

/** What a content page falls short of; empty when it passes. Title, contents and references are exempt. */
export function pageProblems(
  page: PageMetrics,
  thresholds: DensityThresholds = DEFAULT_THRESHOLDS
): DensityProblem[] {
  if (page.kind !== 'content') return []
  const problems: DensityProblem[] = []
  const add = (code: string, message: string) =>
    problems.push({ page: page.index + 1, id: page.id, code, message })
  if (page.words < thresholds.minWords)
    add('words', `${page.words} words, under ${thresholds.minWords}`)
  if (page.fill !== null && page.fill < thresholds.minFill)
    add(
      'fill',
      `${Math.round(page.fill * 100)}% full, under ${Math.round(thresholds.minFill * 100)}%`
    )
  if (page.maxFrameFill !== null && page.maxFrameFill > FILL.high)
    add('overflow', `a text frame is ${Math.round(page.maxFrameFill * 100)}% full`)
  if (page.citations < thresholds.minCitations)
    add('citations', `${page.citations} citations, under ${thresholds.minCitations}`)
  if (page.placeholders) add('placeholders', `${page.placeholders} placeholder(s) to fill in`)
  if (page.lowDpiImages) add('dpi', `${page.lowDpiImages} image(s) under ${MIN_DPI} dpi`)
  return problems
}
