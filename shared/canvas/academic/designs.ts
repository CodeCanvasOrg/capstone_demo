import { capacityWords } from '../fit.ts'
import type { FrameStyle, Geo } from '../model.ts'
import { DEPTHS, type Depth } from './options.ts'

/**
 * The academic page designs: what each one is for, what it reads from a page,
 * where its frames sit and how many words they hold. The planner prompt, the
 * writer prompt, the validator and the composer all read this one table, as the
 * brochure's `CAPS` does, so a prompt can never promise more room than a layout
 * has. Browser-safe.
 */
export const ACADEMIC_DESIGN_IDS = [
  'title_page',
  'contents',
  'essay',
  'two_column',
  'figure_text',
  'side_figure',
  'data_findings',
  'key_concepts',
  'case_box',
  'comparison',
  'conclusion',
  'references',
] as const
export type AcademicDesignId = (typeof ACADEMIC_DESIGN_IDS)[number]

/** Pages the application places itself (the abstract is the one thing it asks the model for). */
export const FIXED_DESIGN_IDS = ['title_page', 'contents', 'references'] as const
/** Designs the planner may choose for the pages between the fixed ones. */
export const PLANNABLE_DESIGN_IDS = ACADEMIC_DESIGN_IDS.filter(
  (id) => !(FIXED_DESIGN_IDS as readonly string[]).includes(id)
) as [AcademicDesignId, ...AcademicDesignId[]]

export const isAcademicDesign = (value: unknown): value is AcademicDesignId =>
  (ACADEMIC_DESIGN_IDS as readonly unknown[]).includes(value)

export { DEPTHS, PROFILES, TEMPLATE_SETS } from './options.ts'
export type { Depth, Profile, TemplateSet } from './options.ts'

/**
 * How full a page is aimed to be, as a share of its measured capacity. Depth sets
 * the target inside the band the fit loop accepts (0.70 to 1.00), so a detailed
 * page is written to the brim and a concise one to just above the floor.
 */
export const DEPTH_FILL: Record<Depth, readonly [number, number]> = {
  concise: [0.7, 0.82],
  standard: [0.78, 0.92],
  detailed: [0.88, 0.98],
}
/** Planned page count when the author leaves it to the model. */
export const DEPTH_PAGES: Record<Depth, { min: number; max: number }> = {
  concise: { min: 4, max: 7 },
  standard: { min: 6, max: 10 },
  detailed: { min: 8, max: 12 },
}
/** Evidence tokens each page may read, set by depth. */
export const DEPTH_TOKENS: Record<Depth, number> = { concise: 2000, standard: 3500, detailed: 5000 }

/** Image slot a design offers. */
export type ImageSlot = {
  slot: string
  aspect: 'landscape' | 'portrait' | 'square'
  optional: boolean
  /** Shortest image edge in pixels this slot accepts. */
  minEdge: number
}

type Slot = { geo: Geo; style: FrameStyle }
const g = (x: number, y: number, w: number, h: number): Geo => ({ x, y, w, h })

// ------------------------------------------------------------------- type

/** The academic set's typography. Heading sizes follow the frame's font size (css.ts). */
export const TYPE = {
  body: { family: 'serif', font: 'md', lineHeight: 145, align: 'justify' },
  lead: { family: 'serif', font: 'lg', lineHeight: 140, italic: true, color: 'text' },
  title: { family: 'brand', font: 'lg', weight: 700, color: 'primary', lineHeight: 115 },
  caption: { family: 'sans', font: 'xs', italic: true, color: 'muted', lineHeight: 140 },
  running: { family: 'sans', font: 'xs', color: 'muted' },
  folio: { family: 'sans', font: 'xs', color: 'muted', align: 'right' },
  card: { family: 'serif', font: 'sm', lineHeight: 140, fill: 'surface', padding: 50, radius: 30 },
  sidebar: {
    family: 'sans',
    font: 'sm',
    lineHeight: 140,
    fill: 'surface',
    padding: 50,
    radius: 30,
  },
  takeaway: { family: 'serif', font: 'lg', weight: 700, color: 'primary', lineHeight: 140 },
  contents: { family: 'sans', font: 'lg', lineHeight: 200 },
} as const satisfies Record<string, FrameStyle>

// --------------------------------------------------------------- geometry

/** Margins: 20 mm outer; the running header and the folio sit outside the text area. */
export const MARGIN = 200
export const CONTENT_W = 1700
export const HEADER = g(MARGIN, 90, CONTENT_W, 70)
export const FOLIO = g(MARGIN, 2830, CONTENT_W, 60)

