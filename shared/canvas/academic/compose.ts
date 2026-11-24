import { blocksHeight } from '../fit.ts'
import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  type Frame,
  type FrameStyle,
  type Geo,
  type Sheet,
  type TipTapBlock,
} from '../model.ts'
import {
  boldLead,
  headingNode,
  paragraphNode,
  sectionBlocks,
  type AcademicPage,
} from './content.ts'
import {
  FOLIO,
  HEADER,
  SLOTS,
  TYPE,
  comparisonCards,
  figureCards,
  type AcademicDesignId,
} from './designs.ts'

/**
 * Lays academic pages out as canvas sheets, the way `compose.ts` lays out
 * brochure pages: one sheet per page, frames placed by the page's design,
 * deterministic, nothing dropped (content a design has no slot for joins its
 * main text frame). Same typography everywhere: serif body, justified, 9.5 pt
 * on a 145% line; a running header and a folio on every page but the title page.
 * Browser-safe.
 */

export type AcademicImage = {
  imageId: string
  alt: string
  caption: string
  focus?: { x: number; y: number } | null
  /** Where the picture comes from, printed after the caption. */
  source?: string | null
}

export type AcademicInput = {
  design: AcademicDesignId
  /** Absent for `contents` and `references`, which the composer writes itself. */
  page?: AcademicPage
  image?: AcademicImage | null
}

export type Reference = { label: string; pages?: string }

export type AcademicMeta = {
  /** The document title: the running header and the title page. */
  title: string
  /** Kicker above the title ("Academic report"). */
  label: string
  /** Printed under the title; the caller supplies it, so composing stays deterministic. */
  date?: string
  keywords: string[]
  /** Numbered sources for the references page, in order of first citation. */
  references: Reference[]
}

type Node = TipTapBlock
const WHITE: FrameStyle = { color: 'white' }

class AcademicSheetBuilder {
  frames: Frame[] = []
  private n = 0
  constructor(readonly id: string) {}

  private next(role: string) {
    const i = this.n++
    return { id: `${this.id}-${role}`, z: i, order: i }
  }

  text(role: string, geo: Geo, nodes: (Node | undefined | false)[], style: FrameStyle = {}) {
    const doc = nodes.filter((n): n is Node => !!n)
    if (!doc.length) return
    this.frames.push({ ...this.next(role), kind: 'text', geo, style, doc })
  }

  figure(
    role: string,
    geo: Geo,
    value: string,
    label: string,
    qualifier?: Extract<Frame, { kind: 'figure' }>['qualifier'],
    style: FrameStyle = {}
  ) {
    this.frames.push({ ...this.next(role), kind: 'figure', geo, style, value, label, qualifier })
  }

  image(role: string, geo: Geo, image: AcademicImage) {
    this.frames.push({
      ...this.next(role),
      kind: 'image',
      geo,
      style: {},
      imageId: image.imageId,
      alt: image.alt.slice(0, 300),
      fit: 'cover',
      ...(image.focus ? { focus: image.focus } : {}),
    })
  }

  shape(role: string, geo: Geo, fill: FrameStyle['fill'], style: FrameStyle = {}) {
    this.frames.push({
      ...this.next(role),
      kind: 'shape',
      geo,
      style: { fill, ...style },
      shape: 'rect',
    })
  }

  art(role: string, geo: Geo, art: 'ribbons' | 'glow') {
    this.frames.push({ ...this.next(role), kind: 'art', geo, style: {}, art })
  }
}

const QUALIFIER_LABEL = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
} as const

