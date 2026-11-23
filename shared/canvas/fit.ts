import { FONT_SCALE, type FrameStyle, type Geo, type TipTapBlock } from './model.ts'

/**
 * How much text a frame holds, estimated without a browser. The prompt, the
 * validator and the composer all read the same numbers, so a page is written to
 * the room its layout really has. Deterministic and browser-safe.
 *
 *   charsPerLine = frame width / (font pt x 0.3528 x avgGlyph(family))
 *   lines        = (frame height - 2 x padding) / (font pt x 0.3528 x line height)
 *   capacity     = charsPerLine x lines / WORD_CHARS  (less headings and gaps)
 *
 * `FIT` was calibrated once against the real renderer (Chromium, the CSS in
 * css.ts): tests/fixtures/canvas/fit_calibration.json holds the measurements and
 * tests/unit/canvas_fit.spec.ts pins both. When fonts or CSS change, run
 * `node scripts/calibrate_fit.mjs` and update the constants.
 */
export const FIT = {
  /** Millimetres per typographic point. */
  ptMm: 0.3528,
  /** Average advance of a character (letters and spaces) as a fraction of the font size. */
  glyph: { brand: 0.52, sans: 0.5, serif: 0.5, mono: 0.6 },
  /** Characters per word, including the space after it. */
  wordChars: 6,
  /** Bold text sets wider than regular text by about this much. */
  boldFactor: 1.08,
  /** Paragraph gap, in em of the frame's font size (css.ts: `.cv-frame p`). */
  paragraphGap: 0.6,
  /** Space under a heading, in em of the heading's own size. */
  headingGap: 0.35,
  /** Heading size relative to the frame's font size, and its line height. */
  headingSize: { 1: 2, 2: 1.5, 3: 1.15, 4: 1 } as Record<number, number>,
  headingLine: 1.15,
  /** List indent and the gap under each item, in em. */
  listIndent: 1.1,
  itemGap: 0.25,
  /** Width of a citation mark, in characters. */
  citationChars: 2,
  /** Default line height (css.ts `.cv-frame`), percent. */
  lineHeight: 145,
  /** Justified and ragged text lose this share of each line to breaks. */
  lineLoss: 0.04,
} as const

/** Below this a page reads as thin; above 1 it overflows its layout. */
export const FILL = { low: 0.7, high: 1 } as const

const family = (style: FrameStyle) => style.family ?? 'brand'

/** Font size of a frame in points. */
export const fontPt = (style: FrameStyle) => style.size ?? FONT_SCALE[style.font ?? 'md']

export const lineHeightOf = (style: FrameStyle) => (style.lineHeight ?? FIT.lineHeight) / 100

/** Inner size of a frame in millimetres, less its padding. */
export function innerMm(geo: Pick<Geo, 'w' | 'h'>, style: FrameStyle) {
  const pad = ((style.padding ?? 0) * 2) / 10
  return { w: Math.max(geo.w / 10 - pad, 0), h: Math.max(geo.h / 10 - pad, 0) }
}

/** Characters of body text on one line of a frame. */
export function charsPerLine(geo: Pick<Geo, 'w' | 'h'>, style: FrameStyle) {
  const em = fontPt(style) * FIT.ptMm
  return Math.floor((innerMm(geo, style).w / (em * FIT.glyph[family(style)])) * (1 - FIT.lineLoss))
}

/** Lines of plain text a frame holds. */
export function lineCapacity(geo: Pick<Geo, 'w' | 'h'>, style: FrameStyle) {
  return Math.floor(innerMm(geo, style).h / (fontPt(style) * FIT.ptMm * lineHeightOf(style)))
}

/**
 * Words of plain prose a frame holds, less `reserveLines` taken by headings and
 * gaps. Use `blocksHeight` for the real content; this sizes a layout in advance.
 */
export function capacityWords(
  geo: Pick<Geo, 'w' | 'h'>,
  style: FrameStyle,
  reserveLines = 0
): number {
  const lines = Math.max(lineCapacity(geo, style) - reserveLines, 0)
  return Math.floor((charsPerLine(geo, style) * lines) / FIT.wordChars)
}

type Inline = { type?: string; text?: string; marks?: { type?: string }[]; content?: Inline[] }