/** Frames of every design, by role. Capacity and composition read the same geometry. */
export const SLOTS = {
  title: g(MARGIN, 260, CONTENT_W, 170),
  bar: g(MARGIN, 450, 300, 20),
  lead: g(MARGIN, 520, CONTENT_W, 340),
  takeaway: g(MARGIN, 2600, CONTENT_W, 200),
  essay: {
    body: g(MARGIN, 940, 1200, 1650),
    side: g(1450, 940, 450, 1650),
  },
  two_column: {
    columns: [g(MARGIN, 940, 830, 1380), g(1070, 940, 830, 1380)],
    callout: g(MARGIN, 2360, CONTENT_W, 330),
  },
  figure_text: {
    image: g(MARGIN, 900, CONTENT_W, 640),
    caption: g(MARGIN, 1550, CONTENT_W, 110),
    columns: [g(MARGIN, 1720, 830, 870), g(1070, 1720, 830, 870)],
  },
  side_figure: {
    body: g(MARGIN, 940, 1000, 1650),
    image: g(1260, 940, 640, 720),
    caption: g(1260, 1670, 640, 170),
    side: g(1260, 1900, 640, 690),
  },
  data_findings: {
    cards: g(MARGIN, 900, CONTENT_W, 440),
    body: g(MARGIN, 1420, 1100, 1170),
    side: g(1400, 1420, 500, 1170),
  },
  key_concepts: {
    cards: [0, 1, 2].flatMap((row) =>
      [0, 1].map((col) => g(col ? 1070 : MARGIN, 900 + row * 440, 830, 400))
    ),
    body: g(MARGIN, 2240, CONTENT_W, 350),
  },
  case_box: {
    body: g(MARGIN, 900, CONTENT_W, 1000),
    bodyWithImage: g(MARGIN, 900, 1100, 1000),
    image: g(1360, 900, 540, 540),
    caption: g(1360, 1450, 540, 400),
    box: g(MARGIN, 1960, CONTENT_W, 460),
    takeaway: g(MARGIN, 2480, CONTENT_W, 200),
  },
  comparison: {
    cards: g(MARGIN, 900, CONTENT_W, 1000),
    analysis: g(MARGIN, 1960, CONTENT_W, 630),
  },
  title_page: {
    band: g(0, 0, 2100, 980),
    kicker: g(MARGIN, 250, CONTENT_W, 70),
    title: g(MARGIN, 330, CONTENT_W, 450),
    meta: g(MARGIN, 880, CONTENT_W, 70),
    abstract: g(MARGIN, 1060, CONTENT_W, 1000),
    keywords: g(MARGIN, 2120, CONTENT_W, 130),
    image: g(MARGIN, 2290, CONTENT_W, 480),
  },
  contents: {
    numbers: g(MARGIN, 600, 160, 2000),
    titles: g(400, 600, 1500, 2000),
  },
  references: { list: g(MARGIN, 600, CONTENT_W, 2150) },
} as const

/** Cards of a comparison page: two or three across the full width. */
export function comparisonCards(count: number): Geo[] {
  const n = Math.min(Math.max(count, 2), 3)
  const gap = 60
  const w = Math.floor((SLOTS.comparison.cards.w - gap * (n - 1)) / n)
  return Array.from({ length: n }, (_, i) =>
    g(MARGIN + i * (w + gap), SLOTS.comparison.cards.y, w, SLOTS.comparison.cards.h)
  )
}

/** Figure cards of a findings page: two to four across the full width. */
export function figureCards(count: number): Geo[] {
  const n = Math.min(Math.max(count, 1), 4)
  const gap = 40
  const w = Math.floor((SLOTS.data_findings.cards.w - gap * (n - 1)) / n)
  return Array.from({ length: n }, (_, i) =>
    g(MARGIN + i * (w + gap), SLOTS.data_findings.cards.y, w, SLOTS.data_findings.cards.h)
  )
}

// --------------------------------------------------------------- metadata

export type AcademicDesignInfo = {
  label: string
  description: string
  /** When this design is the right one. Read by the planner. */
  bestFor: string
  /** What the page must contain for this design, in the words the writer needs. */
  reads: string
  /** Plain prose words the page's flowing text frames hold, before depth. */
  nominalWords: readonly [number, number]
  /** How many sections (heading and paragraphs) the page carries. */
  sections: readonly [number, number]
  definitions?: readonly [number, number]
  figures?: readonly [number, number]
  callout?: boolean
  images: ImageSlot[]
}

const FIGURE_SLOT = (aspect: ImageSlot['aspect'], optional: boolean, minEdge = 600): ImageSlot => ({
  slot: 'figure',
  aspect,
  optional,
  minEdge,
})

