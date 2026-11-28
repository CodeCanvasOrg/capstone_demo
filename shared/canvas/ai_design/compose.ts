import {
  BRAND_COLORS,
  CANVAS_SCHEMA_VERSION,
  SHEET,
  type CanvasColor,
  type CanvasDocument,
  type Frame,
  type FrameStyle,
  type Sheet,
  type TipTapBlock,
} from '../model.ts'
import { citationNumbers } from '../portfolio/citations.ts'
import { EVIDENCE_LABEL, locatorOf, type SourceInfo } from '../portfolio/compose.ts'
import { trimToLines } from '../portfolio/measure.ts'
import { blend, readable } from './color.ts'
import {
  AI_TEMPLATE_ID,
  AI_TEMPLATE_VERSION,
  type DesignFrame,
  type DesignPage,
  type DesignSystem,
  type PageClaim,
} from './schema.ts'
import {
  UNITS_PER_PT,
  measureText,
  innerSize,
  paragraphs,
  resolveText,
  type ResolvedText,
} from './style.ts'
import { hexOf } from './validate.ts'
import type { ColorRef } from './schema.ts'

/**
 * Builds the canvas of an AI-designed document from the validated design, the text written into each
 * frame, the pictures chosen for the image frames and the sources the text cites. Deterministic and
 * browser-safe. Sheet ids are `s<n>`, frame ids `s<n>-<design id>`.
 */

export type FrameText = { text: string; chunks: string[] }
export type FramePicture = { imageId: string; alt: string; fit: 'cover' | 'contain' }

export type PageInput = {
  page: DesignPage
  /** By design frame id; a text frame without text is dropped. */
  texts: Map<string, FrameText>
  /** By design frame id; an image frame without a picture is dropped. */
  pictures: Map<string, FramePicture>
  claims: readonly PageClaim[]
}

export type AiComposeInput = {
  system: DesignSystem
  pages: PageInput[]
  sources: ReadonlyMap<string, SourceInfo>
  /** The running title of the footer of the sources pages. */
  footer: string
  /** The pinned brand's palette: colours equal to a value become brand references. */
  brand?: Partial<Record<(typeof BRAND_COLORS)[number], string>>
}

type Node = TipTapBlock

/** A colour as the canvas stores it: a brand reference when the brand has that colour, else hex. */
export function canvasColor(
  ref: ColorRef,
  system: Pick<DesignSystem, 'palette'>,
  brand: AiComposeInput['brand'] = {}
): CanvasColor {
  const hex = hexOf(ref, system).toLowerCase()
  const match = BRAND_COLORS.find(
    (key) => (brand[key] ?? (key === 'white' ? '#ffffff' : '')).toLowerCase() === hex
  )
  return match ?? (hex as CanvasColor)
}

const round1 = (n: number) => Math.round(n * 10) / 10
const clampInt = (n: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(n), min), max)

function textStyle(
  r: ResolvedText,
  system: DesignSystem,
  brand: AiComposeInput['brand'],
  cited: boolean
): FrameStyle {
  const c = (ref: ColorRef) => canvasColor(ref, system, brand)
  return {
    size: clampInt(r.size * 10, 50, 2000) / 10,
    lineHeight: Math.min(Math.max(round1(r.lineHeight), 80), 300),
    weight: r.weight,
    family: r.family,
    color: c(r.color),
    align: r.align,
    ...(r.valign === 'top' ? {} : { valign: r.valign }),
    ...(r.tracking ? { tracking: clampInt(r.tracking, -100, 500) } : {}),
    ...(r.caps ? { caps: true } : {}),
    ...(r.italic ? { italic: true } : {}),
    ...(r.fill
      ? { fill: c(r.fill), ...(r.fillAlpha < 100 ? { fillAlpha: r.fillAlpha } : {}) }
      : {}),
    ...(r.radius ? { radius: clampInt(r.radius, 0, 500) } : {}),
    ...(r.padding ? { padding: clampInt(r.padding, 0, 400) } : {}),
    ...(r.border
      ? {
          border: {
            width: clampInt(r.border.width, 1, 50),
            color: c(r.border.color),
            style: r.border.style ?? 'solid',
          },
        }
      : {}),
    ...(cited ? { citeColor: c(r.color), citeSize: Math.max(round1(r.size * 0.7), 5) } : {}),
  }
}