/** Characters of a node's text, a citation counting as a small mark. */
function charsOf(node: Inline): { chars: number; bold: number } {
  if (node.type === 'text') {
    const n = (node.text ?? '').length
    return { chars: n, bold: node.marks?.some((m) => m.type === 'bold') ? n : 0 }
  }
  if (node.type === 'sourceCitation') return { chars: FIT.citationChars, bold: 0 }
  return (node.content ?? []).reduce(
    (sum, child) => {
      const part = charsOf(child)
      return { chars: sum.chars + part.chars, bold: sum.bold + part.bold }
    },
    { chars: 0, bold: 0 }
  )
}

/** Words in blocks or a string. Citation marks are not words. */
export function wordCount(input: string | readonly unknown[]): number {
  const text = (node: Inline): string =>
    node.type === 'text'
      ? (node.text ?? '')
      : node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem'
        ? `${(node.content ?? []).map(text).join('')} `
        : (node.content ?? []).map(text).join('')
  const joined =
    typeof input === 'string' ? input : (input as Inline[]).map((node) => text(node)).join(' ')
  return joined.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

/** Lines `chars` characters take in `widthEm` ems, a character being `glyph` em wide. */
const linesFor = (chars: number, widthEm: number, glyph: number) =>
  Math.max(1, Math.ceil((chars * glyph) / (widthEm * (1 - FIT.lineLoss))))

/** Height of one block in ems of the frame's font size. */
function blockEm(block: Inline, widthEm: number, glyph: number, line: number): number {
  const { chars, bold } = charsOf(block)
  const eff = chars + bold * (FIT.boldFactor - 1)
  switch (block.type) {
    case 'heading': {
      const level = Number((block as { attrs?: { level?: number } }).attrs?.level ?? 2)
      const size = FIT.headingSize[level] ?? 1
      const lines = linesFor(eff * FIT.boldFactor, widthEm / size, glyph)
      return lines * size * FIT.headingLine + FIT.headingGap * size
    }
    case 'bulletList':
    case 'orderedList': {
      const inner = widthEm - FIT.listIndent
      const items = (block.content ?? []).map((item) => {
        const text = charsOf(item)
        return linesFor(text.chars, inner, glyph) * line + FIT.itemGap
      })
      return items.reduce((a, b) => a + b, 0) + 0.3 + FIT.paragraphGap
    }
    case 'blockquote':
      return linesFor(eff, widthEm - 2.5, glyph) * line + FIT.paragraphGap
    case 'paragraph':
      return linesFor(eff, widthEm, glyph) * line + FIT.paragraphGap
    default:
      return 0
  }
}

/** Height blocks take when set in a frame, in millimetres (the last block's gap is not drawn). */
export function blocksHeight(
  blocks: readonly TipTapBlock[],
  geo: Pick<Geo, 'w' | 'h'>,
  style: FrameStyle
): number {
  if (!blocks.length) return 0
  const em = fontPt(style) * FIT.ptMm
  const widthEm = innerMm(geo, style).w / em
  const glyph = FIT.glyph[family(style)]
  const line = lineHeightOf(style)
  const total = blocks.reduce(
    (sum, block) => sum + blockEm(block as Inline, widthEm, glyph, line),
    0
  )
  const last = blocks.at(-1)!.type === 'heading' ? 0 : FIT.paragraphGap
  return Math.max(total - last, 0) * em
}

/**
 * How full a frame is: 0 empty, 1 exactly full, over 1 overflowing. Counts the
 * frame's real blocks (headings, gaps, lists), not a flat word count.
 */
export function fillRatio(
  blocks: readonly TipTapBlock[],
  geo: Pick<Geo, 'w' | 'h'>,
  style: FrameStyle
): number {
  const room = innerMm(geo, style).h
  return room > 0 ? blocksHeight(blocks, geo, style) / room : 0
}

export type Fit = 'thin' | 'ok' | 'over'
export const fitOf = (fill: number): Fit =>
  fill < FILL.low ? 'thin' : fill > FILL.high ? 'over' : 'ok'

/** Image resolution when `px` pixels (short edge) fill a frame side of `mmSide` millimetres. */
export const effectiveDpi = (px: number, mmSide: number) =>
  mmSide > 0 ? Math.round(px / (mmSide / 25.4)) : 0

/** Print resolution the renderer aims for, and the floor below which a page is flagged. */
export const PRINT_DPI = 300
export const MIN_DPI = 200