export const ACADEMIC_DESIGNS: Record<AcademicDesignId, AcademicDesignInfo> = {
  title_page: {
    label: 'Title page',
    description: 'Brand band with the title, an abstract box, keywords and an optional hero image.',
    bestFor: 'The first page. Placed by the application.',
    reads:
      'title is the document title. lead is the abstract: 150 to 250 words stating the question, the approach, the main findings and what they mean, with no citations needed. No sections.',
    nominalWords: [150, 250],
    sections: [0, 0],
    images: [{ slot: 'hero', aspect: 'landscape', optional: true, minEdge: 600 }],
  },
  contents: {
    label: 'Contents',
    description: 'Table of contents generated from the plan, with page numbers.',
    bestFor: 'Second page of a report of six or more pages. Placed by the application.',
    reads: 'Nothing: the application writes it from the plan.',
    nominalWords: [0, 0],
    sections: [0, 0],
    images: [],
  },
  essay: {
    label: 'Essay',
    description: 'A wide reading column with a margin sidebar for a callout and key terms.',
    bestFor:
      'Developing one argument in connected prose: background, context, method, or discussion.',
    reads:
      'lead states the page claim. sections are the argument, each a heading and one to three paragraphs. callout (optional) and definitions go in the margin. takeaway closes the page.',
    nominalWords: [450, 600],
    sections: [2, 3],
    definitions: [0, 3],
    callout: true,
    images: [],
  },
  two_column: {
    label: 'Two columns',
    description: 'Two justified serif columns under a lead, with an optional callout and takeaway.',
    bestFor: 'Dense explanation that has several sub-topics and needs the most words on a page.',
    reads:
      'lead states the page claim. sections are the sub-topics, each a heading and one to three paragraphs; they flow through two columns. callout (optional) runs full width under the columns.',
    nominalWords: [600, 800],
    sections: [3, 5],
    callout: true,
    images: [],
  },
  figure_text: {
    label: 'Figure and text',
    description: 'A landscape figure with a numbered caption, then two columns of text.',
    bestFor:
      'A page built around a picture, chart or diagram from the sources that the text explains.',
    reads:
      'lead states what the figure shows. sections explain it in two columns (two or three sections). takeaway closes the page. The application places and captions the image.',
    nominalWords: [300, 420],
    sections: [2, 3],
    images: [FIGURE_SLOT('landscape', false)],
  },
  side_figure: {
    label: 'Text with side figure',
    description: 'Text beside a tall figure with a numbered caption and a sidebar.',
    bestFor:
      'A page with a portrait picture, such as a screenshot or a photo of a person or object.',
    reads:
      'lead states the claim. sections are the text (two or three). callout (optional, 35 words at most) and one definition (25 words at most) go under the figure. takeaway closes the page. The application places and captions the image.',
    nominalWords: [350, 450],
    sections: [2, 3],
    definitions: [0, 1],
    callout: true,
    images: [FIGURE_SLOT('portrait', false)],
  },
  data_findings: {
    label: 'Data and findings',
    description: 'Two to four key figures with qualifiers, an interpretation and a method note.',
    bestFor: 'Results the sources state as numbers: measurements, counts, rates, comparisons.',
    reads:
      'lead introduces the results. figures are two to four, each a short value (such as "83%"), a label and a qualifier (measured, estimated, client_reported or design_target). sections are the interpretation (one or two). callout kind "note" is the method note. takeaway closes the page.',
    nominalWords: [280, 380],
    sections: [1, 2],
    figures: [2, 4],
    callout: true,
    images: [],
  },
  key_concepts: {
    label: 'Key concepts',
    description: 'A lead paragraph and a grid of up to six defined terms.',
    bestFor: 'Introducing the vocabulary and ideas the rest of the document relies on.',
    reads:
      'lead frames the concepts. definitions are four to six terms, each a term and a definition of 30 to 45 words. sections (optional, at most one) are a short closing paragraph.',
    nominalWords: [300, 420],
    sections: [0, 1],
    definitions: [4, 6],
    images: [],
  },
  case_box: {
    label: 'Case or example',
    description: 'A narrative with a shaded case box and a takeaway line.',
    bestFor: 'Showing the idea at work through one concrete case or example from the sources.',
    reads:
      'lead states the claim. sections are the narrative (one or two). callout kind "example" is the case box: its title names the case and its text tells it in 100 to 130 words. takeaway is one line. An optional small image sits beside the narrative.',
    nominalWords: [380, 500],
    sections: [1, 2],
    callout: true,
    // A small picture beside the narrative: a thumbnail slot, so 300 px is enough.
    images: [FIGURE_SLOT('square', true, 300)],
  },
  comparison: {
    label: 'Comparison',
    description: 'Two or three criteria cards and an analysis paragraph.',
    bestFor: 'Setting options, methods or cases side by side against shared criteria.',
    reads:
      'lead frames the comparison. All sections but the last are criteria cards (two or three), each a heading and one paragraph of 50 to 80 words. The last section is the analysis: a heading and two paragraphs. takeaway closes the page.',
    nominalWords: [300, 400],
    sections: [3, 4],
    images: [],
  },
  conclusion: {
    label: 'Conclusion',
    description: 'Summary, implications, limitations and further work in a wide column.',
    bestFor: 'The last content page: what was established, what follows, what remains uncertain.',
    reads:
      'lead restates the contribution. sections are Summary, Implications, Limitations and Further work (exactly those four headings, one or two paragraphs each). callout kind "limitation" (optional) goes in the margin. takeaway closes the document.',
    nominalWords: [380, 500],
    sections: [3, 4],
    callout: true,
    images: [],
  },
  references: {
    label: 'References',
    description: 'Numbered list of the sources the pages cite.',
    bestFor: 'The last page. Placed by the application.',
    reads: 'Nothing: the application writes it from the citations.',
    nominalWords: [0, 0],
    sections: [0, 0],
    images: [],
  },
}

