import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  type Frame,
  type FrameStyle,
  type Geo,
  type Sheet,
  type TipTapBlock,
} from '../model.ts'
import { citationNumbers } from './citations.ts'
import {
  printedRows,
  rowText,
  type CoverMeta,
  type EntryClaim,
  type EntryPage,
  type EntryRow,
} from './content.ts'
import { balanceLines, lineCount, trimToLines, wrap } from './measure.ts'
import {
  COLORS,
  COVER,
  DEFAULT_NOTE,
  ENTRY,
  FOOTER,
  HAIRLINE,
  HEADER,
  MARGIN,
  CONTENT_W,
  PAGE,
  SOURCES,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  figureCells,
  pt,
  rowHeights,
  rowLines,
  style,
  tone,
  type TypeRole,
} from './tokens.ts'

/**
 * Lays the navy and gold portfolio out as canvas sheets: a cover, then for each entry an
 * entry page and its sources page(s). Every frame sits where `tokens.json` puts its slot, in
 * the canvas unit, with exact type metrics, so the editor and the export draw the design.
 * Deterministic and browser-safe: nothing here reads the clock, a font file or the network.
 */

export type SourceInfo = {
  fileName: string
  pageNumber?: number | null
  chunkIndex: number
  /** How the chunk is named in a locator ("R01"); the 1-based index when absent. */
  chunkLabel?: string
  /** What the chunks are called in a locator: "chunks", "frames", "sessions". */
  unit?: string
}

export type PortfolioImage = { imageId: string; alt: string }

export type EntryInput = {
  page: EntryPage
  images?: PortfolioImage[]
  /** Draws the design's sample thumbnails in the figure frame: for the template's own sample only. */
  sampleFigure?: boolean
}

export type CoverInput = {
  eyebrow?: string
  title: string
  subtitle: string
  meta: CoverMeta[]
}

export type PortfolioInput = {
  cover: CoverInput
  entries: EntryInput[]
  /** Every chunk an entry may cite, by id. */
  sources: ReadonlyMap<string, SourceInfo>
  /** The running title of the footer. */
  footer: string
}

type Node = TipTapBlock
const textNode = (value: string, bold = false): Node => ({
  type: 'text',
  text: value,
  ...(bold ? { marks: [{ type: 'bold' }] } : {}),
})

/** A paragraph from inline nodes; a newline in a run becomes a hard break. */
const paragraph = (...inline: (Node | string | false | undefined)[]): Node => ({
  type: 'paragraph',
  content: inline
    .filter((n): n is Node | string => !!n)
    .flatMap((n): Node[] =>
      typeof n === 'string'
        ? n
            .split('\n')
            .flatMap((line, i) => (i ? [{ type: 'hardBreak' }, textNode(line)] : [textNode(line)]))
        : [n]
    ),
})
const cite = (chunkId: string): Node => ({
  type: 'sourceCitation',
  attrs: { sourceChunkId: chunkId },
})

/** A frame id from the slot it carries: `entry.rows.3.body` on sheet `s2` is `s2-entry-rows-3-body`. */
export const frameIdFor = (sheetId: string, slot: string) =>
  `${sheetId}-${slot.replaceAll('.', '-').replaceAll('_', '')}`

/** Points to a canvas rectangle. */
const box = (x: number, y: number, w: number, h: number): Geo => ({
  x: pt(x),
  y: pt(y),
  w: Math.max(pt(w), 2),
  h: Math.max(pt(h), 2),
})

class SheetBuilder {
  frames: Frame[] = []
  private n = 0
  constructor(readonly id: string) {}

  private next(role: string) {
    const i = this.n++
    return { id: frameIdFor(this.id, role), z: i, order: i }
  }

  /** A text frame whose first line sits at `y`; its height keeps one point of slack. */
  text(slot: string, x: number, y: number, w: number, h: number, nodes: Node[], st: FrameStyle) {
    if (!nodes.length) return
    this.frames.push({
      ...this.next(slot),
      kind: 'text',
      geo: box(x, y, w, h + 1),
      style: st,
      doc: nodes,
    })
  }

  rect(role: string, x: number, y: number, w: number, h: number, st: FrameStyle) {
    this.frames.push({
      ...this.next(role),
      kind: 'shape',
      shape: 'rect',
      geo: box(x, y, w, h),
      style: st,
    })
  }