const textNode = (text: string): Node => ({ type: 'text', text })
const cite = (chunkId: string): Node => ({
  type: 'sourceCitation',
  attrs: { sourceChunkId: chunkId },
})

/** Paragraphs of a text, with the citations at the end of the last one. */
function docOf(text: string, citations: Node[]): Node[] {
  const parts = paragraphs(text)
  return parts.map((p, i) => ({
    type: 'paragraph',
    content: [textNode(p), ...(i === parts.length - 1 ? citations : [])],
  }))
}

/** One representative chunk per source document, in order of first mention. */
export function representativesOf(
  pages: readonly Pick<PageInput, 'page' | 'texts'>[],
  sources: ReadonlyMap<string, SourceInfo>
) {
  const reps = new Map<string, string>()
  for (const { page, texts } of pages)
    for (const frame of page.frames) {
      for (const id of texts.get(frame.id)?.chunks ?? []) {
        const info = sources.get(id)
        if (info && !reps.has(info.fileName)) reps.set(info.fileName, id)
      }
    }
  return reps
}

/** The documents a frame cites, in order: one citation node each. */
function citationsOf(
  chunks: readonly string[],
  sources: ReadonlyMap<string, SourceInfo>,
  reps: ReadonlyMap<string, string>
) {
  const docs: string[] = []
  for (const id of chunks) {
    const doc = sources.get(id)?.fileName
    if (doc && !docs.includes(doc)) docs.push(doc)
  }
  return docs.map((d) => cite(reps.get(d)!))
}

export type ComposedPage = {
  sheet: Sheet
  words: number
  /** Share of the text frames' height the text uses, 0 to 1 (frames over 1 are capped). */
  fill: number
  texts: number
}

export function composeDesignPage(
  input: PageInput,
  index: number,
  ctx: Pick<AiComposeInput, 'system' | 'sources' | 'brand'> & { reps: ReadonlyMap<string, string> }
): ComposedPage {
  const { system, brand } = ctx
  const sheetId = `s${index}`
  const frames: Frame[] = []
  let words = 0
  let used = 0
  let room = 0
  let texts = 0
  const fillStyle = (f: DesignFrame): FrameStyle => {
    const s = f.style ?? {}
    return {
      ...(s.fill ? { fill: canvasColor(s.fill, system, brand) } : {}),
      ...(s.fill && s.fillAlpha !== undefined && s.fillAlpha !== null && s.fillAlpha < 100
        ? { fillAlpha: clampInt(s.fillAlpha, 0, 100) }
        : {}),
      ...(s.radius ? { radius: clampInt(s.radius, 0, 500) } : {}),
      ...(s.border
        ? {
            border: {
              width: clampInt(s.border.width, 1, 50),
              color: canvasColor(s.border.color, system, brand),
              style: s.border.style ?? 'solid',
            },
          }
        : {}),
    }
  }
  input.page.frames.forEach((f) => {
    const geo = { x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h) }
    const base = { id: `${sheetId}-${f.id}`, geo, z: frames.length, order: 0 }
    switch (f.kind) {
      case 'text': {
        const written = input.texts.get(f.id)
        if (!written || !paragraphs(written.text).length) return
        const r = resolveText(f, system)
        const citations = citationsOf(written.chunks, ctx.sources, ctx.reps)
        const measured = measureText(written.text, geo, r)
        const height = innerSize(geo, r).h
        used += Math.min(measured.height, height)
        room += height
        texts++
        words += written.text.split(/\s+/).filter(Boolean).length
        frames.push({
          ...base,
          kind: 'text',
          style: textStyle(r, system, brand, citations.length > 0),
          doc: docOf(written.text, citations),
        })
        return
      }
      case 'image': {
        const picture = input.pictures.get(f.id)
        if (!picture) return
        frames.push({
          ...base,
          kind: 'image',
          style: fillStyle(f),
          imageId: picture.imageId,
          alt: picture.alt.slice(0, 300),
          fit: picture.fit,
        })
        return
      }
      case 'shape':
        frames.push({
          ...base,
          kind: 'shape',
          shape: f.shape ?? 'rect',
          style: { fill: canvasColor(f.style?.fill ?? 'primary', system, brand), ...fillStyle(f) },
        })
        return
      case 'art':
        frames.push({ ...base, kind: 'art', art: f.art ?? 'glow', style: {} })
    }
  })
  // Reading order: top to bottom, then left to right.
  ;[...frames]
    .sort((a, b) => a.geo.y - b.geo.y || a.geo.x - b.geo.x)
    .forEach((frame, i) => {
      frame.order = i
    })
  return {
    sheet: {
      id: sheetId,
      background: canvasColor(input.page.background, system, brand) as Sheet['background'],
      frames,
    },
    words,
    fill: room ? Number((used / room).toFixed(3)) : 0,
    texts,
  }
}