// --------------------------------------------------------------- capacity

/** Frames whose text flows through the page body, for capacity. */
function flowSlots(design: AcademicDesignId): Slot[] {
  const body: FrameStyle = TYPE.body
  const card: FrameStyle = TYPE.card
  switch (design) {
    case 'essay':
    case 'conclusion':
      return [{ geo: SLOTS.essay.body, style: body }]
    case 'two_column':
      return SLOTS.two_column.columns.map((geo) => ({ geo, style: body }))
    case 'figure_text':
      return SLOTS.figure_text.columns.map((geo) => ({ geo, style: body }))
    case 'side_figure':
      return [{ geo: SLOTS.side_figure.body, style: body }]
    case 'data_findings':
      return [{ geo: SLOTS.data_findings.body, style: body }]
    case 'key_concepts':
      return SLOTS.key_concepts.cards.map((geo) => ({ geo, style: card }))
    case 'case_box':
      return [
        { geo: SLOTS.case_box.body, style: body },
        { geo: SLOTS.case_box.box, style: card },
      ]
    case 'comparison':
      return [
        ...comparisonCards(3).map((geo) => ({ geo, style: card })),
        { geo: SLOTS.comparison.analysis, style: body },
      ]
    case 'title_page':
      return [{ geo: SLOTS.title_page.abstract, style: { ...body, padding: 60 } }]
    default:
      return []
  }
}

/**
 * Words of prose the page's flowing frames hold with room for headings and gaps:
 * the estimator's capacity less two lines for each section heading.
 */
export function pageCapacity(design: AcademicDesignId): number {
  const slots = flowSlots(design)
  if (!slots.length) return 0
  const reserve = Math.ceil((2 * Math.max(ACADEMIC_DESIGNS[design].sections[1], 1)) / slots.length)
  return slots.reduce((sum, slot) => sum + capacityWords(slot.geo, slot.style, reserve), 0)
}

const round5 = (n: number) => Math.round(n / 5) * 5

/**
 * The words a page of `design` is written to: the depth's fill band of the measured
 * capacity, never above what the design nominally carries. Concise, standard and
 * detailed differ by how much of the room they use.
 */
export function wordRange(design: AcademicDesignId, depth: Depth = 'standard') {
  const info = ACADEMIC_DESIGNS[design]
  const capacity = pageCapacity(design)
  if (!capacity) return { min: 0, max: 0, capacity: 0 }
  const [lo, hi] = DEPTH_FILL[depth]
  const factor = depth === 'concise' ? 0.6 : depth === 'detailed' ? 1.3 : 1
  const min = Math.min(round5(capacity * lo), round5(info.nominalWords[0] * factor))
  const max = Math.min(round5(capacity * hi), round5(info.nominalWords[1] * factor))
  return { min: Math.min(min, max), max, capacity }
}

/** Slots of a design for the gallery and the template table (`canvas_templates.slots`). */
export function designSlots(design: AcademicDesignId) {
  const info = ACADEMIC_DESIGNS[design]
  return {
    words: Object.fromEntries(DEPTHS.map((depth) => [depth, wordRange(design, depth)])),
    sections: info.sections,
    ...(info.definitions ? { definitions: info.definitions } : {}),
    ...(info.figures ? { figures: info.figures } : {}),
    images: info.images,
  }
}