  hairline(role: string, x: number, y: number, w: number, color: FrameStyle['fill'] = COLORS.line) {
    this.rect(role, x, y, w, HAIRLINE, { fill: color })
  }

  image(role: string, x: number, y: number, w: number, h: number, image: PortfolioImage) {
    this.frames.push({
      ...this.next(role),
      kind: 'image',
      geo: box(x, y, w, h),
      style: { fill: 'white', border: { width: 2, color: COLORS.line, style: 'solid' } },
      imageId: image.imageId,
      alt: image.alt.slice(0, 300),
      fit: 'contain',
    })
  }

  art(role: string, art: 'hexagons' | 'thumbnails', geo: Geo = box(0, 0, PAGE.w, PAGE.h)) {
    this.frames.push({ ...this.next(role), kind: 'art', geo, style: {}, art })
  }
}

const linesHeight = (role: TypeRole, lines: number) => lines * styleLine(role)
const styleLine = (role: TypeRole) => (style(role).lineHeight! * style(role).size!) / 100

/** The three composed lines of a cover title. */
export function titleLines(title: string): string[] {
  if (title.includes('\n')) return title.split('\n')
  return (
    balanceLines(title, COVER.title.w, 'coverTitle', COVER.title.lines) ??
    wrap(title, COVER.title.w, 'coverTitle')
  )
}

// ---------------------------------------------------------------------- cover

export function composeCover(input: CoverInput, sheetId = 's0'): Sheet {
  const b = new SheetBuilder(sheetId)
  b.rect('navy', 0, 0, PAGE.w, COVER.navyHeight, { fill: tone('navy') })
  b.art('hexagons', 'hexagons')
  if (input.eyebrow)
    b.text(
      'cover.eyebrow',
      COVER.left,
      COVER.eyebrow.y,
      COVER.eyebrow.w,
      TYPE_LINE.eyebrow,
      [paragraph(input.eyebrow)],
      style('eyebrow')
    )
  b.text(
    'cover.title',
    COVER.left,
    COVER.title.y,
    COVER.title.w,
    linesHeight('coverTitle', COVER.title.lines),
    [paragraph(titleLines(input.title).join('\n'))],
    style('coverTitle')
  )
  b.text(
    'cover.subtitle',
    COVER.left,
    COVER.subtitle.y,
    COVER.subtitle.w,
    linesHeight('coverSubtitle', COVER.subtitle.lines),
    [paragraph(input.subtitle)],
    style('coverSubtitle')
  )
  b.rect('rule', COVER.rule.x, COVER.rule.y, COVER.rule.w, COVER.rule.h, { fill: tone('gold') })
  // A column with no value is dropped; the others keep their places.
  input.meta.slice(0, 3).forEach((m, i) => {
    if (!m.value.trim()) return
    const x = COVER.left + i * (COVER.meta.w + COVER.meta.gap)
    const slot = `cover.meta.${i + 1}`
    const valueLines = Math.min(lineCount(m.value, COVER.meta.w, 'metaValue'), 2)
    b.text(
      `${slot}.label`,
      x,
      COVER.meta.y,
      COVER.meta.w,
      TYPE_LINE.metaLabel,
      [paragraph(m.label)],
      style('metaLabel')
    )
    const valueY = COVER.meta.y + TYPE_LINE.metaLabel + COVER.meta.valueGap
    b.text(
      `${slot}.value`,
      x,
      valueY,
      COVER.meta.w,
      linesHeight('metaValue', valueLines),
      [paragraph(m.value)],
      style('metaValue')
    )
    if (m.secondary?.trim())
      b.text(
        `${slot}.secondary`,
        x,
        valueY + linesHeight('metaValue', valueLines),
        COVER.meta.w,
        linesHeight('metaSecondary', 2),
        [paragraph(m.secondary)],
        style('metaSecondary')
      )
  })
  return { id: sheetId, background: 'surface', frames: b.frames }
}

const TYPE_LINE = {
  eyebrow: 12,
  metaLabel: 12,
  tag: 13.5,
  footer: 10,
}

// ------------------------------------------------------------------ page chrome