/** A paragraph of plain text and citations, cut after sentence `at`; each part keeps the citations. */
function splitParagraph(block: Node, at: number): [Node, Node] | null {
  const inline = (block.content ?? []) as { type: string; text?: string; marks?: unknown[] }[]
  const [first, ...rest] = inline
  if (block.type !== 'paragraph' || first?.type !== 'text' || first.marks?.length) return null
  if (rest.some((node) => node.type !== 'sourceCitation')) return null
  const sentences = (first.text ?? '').split(/(?<=[.!?])\s+/)
  if (at <= 0 || at >= sentences.length) return null
  const part = (text: string): Node => ({
    type: 'paragraph',
    content: [{ type: 'text', text }, ...structuredClone(rest)],
  })
  return [part(sentences.slice(0, at).join(' ')), part(sentences.slice(at).join(' '))]
}

/**
 * Two columns from one flow of blocks, cut where the taller column is shortest.
 * A long paragraph may be cut at a sentence so the columns end level, as a
 * browser's column flow would; every part keeps its citations.
 */
function balance(blocks: Node[], geos: readonly Geo[], style: FrameStyle): Node[][] {
  if (geos.length === 1) return [blocks]
  let best: Node[][] = [blocks, []]
  let cost = Infinity
  const consider = (left: Node[], right: Node[]) => {
    // A heading never ends a column.
    if (left.at(-1)?.type === 'heading') return
    const worst = Math.max(blocksHeight(left, geos[0], style), blocksHeight(right, geos[1], style))
    if (worst < cost) {
      cost = worst
      best = [left, right]
    }
  }
  for (let k = 0; k <= blocks.length; k++) {
    consider(blocks.slice(0, k), blocks.slice(k))
    const block = blocks[k]
    if (!block) continue
    const sentences = splitParagraph(block, 1) ? 40 : 0
    for (let at = 1; at < sentences; at++) {
      const parts = splitParagraph(block, at)
      if (!parts) break
      consider([...blocks.slice(0, k), parts[0]], [parts[1], ...blocks.slice(k + 1)])
    }
  }
  return best
}

const calloutBlocks = (page: AcademicPage): Node[] =>
  page.callout
    ? [headingNode(4, page.callout.title), paragraphNode(page.callout.text, page.callout.chunks)]
    : []

const definitionBlocks = (page: AcademicPage): Node[] =>
  page.definitions.map((d) => boldLead(d.term, d.definition, d.chunks))

const figureBlocks = (page: AcademicPage): Node[] =>
  page.figures.map((f) => paragraphNode(`${f.value} — ${f.label}`))

/** Figure caption, numbered by the caller: "Figure 2. Text. Source: file." */
const captionNode = (image: AcademicImage, figure: number): Node => ({
  type: 'paragraph',
  content: [
    {
      type: 'text',
      text: `Figure ${figure}. ${image.caption}${image.source ? ` Source: ${image.source}.` : ''}`,
    },
  ],
})

const titleBlock = (title: string): Node => headingNode(2, title)

function head(b: AcademicSheetBuilder, page: AcademicPage, withLead = true) {
  b.text('ttl', SLOTS.title, [titleBlock(page.title)], TYPE.title)
  b.shape('bar', SLOTS.bar, 'accent')
  if (withLead && page.lead)
    b.text('lead', SLOTS.lead, [paragraphNode(page.lead.text, page.lead.chunks)], TYPE.lead)
}

const takeaway = (b: AcademicSheetBuilder, page: AcademicPage, geo: Geo = SLOTS.takeaway) =>
  b.text('take', geo, [page.takeaway ? paragraphNode(page.takeaway) : undefined], TYPE.takeaway)

type Context = {
  b: AcademicSheetBuilder
  index: number
  meta: AcademicMeta
  input: AcademicInput
  /** Figure number of this page's image, if it has one. */
  figure: number
  /** Table of contents rows, for the contents page. */
  contents: { title: string; page: number }[]
}

function essay({ b, input }: Context) {
  const page = input.page!
  head(b, page)
  const extras = [...figureBlocks(page)]
  b.text('body', SLOTS.essay.body, [...sectionBlocks(page.sections), ...extras], TYPE.body)
  b.text(
    'side',
    SLOTS.essay.side,
    [...calloutBlocks(page), ...definitionBlocks(page)],
    TYPE.sidebar
  )
  takeaway(b, page)
}

