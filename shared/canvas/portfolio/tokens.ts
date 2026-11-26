import type { CanvasColor, FrameStyle } from '../model.ts'

/**
 * The navy and gold portfolio template's design tokens, from
 * `docs/design/portfolio-template/tokens.json` (the design's source of truth; a unit test
 * compares every slot box here with that file). Lengths are in points, as the design states
 * them, and become the canvas unit (tenths of a millimetre) in `pt()`. Browser-safe.
 */

export const TEMPLATE_ID = 'portfolio'
/** Bumped when the layout changes, so a canvas pinned to an older one never changes under it. */
export const TEMPLATE_VERSION = 1

/** Tenths of a millimetre per point. */
export const PT = 254 / 72

/** A length in points as the canvas unit. */
export const pt = (points: number) => Math.round(points * PT)

/** A4 in points. */
export const PAGE = { w: 595.2756, h: 841.8898 } as const

/** Colours of the design. The first seven are the brand kit's palette (`shared/layout/brand.ts`). */
export const COLORS = {
  navy: '#14213d',
  gold: '#f2a900',
  goldDark: '#8a6a10',
  paper: '#f6f4ee',
  white: '#ffffff',
  muted: '#6b7280',
  /** Soft text on navy. */
  light: '#c9d0e0',
  inkSecondary: '#3a4560',
  line: '#e3e0d6',
  green: '#1f7a5a',
  red: '#b23a3a',
  hexOuter: '#be890e',
  hexMiddle: '#81641e',
  hexInner: '#594b29',
  hexFill: '#c88f0b',
} as const

/** Brand-palette references for the colours the kit carries, so a brand update restyles them. */
export const BRAND: Record<string, CanvasColor> = {
  navy: 'primary',
  gold: 'accent',
  goldDark: 'accentText',
  paper: 'surface',
  white: 'white',
  muted: 'muted',
}

/** A colour as the style value: the brand reference when there is one, otherwise plain hex. */
export const tone = (name: keyof typeof COLORS): CanvasColor => BRAND[name] ?? COLORS[name]

// ----------------------------------------------------------------------- type

export type TypeSpec = {
  /** Size and line height in points. */
  size: number
  line: number
  weight: 400 | 600 | 700
  /** Letter spacing in points. */
  tracking?: number
  color: keyof typeof COLORS
  display?: boolean
  caps?: boolean
}

/** Every text treatment of the design, by role (`type_scale` and the slot fonts of tokens.json). */
export const TYPE = {
  eyebrow: { size: 8.5, line: 12, weight: 600, tracking: 1.53, color: 'gold', caps: true },
  coverTitle: {
    size: 38,
    line: 39.4,
    weight: 700,
    tracking: -1.25,
    color: 'white',
    display: true,
  },
  coverSubtitle: { size: 13, line: 18.75, weight: 400, color: 'light' },
  metaLabel: { size: 7.5, line: 12, weight: 700, tracking: 1.05, color: 'goldDark', caps: true },
  metaValue: { size: 10, line: 13.5, weight: 600, color: 'navy' },
  metaSecondary: { size: 9, line: 13.5, weight: 400, color: 'inkSecondary' },
  tagNumber: { size: 7.5, line: 12, weight: 600, color: 'white' },
  tagLabel: { size: 7.5, line: 12, weight: 600, tracking: 1.05, color: 'gold', caps: true },
  heading: {
    size: 24,
    line: 29,
    weight: 700,
    tracking: -0.75,
    color: 'navy',
    display: true,
  },
  intro: { size: 11, line: 16.5, weight: 400, color: 'navy' },
  rowLabel: { size: 10.3, line: 13.2, weight: 700, color: 'navy' },
  rowBody: { size: 8.8, line: 13.2, weight: 600, color: 'green' },
  footer: { size: 7, line: 10, weight: 400, color: 'muted' },
  sourceNumber: { size: 7.5, line: 7.5, weight: 700, color: 'goldDark' },
  sourceName: { size: 10, line: 13.5, weight: 700, color: 'navy' },
  sourceLocator: { size: 7.5, line: 12, weight: 400, color: 'goldDark' },
  sourceNote: { size: 9, line: 13.5, weight: 400, color: 'inkSecondary' },
  evidenceTitle: { size: 13, line: 18.75, weight: 700, color: 'navy' },
  evidenceHead: { size: 7.5, line: 13.2, weight: 600, color: 'goldDark' },
  evidenceCell: { size: 8.8, line: 13.2, weight: 400, color: 'navy' },
  evidenceKind: { size: 8.8, line: 13.2, weight: 400, color: 'green' },
  noteTitle: { size: 9, line: 13.5, weight: 700, color: 'navy' },
  noteBody: { size: 9, line: 13.5, weight: 400, color: 'navy' },
} as const satisfies Record<string, TypeSpec>
export type TypeRole = keyof typeof TYPE