function header(
  b: SheetBuilder,
  kind: 'entry' | 'sources',
  number: string,
  label: string,
  title: string,
  intro: string
) {
  const slot = (name: string) => `${kind}.${name}`
  b.text(
    slot('section_number'),
    MARGIN,
    HEADER.tag.y,
    HEADER.tag.w,
    HEADER.tag.h,
    [paragraph(number)],
    {
      ...style('tagNumber'),
      fill: tone('navy'),
      radius: pt(HEADER.tag.radius),
      align: 'center',
      valign: 'middle',
    }
  )
  const labelX = MARGIN + HEADER.tag.w + HEADER.tag.gap
  b.text(
    slot('section_label'),
    labelX,
    HEADER.label.y,
    250,
    TYPE_LINE.metaLabel,
    [paragraph(label)],
    style('tagLabel')
  )
  b.text(
    slot('title'),
    MARGIN,
    HEADER.title.y,
    HEADER.title.w,
    HEADER.title.h,
    [paragraph(title)],
    style('heading')
  )
  b.rect('rule', MARGIN, HEADER.rule.y, HEADER.rule.w, HEADER.rule.h, { fill: tone('gold') })
  b.text(
    slot('intro'),
    MARGIN,
    HEADER.intro.y,
    HEADER.intro.w,
    linesHeight('intro', HEADER.intro.lines),
    [paragraph(intro)],
    style('intro')
  )
}

function footer(
  b: SheetBuilder,
  kind: 'entry' | 'sources',
  title: string,
  page: number,
  total: number
) {
  b.text(`${kind}.doc_title`, MARGIN, FOOTER.y, 400, FOOTER.h, [paragraph(title)], style('footer'))
  b.text(
    `${kind}.page_counter`,
    MARGIN + CONTENT_W - 100,
    FOOTER.y,
    100,
    FOOTER.h,
    [paragraph(`${page} / ${total}`)],
    style('footer', { align: 'right' })
  )
}

const two = (n: number) => String(n).padStart(2, '0')

// ---------------------------------------------------------------------- entry

type Representatives = ReadonlyMap<string, string>

/** One representative chunk per source document, so footnote numbers count documents. */
export function representatives(
  entries: readonly Pick<EntryInput, 'page'>[],
  sources: ReadonlyMap<string, SourceInfo>
): Map<string, string> {
  const reps = new Map<string, string>()
  for (const { page } of entries)
    for (const row of page.rows)
      for (const id of row.chunks) {
        const info = sources.get(id)
        if (info && !reps.has(info.fileName)) reps.set(info.fileName, id)
      }
  return reps
}

/** The citation nodes of a row: one per source document, in order of first mention. */
function rowCitations(
  row: EntryRow,
  sources: ReadonlyMap<string, SourceInfo>,
  reps: Representatives
) {
  const docs: string[] = []
  for (const id of row.chunks) {
    const info = sources.get(id)
    if (info && !docs.includes(info.fileName)) docs.push(info.fileName)
  }
  return docs.map((doc) => cite(reps.get(doc)!))
}

export function composeEntry(
  entry: EntryInput,
  ctx: {
    sheetId: string
    index: number
    sources: ReadonlyMap<string, SourceInfo>
    reps: Representatives
    footer: string
    page: number
    total: number
  }
): Sheet {
  const b = new SheetBuilder(ctx.sheetId)
  const { page } = entry
  const images = (entry.images ?? []).slice(0, 4)
  header(b, 'entry', two(ctx.index), page.category, page.title, page.intro)
  const wide = images.length === 0 && !entry.sampleFigure
  if (!wide) {
    const f = ENTRY.figure
    b.rect('figure', f.x, f.y, f.w, f.h, {
      fill: 'white',
      radius: pt(f.radius),
      border: { width: pt(f.hairline), color: COLORS.line, style: 'solid' },
    })
    if (entry.sampleFigure) b.art('thumbnails', 'thumbnails', box(f.x, f.y, f.w, f.h))
    else
      figureCells(images.length).forEach((cell, i) =>
        b.image(`figure-${i + 1}`, f.x + cell.x, f.y + cell.y, cell.w, cell.h, images[i])
      )
  }
  const x = wide ? MARGIN : ENTRY.rowsX
  const w = wide ? CONTENT_W : ENTRY.rowsW
  // Rows with nothing to say are dropped, and the rest are laid out from the top again.
  const rows = printedRows(page.rows).slice(0, ENTRY.maxRows)
  const budgets = rowLines(rows.length)
  const heights = rowHeights(rows.length)
  let top = ENTRY.bodyTop
  rows.forEach((row, i) => {
    const slot = `entry.rows.${i + 1}`
    const labelY = top + ENTRY.rowPad
    const bodyY = labelY + styleLine('rowLabel')
    b.text(
      `${slot}.label`,
      x,
      labelY,
      w,
      styleLine('rowLabel'),
      [paragraph(row.label)],
      style('rowLabel')
    )
    b.text(
      `${slot}.body`,
      x,
      bodyY,
      w,
      linesHeight('rowBody', budgets[i]),
      [
        paragraph(
          row.constraint
            ? { type: 'text', text: row.constraint, marks: [{ type: 'bold' }] }
            : false,
          row.body && (row.constraint ? ` ${row.body}` : row.body),
          ...rowCitations(row, ctx.sources, ctx.reps)
        ),
      ],
      style('rowBody', {
        strongColor: COLORS.red,
        citeColor: tone('goldDark'),
        citeSize: 7,
      })
    )
    b.hairline(`sep-${i + 1}`, x, top + heights[i] - HAIRLINE, w)
    top += heights[i]
  })
  footer(b, 'entry', ctx.footer, ctx.page, ctx.total)
  return { id: ctx.sheetId, background: 'white', frames: b.frames }
}