function twoColumn({ b, input }: Context) {
  const page = input.page!
  head(b, page)
  const flow = [...sectionBlocks(page.sections), ...definitionBlocks(page), ...figureBlocks(page)]
  const [left, right] = balance(flow, SLOTS.two_column.columns, TYPE.body)
  b.text('col0', SLOTS.two_column.columns[0], left, TYPE.body)
  b.text('col1', SLOTS.two_column.columns[1], right, TYPE.body)
  b.text('call', SLOTS.two_column.callout, calloutBlocks(page), TYPE.card)
  takeaway(b, page)
}

function figureText(ctx: Context) {
  const { b, input } = ctx
  const page = input.page!
  // Without a picture the page is two columns: an empty figure box would print blank.
  if (!input.image) return twoColumn(ctx)
  head(b, page)
  b.image('img', SLOTS.figure_text.image, input.image)
  b.text('cap', SLOTS.figure_text.caption, [captionNode(input.image, ctx.figure)], TYPE.caption)
  const flow = [
    ...sectionBlocks(page.sections),
    ...calloutBlocks(page),
    ...definitionBlocks(page),
    ...figureBlocks(page),
  ]
  const [left, right] = balance(flow, SLOTS.figure_text.columns, TYPE.body)
  b.text('col0', SLOTS.figure_text.columns[0], left, TYPE.body)
  b.text('col1', SLOTS.figure_text.columns[1], right, TYPE.body)
  takeaway(b, page)
}

function sideFigure(ctx: Context) {
  const { b, input } = ctx
  const page = input.page!
  if (!input.image) return essay(ctx)
  head(b, page)
  b.text(
    'body',
    SLOTS.side_figure.body,
    [...sectionBlocks(page.sections), ...figureBlocks(page)],
    TYPE.body
  )
  b.image('img', SLOTS.side_figure.image, input.image)
  b.text('cap', SLOTS.side_figure.caption, [captionNode(input.image, ctx.figure)], TYPE.caption)
  b.text(
    'side',
    SLOTS.side_figure.side,
    [...calloutBlocks(page), ...definitionBlocks(page)],
    TYPE.sidebar
  )
  takeaway(b, page)
}

function dataFindings({ b, input }: Context) {
  const page = input.page!
  head(b, page)
  const geos = figureCards(page.figures.length)
  page.figures.slice(0, 4).forEach((f, i) => {
    const card = geos[i]
    b.shape(`card${i}`, card, 'surface', { radius: 30 })
    b.figure(
      `fig${i}`,
      { x: card.x + 40, y: card.y + 40, w: card.w - 80, h: 270 },
      f.value,
      f.label,
      f.qualifier,
      { font: 'xxl', weight: 800, color: 'primary', family: 'brand' }
    )
    b.text(
      `qual${i}`,
      { x: card.x + 40, y: card.y + card.h - 90, w: card.w - 80, h: 60 },
      [{ type: 'paragraph', content: [{ type: 'text', text: QUALIFIER_LABEL[f.qualifier] }] }],
      { font: 'xs', caps: true, color: 'muted', family: 'sans', weight: 600 }
    )
  })
  b.text('body', SLOTS.data_findings.body, sectionBlocks(page.sections), TYPE.body)
  b.text(
    'side',
    SLOTS.data_findings.side,
    [...calloutBlocks(page), ...definitionBlocks(page)],
    TYPE.sidebar
  )
  takeaway(b, page)
}

function keyConcepts({ b, input }: Context) {
  const page = input.page!
  head(b, page)
  page.definitions
    .slice(0, 6)
    .forEach((d, i) =>
      b.text(
        `card${i}`,
        SLOTS.key_concepts.cards[i],
        [boldLead(d.term, d.definition, d.chunks)],
        TYPE.card
      )
    )
  b.text(
    'body',
    SLOTS.key_concepts.body,
    [...sectionBlocks(page.sections, 3), ...calloutBlocks(page), ...figureBlocks(page)],
    TYPE.body
  )
  takeaway(b, page)
}