// -------------------------------------------------------------------- sources

export type SourceRef = {
  number: number
  name: string
  locator: string
  short: string
  used: string
}

const stripExtension = (name: string) => name.replace(/\.[A-Za-z0-9]{2,4}$/, '').replace(/_/g, ' ')
const ellipsis = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

/** The documents the pages cite, numbered as the export numbers the superscripts. */
export function referencesFor(
  pages: readonly PageInput[],
  sources: ReadonlyMap<string, SourceInfo>,
  reps: ReadonlyMap<string, string>,
  numbers: ReadonlyMap<string, number>
): SourceRef[] {
  const docs = new Map<string, { chunks: string[]; pages: number[] }>()
  pages.forEach((input, p) => {
    for (const frame of input.page.frames)
      for (const id of input.texts.get(frame.id)?.chunks ?? []) {
        const info = sources.get(id)
        if (!info) continue
        const doc = docs.get(info.fileName) ?? { chunks: [], pages: [] }
        if (!doc.chunks.includes(id)) doc.chunks.push(id)
        if (!doc.pages.includes(p + 1)) doc.pages.push(p + 1)
        docs.set(info.fileName, doc)
      }
  })
  return [...docs.entries()]
    .map(([fileName, doc]) => {
      const { locator, short } = locatorOf(doc.chunks.map((id) => sources.get(id)!))
      return {
        number: numbers.get(reps.get(fileName)!) ?? 0,
        name: ellipsis(stripExtension(fileName), 90),
        locator: ellipsis(locator, 70),
        short,
        used: `Used on page${doc.pages.length > 1 ? 's' : ''} ${doc.pages.join(', ')}`,
      }
    })
    .sort((a, b) => a.number - b.number)
}

type EvidenceRow = { claim: string; source: string; kind: string }

function evidenceRows(
  pages: readonly PageInput[],
  refs: readonly SourceRef[],
  sources: ReadonlyMap<string, SourceInfo>
): EvidenceRow[] {
  const rows: EvidenceRow[] = []
  for (const input of pages)
    for (const claim of input.claims) {
      const frame = input.texts.get(claim.frame)
      const first = frame?.chunks.map((id) => sources.get(id)).find(Boolean)
      const ref = first && refs.find((r) => r.name === ellipsis(stripExtension(first.fileName), 90))
      if (!ref) continue
      rows.push({
        claim: claim.claim,
        source: `${ref.number}${ref.short ? ` · ${ref.short}` : ''}`,
        kind: EVIDENCE_LABEL[claim.kind],
      })
    }
  return rows.slice(0, 8)
}

const ROW = { ref: 190, evidence: 150, head: 150 }