// -------------------------------------------------------------------- sources

export type Reference = {
  number: number
  name: string
  locator: string
  /** The short form used in the evidence table: "pp. 3–7 / R01–R06". */
  short: string
  note: string
}

const stripExtension = (name: string) => name.replace(/\.[A-Za-z0-9]{2,4}$/, '').replace(/_/g, ' ')

/** Locator of the cited chunks of one document: pages and chunk labels, each as a range. */
export function locatorOf(infos: readonly SourceInfo[]) {
  const pages = [...new Set(infos.map((i) => i.pageNumber).filter((p): p is number => !!p))].sort(
    (a, b) => a - b
  )
  const ordered = [...infos].sort((a, b) => a.chunkIndex - b.chunkIndex)
  const labels = ordered.map((i) => i.chunkLabel ?? String(i.chunkIndex + 1))
  const unit = infos[0]?.unit ?? 'chunks'
  const span = (first: string, last: string) => (first === last ? first : `${first}–${last}`)
  const pageText = pages.length ? span(String(pages[0]), String(pages.at(-1))) : ''
  const chunkText = labels.length ? span(labels[0], labels.at(-1)!) : ''
  const parts = [
    pageText && `${pages.length > 1 ? 'Pages' : 'Page'} ${pageText}`,
    chunkText && `${unit} ${chunkText}`,
  ].filter(Boolean) as string[]
  const short = [pageText && `${pages.length > 1 ? 'pp.' : 'p.'} ${pageText}`, chunkText]
    .filter(Boolean)
    .join(' / ')
  // Capitalise the first part only: "Pages 3–7 · chunks 1–6".
  return { locator: parts.join(' · ').replace(/^./, (c) => c.toUpperCase()), short }
}

const ellipsis = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

/** The documents one entry cites, numbered as the export numbers them. */
export function referencesOf(
  entry: EntryInput,
  sources: ReadonlyMap<string, SourceInfo>,
  reps: Representatives,
  numbers: ReadonlyMap<string, number>
): Reference[] {
  const rows = printedRows(entry.page.rows)
  const docs = new Map<string, { chunks: string[]; rows: string[] }>()
  rows.forEach((row) => {
    for (const id of row.chunks) {
      const info = sources.get(id)
      if (!info) continue
      const doc = docs.get(info.fileName) ?? { chunks: [], rows: [] }
      if (!doc.chunks.includes(id)) doc.chunks.push(id)
      if (!doc.rows.includes(row.label)) doc.rows.push(row.label)
      docs.set(info.fileName, doc)
    }
  })
  return [...docs.entries()].map(([fileName, doc]) => {
    const infos = doc.chunks.map((id) => sources.get(id)!)
    const { locator, short } = locatorOf(infos)
    const noted = entry.page.sourceNotes.find((n) => doc.chunks.includes(n.chunk))
    return {
      number: numbers.get(reps.get(fileName)!) ?? 0,
      name: ellipsis(stripExtension(fileName), 90),
      locator: ellipsis(locator, 70),
      short,
      note: ellipsis(noted?.note ?? `Supports ${doc.rows.slice(0, 3).join(', ')}`, 100),
    }
  })
}