function caseBox({ b, input, figure }: Context) {
  const page = input.page!
  head(b, page)
  const image = input.image
  b.text(
    'body',
    image ? SLOTS.case_box.bodyWithImage : SLOTS.case_box.body,
    [...sectionBlocks(page.sections), ...definitionBlocks(page), ...figureBlocks(page)],
    TYPE.body
  )
  if (image) {
    b.image('img', SLOTS.case_box.image, image)
    b.text('cap', SLOTS.case_box.caption, [captionNode(image, figure)], TYPE.caption)
  }
  b.text('box', SLOTS.case_box.box, calloutBlocks(page), TYPE.card)
  if (page.takeaway) b.shape('bar2', { x: 200, y: 2465, w: 300, h: 20 }, 'accent')
  takeaway(b, page, SLOTS.case_box.takeaway)
}

function comparison({ b, input }: Context) {
  const page = input.page!
  head(b, page)
  const sections = page.sections
  const analysis = sections.length > 1 ? sections.at(-1)! : undefined
  const cards = (analysis ? sections.slice(0, -1) : sections).slice(0, 3)
  // A fourth criterion would have no card: it joins the analysis, so nothing is lost.
  const spill = analysis ? sections.slice(0, -1).slice(3) : []
  const geos = comparisonCards(cards.length)
  cards.forEach((s, i) =>
    b.text(`card${i}`, geos[i], sectionBlocks([s], 3), { ...TYPE.card, font: 'sm' })
  )
  b.text(
    'body',
    SLOTS.comparison.analysis,
    [
      ...(analysis ? sectionBlocks([...spill, analysis], 3) : []),
      ...calloutBlocks(page),
      ...definitionBlocks(page),
      ...figureBlocks(page),
    ],
    TYPE.body
  )
  takeaway(b, page)
}

function titlePage({ b, input, meta }: Context) {
  const page = input.page!
  const s = SLOTS.title_page
  b.shape('band', s.band, 'primary')
  b.art('art', s.band, 'ribbons')
  b.text('kick', s.kicker, [{ type: 'paragraph', content: [{ type: 'text', text: meta.label }] }], {
    ...WHITE,
    family: 'sans',
    font: 'sm',
    caps: true,
    tracking: 120,
    weight: 600,
  })
  b.text('ttl', s.title, [headingNode(1, meta.title)], {
    ...WHITE,
    family: 'brand',
    size: 14,
    weight: 800,
    lineHeight: 115,
    valign: 'bottom',
  })
  b.text(
    'meta',
    s.meta,
    [meta.date ? { type: 'paragraph', content: [{ type: 'text', text: meta.date }] } : undefined],
    { ...WHITE, family: 'sans', font: 'xs' }
  )
  b.text(
    'body',
    s.abstract,
    [
      headingNode(3, 'Abstract'),
      ...(page.lead ? [paragraphNode(page.lead.text, page.lead.chunks)] : []),
      ...sectionBlocks(page.sections, 4),
    ],
    { ...TYPE.body, fill: 'surface', padding: 60, radius: 30 }
  )
  b.text(
    'kw',
    s.keywords,
    [
      meta.keywords.length
        ? {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Keywords: ', marks: [{ type: 'bold' }] },
              { type: 'text', text: meta.keywords.join(', ') },
            ],
          }
        : undefined,
    ],
    { family: 'sans', font: 'xs', color: 'muted' }
  )
  if (input.image) b.image('img', s.image, input.image)
}

const ellipsis = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