/** A role as a canvas frame style: exact size, line height and tracking. */
export function style(role: TypeRole, extra: FrameStyle = {}): FrameStyle {
  const t: TypeSpec = TYPE[role]
  return {
    size: t.size,
    lineHeight: Math.round((t.line / t.size) * 1000) / 10,
    weight: t.weight,
    family: t.display ? 'display' : 'brand',
    color: tone(t.color),
    ...(t.tracking ? { tracking: Math.round((t.tracking / t.size) * 1000) } : {}),
    ...(t.caps ? { caps: true } : {}),
    ...extra,
  }
}

// ------------------------------------------------------------------- geometry

export const MARGIN = 51
export const CONTENT_W = 493.5

export const COVER = {
  left: 56.67,
  navyHeight: 666,
  eyebrow: { y: 259.99, w: 330 },
  title: { y: 277.99, w: 349.99, lines: 3 },
  subtitle: { y: 415, w: 390, lines: 3 },
  rule: { x: 57, y: 488.25, w: 84.75, h: 3.75 },
  meta: { y: 738.2, w: 154.99, gap: 15.08, valueGap: 3 },
} as const

export const HEADER = {
  tag: { y: 57, w: 20.25, h: 13.5, gap: 8.14, radius: 3.5 },
  label: { y: 57.75 },
  title: { y: 75.49, w: CONTENT_W, h: 29 },
  rule: { y: 114, w: 79.5, h: 3 },
  intro: { y: 127.99, w: 430, lines: 4 },
} as const

export const ENTRY = {
  bodyTop: 207,
  figure: { x: MARGIN, y: 207, w: 221.25, h: 309.75, radius: 3.5, hairline: 0.75 },
  gap: 12,
  rowsX: 284.25,
  rowsW: 260.25,
  /** Space above the label of a row, and the label's line height. */
  rowPad: 6,
  maxRows: 8,
  minRows: 3,
} as const

/** Body lines of each row of an eight-row entry, and the heights the design gives those rows. */
export const ROW_LINES_8 = [2, 2, 3, 1, 2, 2, 1, 2] as const
export const ROW_HEIGHTS_8 = [52.5, 51.75, 66, 39, 52.5, 51.75, 39.75, 52.5] as const
/** Body lines of a row when the entry has fewer than eight rows: there is room for three. */
export const ROW_LINES_FEW = 3

export const FOOTER = { y: 819, h: 10, w: CONTENT_W }

export const SOURCES = {
  top: 207,
  rowPitch: 63.75,
  rowPad: 9,
  numberW: 24,
  textX: 81,
  textW: 463.5,
  perPage: 4,
  evidence: {
    gapAfterRefs: 31,
    titleToHead: 27.75,
    head: { h: 25.57, padTop: 6 },
    row: { h: 31.95, padTop: 9 },
    cols: [
      { x: 51, w: 181.93 },
      { x: 232.93, w: 151.02 },
      { x: 383.95, w: 160.55 },
    ],
    cellPadRight: 9,
    maxRows: 3,
  },
  callout: { gapAfterTable: 17.84, pad: 12, edge: 3, titleGap: 3 },
} as const