export const EVIDENCE_LABEL = {
  measured: 'Measured result',
  estimated: 'Estimate',
  client_reported: 'Client reported',
  design_target: 'Objective, not measured',
} as const

type EvidenceRow = [claim: string, source: string, kind: string]

function evidenceRows(
  entry: EntryInput,
  refs: Reference[],
  sources: ReadonlyMap<string, SourceInfo>
) {
  const rows = printedRows(entry.page.rows)
  const out: EvidenceRow[] = []
  for (const claim of entry.page.claims as EntryClaim[]) {
    const row = rows[claim.row - 1]
    const first = row?.chunks.map((id) => sources.get(id)).find(Boolean)
    const ref = first && refs.find((r) => r.name === ellipsis(stripExtension(first.fileName), 90))
    if (!ref) continue
    out.push([
      claim.claim,
      `${ref.number}${ref.short ? ` · ${ref.short}` : ''}`,
      claim.label ?? EVIDENCE_LABEL[claim.kind],
    ])
  }
  return out.slice(0, SOURCES.evidence.maxRows)
}

/** Pages of references an entry needs. */
export const sourcesPageCount = (references: number) =>
  Math.max(1, Math.ceil(references / SOURCES.perPage))

export function composeSources(
  entry: EntryInput,
  ctx: {
    sheetId: string
    index: number
    refs: Reference[]
    /** Which page of this entry's sources this is, from zero. */
    part: number
    sources: ReadonlyMap<string, SourceInfo>
    footer: string
    page: number
    total: number
  }
): Sheet {
  const b = new SheetBuilder(ctx.sheetId)
  const refs = ctx.refs.slice(ctx.part * SOURCES.perPage, (ctx.part + 1) * SOURCES.perPage)
  const intro =
    entry.page.sourcesIntro ??
    `Supporting material for “${entry.page.title}”. Superscript numbers in the entry point to the documents below. Locators identify the exact pages or chunks used to support each statement.`
  header(
    b,
    'sources',
    two(ctx.index),
    'Sources & references',
    ctx.part ? 'Evidence behind the entry (continued)' : 'Evidence behind the entry',
    intro
  )
  refs.forEach((ref, k) => {
    const top = SOURCES.top + k * SOURCES.rowPitch
    const y = top + SOURCES.rowPad
    const slot = `sources.references.${k + 1}`
    b.text(
      `${slot}.number`,
      MARGIN,
      y - 0.75,
      SOURCES.numberW,
      8.5,
      [paragraph(String(ref.number))],
      style('sourceNumber')
    )
    b.text(
      `${slot}.document`,
      SOURCES.textX,
      y,
      SOURCES.textW,
      13.5,
      [paragraph(ref.name)],
      style('sourceName')
    )
    b.text(
      `${slot}.locator`,
      SOURCES.textX,
      y + 13.5 + 3,
      SOURCES.textW,
      12,
      [paragraph(ref.locator)],
      style('sourceLocator')
    )
    b.text(
      `${slot}.note`,
      SOURCES.textX,
      y + 13.5 + 3 + 12 + 3,
      SOURCES.textW,
      13.5,
      [paragraph(ref.note)],
      style('sourceNote')
    )
    b.hairline(`sep-${k + 1}`, MARGIN, top + SOURCES.rowPitch - HAIRLINE, CONTENT_W)
  })
  let cursor = SOURCES.top + refs.length * SOURCES.rowPitch
  // The table and the note belong to the first page of an entry's sources.
  const table = ctx.part === 0 ? evidenceRows(entry, ctx.refs, ctx.sources) : []
  if (table.length) {
    const e = SOURCES.evidence
    const titleY = cursor + e.gapAfterRefs
    b.text(
      'sources.evidence.title',
      MARGIN,
      titleY,
      CONTENT_W,
      18.75,
      [paragraph('Evidence at a glance')],
      style('evidenceTitle')
    )
    const headY = titleY + e.titleToHead
    ;['Claim', 'Source / locator', 'Evidence type'].forEach((label, c) =>
      b.text(
        `sources.evidence.headers.${c + 1}`,
        e.cols[c].x,
        headY + e.head.padTop,
        e.cols[c].w - e.cellPadRight,
        13.2,
        [paragraph(label)],
        style('evidenceHead')
      )
    )
    b.hairline('head-rule', MARGIN, headY + e.head.h - HAIRLINE, CONTENT_W, tone('navy'))
    table.forEach((row, r) => {
      const rowY = headY + e.head.h + r * e.row.h
      row.forEach((cell, c) =>
        b.text(
          `sources.evidence.rows.${r + 1}.${c + 1}`,
          e.cols[c].x,
          rowY + e.row.padTop,
          e.cols[c].w - e.cellPadRight,
          13.2,
          [paragraph(cell)],
          style(c === 2 ? 'evidenceKind' : 'evidenceCell')
        )
      )
      b.hairline(`row-rule-${r + 1}`, MARGIN, rowY + e.row.h - HAIRLINE, CONTENT_W)
    })
    cursor = headY + e.head.h + table.length * e.row.h + SOURCES.callout.gapAfterTable
  }
  if (ctx.part === 0) {
    const c = SOURCES.callout
    const innerW = CONTENT_W - c.edge - c.pad * 2
    const noteText = trimToLines(
      entry.page.evidenceNote ?? DEFAULT_NOTE.body,
      innerW,
      'noteBody',
      3
    ).text
    const lines = Math.min(lineCount(noteText, innerW, 'noteBody'), 3)
    const top = table.length ? cursor : cursor + SOURCES.evidence.gapAfterRefs
    const height = c.pad + 13.5 + c.titleGap + 13.5 * lines + c.pad
    b.rect('callout', MARGIN, top, CONTENT_W, height, { fill: tone('paper') })
    b.rect('callout-edge', MARGIN, top, c.edge, height, { fill: tone('gold') })
    const x = MARGIN + c.edge + c.pad
    b.text(
      'sources.note.title',
      x,
      top + c.pad,
      innerW,
      13.5,
      [paragraph(DEFAULT_NOTE.title)],
      style('noteTitle')
    )
    b.text(
      'sources.note.body',
      x,
      top + c.pad + 13.5 + c.titleGap,
      innerW,
      13.5 * 3,
      [paragraph(noteText)],
      style('noteBody')
    )
  }
  footer(b, 'sources', ctx.footer, ctx.page, ctx.total)
  return { id: ctx.sheetId, background: 'white', frames: b.frames }
}