function contents({ b, contents: rows }: Context) {
  b.text('ttl', SLOTS.title, [titleBlock('Contents')], TYPE.title)
  b.shape('bar', SLOTS.bar, 'accent')
  const para = (value: string, marks?: { type: string }[]): Node => ({
    type: 'paragraph',
    content: [{ type: 'text', text: value, ...(marks ? { marks } : {}) }],
  })
  // Two frames with one line height keep each page number beside its title.
  b.text(
    'titles',
    SLOTS.contents.titles,
    rows.map((r) => para(ellipsis(r.title, 64))),
    TYPE.contents
  )
  b.text(
    'nums',
    SLOTS.contents.numbers,
    rows.map((r) => para(String(r.page), [{ type: 'bold' }])),
    { ...TYPE.contents, align: 'right', color: 'primary' }
  )
}

function references({ b, meta }: Context) {
  b.text('ttl', SLOTS.title, [titleBlock('References')], TYPE.title)
  b.shape('bar', SLOTS.bar, 'accent')
  const items: Node[] = meta.references.map((r, i) => ({
    type: 'paragraph',
    content: [
      { type: 'text', text: `${i + 1}. `, marks: [{ type: 'bold' }] },
      { type: 'text', text: `${r.label}${r.pages ? `, ${r.pages}` : ''}` },
    ],
  }))
  b.text('list', SLOTS.references.list, items, {
    family: 'serif',
    font: meta.references.length > 30 ? 'xs' : 'sm',
    lineHeight: 150,
  })
}

const LAYOUTS: Record<AcademicDesignId, (ctx: Context) => void> = {
  title_page: titlePage,
  contents,
  essay,
  two_column: twoColumn,
  figure_text: figureText,
  side_figure: sideFigure,
  data_findings: dataFindings,
  key_concepts: keyConcepts,
  case_box: caseBox,
  comparison,
  conclusion: essay,
  references,
}

/** Running header and folio: small text frames on every page but the title page. */
function chrome(b: AcademicSheetBuilder, index: number, meta: AcademicMeta) {
  b.text(
    'run',
    HEADER,
    [{ type: 'paragraph', content: [{ type: 'text', text: ellipsis(meta.title, 90) }] }],
    TYPE.running
  )
  b.shape('rule', { x: HEADER.x, y: HEADER.y + HEADER.h + 10, w: HEADER.w, h: 20 }, 'muted', {
    fillAlpha: 25,
  })
  b.text(
    'folio',
    FOLIO,
    [{ type: 'paragraph', content: [{ type: 'text', text: String(index + 1) }] }],
    TYPE.folio
  )
}

export function composeAcademicSheet(
  input: AcademicInput,
  index: number,
  meta: AcademicMeta,
  extra: { figure?: number; contents?: { title: string; page: number }[] } = {}
): Sheet {
  const b = new AcademicSheetBuilder(`s${index}`)
  LAYOUTS[input.design]({
    b,
    index,
    meta,
    input,
    figure: extra.figure ?? 1,
    contents: extra.contents ?? [],
  })
  if (input.design !== 'title_page') chrome(b, index, meta)
  return { id: b.id, background: 'white', frames: b.frames }
}

/**
 * The whole document: one sheet per page. Figure numbers run in page order and
 * the contents list the pages that follow it, so numbers and page numbers always
 * agree with the sheets.
 */
export function composeAcademic(inputs: AcademicInput[], meta: AcademicMeta): CanvasDocument {
  const rows = inputs.flatMap((input, i) =>
    input.design === 'title_page' || input.design === 'contents'
      ? []
      : [
          {
            title: input.page?.title ?? (input.design === 'references' ? 'References' : ''),
            page: i + 1,
          },
        ]
  )
  let figure = 0
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    sheets: inputs.map((input, i) => {
      // Only pages that really show an image take a figure number.
      const shows =
        !!input.image && ['figure_text', 'side_figure', 'case_box'].includes(input.design)
      if (shows) figure++
      return composeAcademicSheet(input, i, meta, { figure, contents: rows })
    }),
  }
}