/** Mid-grey hairline of rows and tables. */
export const HAIRLINE = 0.75

// ------------------------------------------------------------------------ rows

/** Line budget of each of `count` rows. */
export function rowLines(count: number): number[] {
  return count === ENTRY.maxRows
    ? [...ROW_LINES_8]
    : Array.from({ length: count }, () => ROW_LINES_FEW)
}

/** Height of a row with a line budget: the design's own heights for eight rows. */
export function rowHeights(count: number): number[] {
  if (count === ENTRY.maxRows) return [...ROW_HEIGHTS_8]
  return rowLines(count).map((lines) => Math.round((26.4 + 13.2 * lines) * 4) / 4)
}

/** Figure cells (points, inside the figure frame) for one to four pictures. */
export function figureCells(count: number): { x: number; y: number; w: number; h: number }[] {
  const { w, h } = ENTRY.figure
  const pad = 3
  const gapX = 5
  const gapY = 3
  const half = (w - pad * 2 - gapX) / 2
  const cell = (x: number, y: number, cw: number, ch: number) => ({ x, y, w: cw, h: ch })
  const rowH = (h - pad * 2 - gapY) / 2
  switch (Math.min(Math.max(count, 1), 4)) {
    case 1:
      return [cell(pad, pad, w - pad * 2, h - pad * 2)]
    case 2:
      return [cell(pad, pad, w - pad * 2, rowH), cell(pad, pad + rowH + gapY, w - pad * 2, rowH)]
    case 3:
      return [
        cell(pad, pad, w - pad * 2, rowH),
        cell(pad, pad + rowH + gapY, half, rowH),
        cell(pad + half + gapX, pad + rowH + gapY, half, rowH),
      ]
    default:
      return [
        cell(pad, pad, half, rowH),
        cell(pad + half + gapX, pad, half, rowH),
        cell(pad, pad + rowH + gapY, half, rowH),
        cell(pad + half + gapX, pad + rowH + gapY, half, rowH),
      ]
  }
}

// -------------------------------------------------------------------- hexagons

/** The cover's nested hexagons, exactly the design's SVG (viewBox is the A4 page in points). */
export const HEXAGONS = {
  viewBox: `0 0 ${PAGE.w.toFixed(3)} ${PAGE.h.toFixed(4)}`,
  strokeWidth: 1.6866,
  paths: [
    {
      color: COLORS.hexOuter,
      d: 'M467.443 -36.561 633.694 59.816 633.694 252.571 467.443 348.948 301.192 252.571 301.192 59.816Z',
    },
    {
      color: COLORS.hexMiddle,
      d: 'M467.443 11.627 592.734 83.910 592.734 228.476 467.443 300.759 342.153 228.476 342.153 83.910Z',
    },
    {
      color: COLORS.hexInner,
      d: 'M467.443 59.816 550.569 108.005 550.569 204.382 467.443 252.571 384.318 204.382 384.318 108.005Z',
    },
  ],
  fill: {
    color: COLORS.hexFill,
    d: 'M467.443 108.005 509.608 132.099 509.608 180.288 467.443 204.382 425.278 180.288 425.278 132.099Z',
  },
} as const

/** The hexagons as inline SVG, for the editor and the export. No script, no external reference. */
export function hexagonsSvg() {
  const stroke = HEXAGONS.paths
    .map((p) => `<path stroke="${p.color}" d="${p.d}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${HEXAGONS.viewBox}" aria-hidden="true"><g fill="none" stroke-width="${HEXAGONS.strokeWidth}">${stroke}</g><path fill="${HEXAGONS.fill.color}" d="${HEXAGONS.fill.d}"/></svg>`
}

// ------------------------------------------------------------------- evidence

/** The reading note under the evidence table, when the writer gave none. */
export const DEFAULT_NOTE = {
  title: 'Reading the evidence',
  body: 'Superscript numbers in the entry match the documents listed above. Locators give the pages and chunks each statement rests on. Anything marked as an objective or estimate is not a measured result.',
} as const