/** The sources pages: header, numbered documents, the evidence table, footer. Flows onto more pages. */
export function composeSourcesPages(
  input: Pick<AiComposeInput, 'system' | 'sources' | 'footer' | 'brand'> & {
    refs: SourceRef[]
    evidence: EvidenceRow[]
    startIndex: number
    totalPages: (count: number) => number
  }
): Sheet[] {
  const { system, brand } = input
  const margin = Math.round(system.grid.margin)
  const contentW = SHEET.w - 2 * margin
  const paper = hexOf('paper', system)
  const ink = hexOf('ink', system)
  const muted = readable([hexOf('muted', system), ink], paper)
  const accent = hexOf('accent', system)
  const rule = blend(ink, paper, 22)
  const c = (hex: string) => canvasColor(hex as ColorRef, system, brand)
  // The sources pages are laid out for a fixed rhythm: the design's sizes, capped.
  const capped = (role: 'heading' | 'caption' | 'body' | 'label' | 'footer', max: number) => {
    const r = resolveText({ role, style: null }, system)
    return { ...r, size: Math.min(r.size, max) }
  }
  const heading = capped('heading', 26)
  const small = capped('caption', 9)
  const body = capped('body', 11)
  const label = capped('label', 9)
  const footerStyle = capped('footer', 8)
  const top = margin + 460
  const bottom = SHEET.h - margin - 140
  type Row = { h: number; draw: (y: number, add: Add) => void }
  type Add = (
    id: string,
    role: 'text' | 'rule',
    geo: { x: number; y: number; w: number; h: number },
    style: ResolvedText | { fill: string },
    text?: string
  ) => void
  const rows: Row[] = []
  const lineH = (r: ResolvedText) => Math.ceil(((r.size * r.lineHeight) / 100) * UNITS_PER_PT)
  input.refs.forEach((ref, k) =>
    rows.push({
      h: ROW.ref,
      draw: (y, add) => {
        add(
          `ref-${k + 1}-number`,
          'text',
          { x: margin, y, w: 160, h: lineH(body) },
          { ...body, weight: 700, color: ink as ColorRef },
          String(ref.number)
        )
        add(
          `ref-${k + 1}-name`,
          'text',
          { x: margin + 180, y, w: contentW - 180, h: lineH(body) },
          { ...body, weight: 700, color: ink as ColorRef },
          ref.name
        )
        add(
          `ref-${k + 1}-locator`,
          'text',
          { x: margin + 180, y: y + lineH(body) + 10, w: contentW - 180, h: lineH(small) },
          { ...small, color: muted as ColorRef },
          `${ref.locator} · ${ref.used}`
        )
        add(
          `ref-${k + 1}-rule`,
          'rule',
          { x: margin, y: y + ROW.ref - 12, w: contentW, h: 4 },
          { fill: c(rule) }
        )
      },
    })
  )
  if (input.evidence.length) {
    rows.push({
      h: ROW.head + 60,
      draw: (y, add) => {
        add(
          'evidence-title',
          'text',
          { x: margin, y: y + 60, w: contentW, h: lineH(heading) },
          { ...heading, size: Math.min(heading.size, 14), color: ink as ColorRef },
          'Evidence at a glance'
        )
      },
    })
    input.evidence.forEach((row, k) =>
      rows.push({
        h: ROW.evidence,
        draw: (y, add) => {
          const claimW = Math.round(contentW * 0.5)
          const sourceW = Math.round(contentW * 0.28)
          const kindW = contentW - claimW - sourceW
          add(
            `evidence-${k + 1}-claim`,
            'text',
            { x: margin, y, w: claimW - 40, h: lineH(small) * 2 },
            { ...small, color: ink as ColorRef },
            row.claim
          )
          add(
            `evidence-${k + 1}-source`,
            'text',
            { x: margin + claimW, y, w: sourceW - 40, h: lineH(small) * 2 },
            { ...small, color: ink as ColorRef },
            row.source
          )
          add(
            `evidence-${k + 1}-kind`,
            'text',
            { x: margin + claimW + sourceW, y, w: kindW, h: lineH(small) * 2 },
            { ...small, color: ink as ColorRef },
            row.kind
          )
          add(
            `evidence-${k + 1}-rule`,
            'rule',
            { x: margin, y: y + ROW.evidence - 12, w: contentW, h: 4 },
            { fill: c(rule) }
          )
        },
      })
    )
  }
  // Rows go onto pages in order, a new page when the next row would pass the bottom.
  const pages: Row[][] = [[]]
  let cursor = top
  for (const row of rows) {
    if (cursor + row.h > bottom && pages.at(-1)!.length) {
      pages.push([])
      cursor = top
    }
    pages.at(-1)!.push(row)
    cursor += row.h
  }
  const total = input.totalPages(pages.length)
  return pages.map((list, p) => {
    const index = input.startIndex + p
    const sheetId = `s${index}`
    const frames: Frame[] = []
    const add: Add = (id, role, geo, st, text) => {
      const common = {
        id: `${sheetId}-${id}`,
        geo: { ...geo, y: Math.round(geo.y) },
        z: frames.length,
        order: frames.length,
      }
      if (role === 'rule')
        frames.push({
          ...common,
          kind: 'shape',
          shape: 'rect',
          style: { fill: (st as { fill: string }).fill as CanvasColor },
        })
      else {
        const r = st as ResolvedText
        frames.push({
          ...common,
          kind: 'text',
          style: textStyle(r, system, brand, false),
          doc: docOf(text ?? '', []),
        })
      }
    }
    add(
      'label',
      'text',
      { x: margin, y: margin, w: contentW, h: lineH(label) },
      { ...label, color: muted as ColorRef },
      'Sources and references'
    )
    add(
      'title',
      'text',
      { x: margin, y: margin + 90, w: contentW, h: lineH(heading) },
      { ...heading, color: ink as ColorRef },
      p ? 'Sources (continued)' : 'Where the pages draw from'
    )
    frames.push({
      id: `${sheetId}-accent`,
      kind: 'shape',
      shape: 'rect',
      geo: { x: margin, y: margin + 90 + lineH(heading) + 50, w: 600, h: 24 },
      z: frames.length,
      order: frames.length,
      style: { fill: c(accent) },
    })
    if (!p)
      add(
        'intro',
        'text',
        { x: margin, y: margin + 90 + lineH(heading) + 134, w: contentW, h: lineH(body) * 2 },
        { ...body, color: ink as ColorRef },
        trimToLines(
          'Superscript numbers on the pages point to the documents below. Locators give the pages and chunks each statement rests on.',
          contentW / UNITS_PER_PT,
          { size: body.size, line: body.size * 1.45, weight: 400, color: 'navy' },
          2
        ).text
      )
    let y = top
    for (const row of list) {
      row.draw(y, add)
      y += row.h
    }
    add(
      'footer-title',
      'text',
      {
        x: margin,
        y: SHEET.h - margin - lineH(footerStyle),
        w: Math.round(contentW * 0.7),
        h: lineH(footerStyle),
      },
      { ...footerStyle, color: muted as ColorRef },
      input.footer
    )
    add(
      'footer-page',
      'text',
      {
        x: margin + Math.round(contentW * 0.7),
        y: SHEET.h - margin - lineH(footerStyle),
        w: Math.round(contentW * 0.3),
        h: lineH(footerStyle),
      },
      { ...footerStyle, align: 'right', color: muted as ColorRef },
      `${index + 1} / ${total}`
    )
    return { id: sheetId, background: c(paper), frames }
  })
}