// ------------------------------------------------------------------- document

/** The pages of the document: how many sheets each entry takes (its entry page and its sources). */
export function pagePlan(entries: readonly EntryInput[], sources: ReadonlyMap<string, SourceInfo>) {
  return entries.map((entry) => {
    const docs = new Set<string>()
    for (const row of printedRows(entry.page.rows))
      for (const id of row.chunks) {
        const info = sources.get(id)
        if (info) docs.add(info.fileName)
      }
    return 1 + sourcesPageCount(docs.size)
  })
}

export function composePortfolio(input: PortfolioInput): CanvasDocument {
  const reps = representatives(input.entries, input.sources)
  const plan = pagePlan(input.entries, input.sources)
  const total = 1 + plan.reduce((a, b) => a + b, 0)
  const sheets: Sheet[] = [composeCover(input.cover, 's0')]
  input.entries.forEach((entry, k) => {
    const index = k + 1
    const entrySheet = composeEntry(entry, {
      sheetId: `s${sheets.length}`,
      index,
      sources: input.sources,
      reps,
      footer: input.footer,
      page: sheets.length + 1,
      total,
    })
    sheets.push(entrySheet)
    // Numbers count in reading order over every sheet so far: later entries cannot change earlier numbers.
    const numbers = citationNumbers(sheets)
    const refs = referencesOf(entry, input.sources, reps, numbers)
    for (let part = 0; part < sourcesPageCount(refs.length); part++)
      sheets.push(
        composeSources(entry, {
          sheetId: `s${sheets.length}`,
          index,
          refs,
          part,
          sources: input.sources,
          footer: input.footer,
          page: sheets.length + 1,
          total,
        })
      )
  })
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    template: { id: TEMPLATE_ID, version: TEMPLATE_VERSION },
    sheets,
  }
}

export { rowText }