// ------------------------------------------------------------------- document

export type AiComposed = {
  canvas: CanvasDocument
  /** One entry per designed page, then per sources page. */
  pages: { words: number; fill: number | null; kind: 'design' | 'sources' }[]
  references: SourceRef[]
}

export function composeAiDesign(input: AiComposeInput): AiComposed {
  const reps = representativesOf(input.pages, input.sources)
  const designed = input.pages.map((p, i) =>
    composeDesignPage(p, i, {
      system: input.system,
      sources: input.sources,
      brand: input.brand,
      reps,
    })
  )
  const numbers = citationNumbers(designed.map((d) => d.sheet))
  const refs = referencesFor(input.pages, input.sources, reps, numbers)
  const evidence = evidenceRows(input.pages, refs, input.sources)
  const sourcePages = refs.length
    ? composeSourcesPages({
        system: input.system,
        sources: input.sources,
        footer: input.footer,
        brand: input.brand,
        refs,
        evidence,
        startIndex: designed.length,
        totalPages: (count) => designed.length + count,
      })
    : []
  const sheets = [...designed.map((d) => d.sheet), ...sourcePages]
  return {
    canvas: {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      template: { id: AI_TEMPLATE_ID, version: AI_TEMPLATE_VERSION },
      sheets,
    },
    pages: [
      ...designed.map((d) => ({
        words: d.words,
        fill: d.texts ? d.fill : null,
        kind: 'design' as const,
      })),
      ...sourcePages.map(() => ({ words: 0, fill: null, kind: 'sources' as const })),
    ],
    references: refs,
  }
}
