import { z } from 'zod'
import { FIGURE_PLACEHOLDER, PLACEHOLDER } from '../../brochure/content.ts'
import { QUALIFIERS, type TipTapBlock } from '../model.ts'
import { wordCount } from '../fit.ts'
import {
  ACADEMIC_DESIGNS,
  PLANNABLE_DESIGN_IDS,
  ACADEMIC_DESIGN_IDS,
  wordRange,
  type AcademicDesignId,
  type Depth,
} from './designs.ts'

/**
 * What the canvas pipeline's model calls return, and how it is checked. The model
 * writes structured page content (never canvas JSON); `compose.ts` lays it out.
 * Every schema here is the one source for the prompt text, the validator and the
 * tests. Browser-safe.
 */

const text = (max: number) => z.string().trim().min(1).max(max)
const ids = z.array(z.string().min(1).max(200)).max(6).default([])
// Models write "no value" as null, "" or leave the field out; all three mean the same.
const maybe = <T extends z.ZodType>(schema: T) => schema.nullish()

// -------------------------------------------------------------------- plan

export const planPageSchema = z.object({
  design: z.enum(PLANNABLE_DESIGN_IDS),
  title: text(90),
  purpose: text(300),
  /** Research questions: each becomes a retrieval query for this page. */
  questions: z.array(text(200)).min(2).max(5),
  keyTerms: z.array(text(60)).max(6).default([]),
  wantsImage: z.boolean().default(false),
})
export type PlanPage = z.infer<typeof planPageSchema>

export const planSchema = z.object({
  thesis: text(400),
  audience: text(200),
  pages: z.array(planPageSchema).min(1).max(14),
  /** Topics the sources do not support; they become reviewer notes. */
  coverageGaps: z.array(text(300)).max(10).default([]),
})
export type CanvasPlan = z.infer<typeof planSchema>

/** A page of the finished document: the plan's pages plus those the application adds. */
export type PagePlan = {
  design: AcademicDesignId
  title: string
  purpose: string
  questions: string[]
  keyTerms: string[]
  wantsImage: boolean
}

// -------------------------------------------------------------------- page

const cited = z.object({ text: text(1600), chunks: ids })
export const academicPageSchema = z.object({
  design: z.enum(ACADEMIC_DESIGN_IDS),
  title: text(120),
  lead: maybe(cited),
  sections: z
    .array(
      z.object({
        heading: text(120),
        paragraphs: z.array(cited).max(5),
        bullets: z.array(text(300)).max(6).default([]),
      })
    )
    .max(6)
    .default([]),
  definitions: z
    .array(z.object({ term: text(60), definition: text(500), chunks: ids }))
    .max(6)
    .default([]),
  figures: z
    .array(
      z.object({
        value: text(12),
        label: text(200),
        qualifier: z.enum(QUALIFIERS).default('measured'),
        chunks: ids,
      })
    )
    .max(4)
    .default([]),
  callout: maybe(
    z.object({
      kind: z.enum(['example', 'note', 'limitation']),
      title: text(80),
      text: text(900),
      chunks: ids,
    })
  ),
  takeaway: maybe(text(400)),
  /** One line for the pages written after this one; never part of the layout. */
  summary: text(300),
  reviewer_notes: z.array(text(300)).max(8).default([]),
})
export type AcademicPage = z.infer<typeof academicPageSchema>
export type AcademicSection = AcademicPage['sections'][number]

export { canvasOptionsSchema, type CanvasOptions } from './options.ts'

// ------------------------------------------------------------- word counts

/** Words in the page's flowing text: the sections' headings, paragraphs and bullets. */
export function bodyWords(page: AcademicPage): number {
  return page.sections.reduce(
    (sum, s) =>
      sum +
      wordCount(s.heading) +
      s.paragraphs.reduce((n, p) => n + wordCount(p.text), 0) +
      s.bullets.reduce((n, b) => n + wordCount(b), 0),
    0
  )
}

/** Words of everything the page shows, except its title. */
export function pageWords(page: AcademicPage): number {
  return (
    bodyWords(page) +
    (page.lead ? wordCount(page.lead.text) : 0) +
    page.definitions.reduce((n, d) => n + wordCount(d.term) + wordCount(d.definition), 0) +
    page.figures.reduce((n, f) => n + wordCount(f.label), 0) +
    (page.callout ? wordCount(page.callout.title) + wordCount(page.callout.text) : 0) +
    (page.takeaway ? wordCount(page.takeaway) : 0)
  )
}

/** Words that count toward a design's range: its sections, definitions and callout text. */
export function rangedWords(design: AcademicDesignId, page: AcademicPage): number {
  if (design === 'title_page') return page.lead ? wordCount(page.lead.text) : 0
  const defs = page.definitions.reduce((n, d) => n + wordCount(d.term) + wordCount(d.definition), 0)
  const call = page.callout ? wordCount(page.callout.text) : 0
  switch (design) {
    case 'key_concepts':
      return bodyWords(page) + defs
    case 'case_box':
    case 'comparison':
      return bodyWords(page) + call
    default:
      return bodyWords(page)
  }
}

export type PageProblem = {
  code:
    'uncited' | 'invented_figure' | 'missing' | 'extra' | 'too_short' | 'too_long' | 'wrong_design'
  field: string
  detail?: string
}

/** Whether the page's words fall inside the design's range at this depth. */
export function checkWordRange(
  design: AcademicDesignId,
  page: AcademicPage,
  depth: Depth
): PageProblem[] {
  const range = wordRange(design, depth)
  if (!range.capacity) return []
  const words = rangedWords(design, page)
  if (words < range.min)
    return [{ code: 'too_short', field: 'sections', detail: `${words} of ${range.min}` }]
  if (words > range.max)
    return [{ code: 'too_long', field: 'sections', detail: `${words} of ${range.max}` }]
  return []
}

// ---------------------------------------------------------------- figures

const numbers = (value: string) =>
  (value.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]+$/, '').replaceAll(',', ''))

/**
 * Whether a figure the model wrote appears in the evidence it cites: its digits
 * must be a number in one of the cited chunks. A figure with no digits (a word)
 * must appear as written. The placeholder always passes.
 */
export function figureSupported(value: string, evidence: readonly string[]): boolean {
  if (value === FIGURE_PLACEHOLDER) return true
  const wanted = numbers(value)
  const haystack = evidence.join('\n')
  if (!wanted.length) return haystack.toLowerCase().includes(value.trim().toLowerCase())
  const have = new Set(numbers(haystack))
  return wanted.every((n) => have.has(n))
}

// ----------------------------------------------------------- sanitization

/**
 * Drops chunk ids the application never supplied. The model may choose among the
 * ids it was given, never create one. Returns a copy and whether any was removed.
 */
export function sanitizePage(page: AcademicPage, allowed: ReadonlySet<string>) {
  let dropped = false
  const keep = (chunks: string[]) =>
    chunks.filter((id) => {
      if (allowed.has(id)) return true
      dropped = true
      return false
    })
  const next: AcademicPage = {
    ...page,
    lead: page.lead ? { ...page.lead, chunks: keep(page.lead.chunks) } : page.lead,
    sections: page.sections.map((s) => ({
      ...s,
      paragraphs: s.paragraphs.map((p) => ({ ...p, chunks: keep(p.chunks) })),
    })),
    definitions: page.definitions.map((d) => ({ ...d, chunks: keep(d.chunks) })),
    figures: page.figures.map((f) => ({ ...f, chunks: keep(f.chunks) })),
    callout: page.callout ? { ...page.callout, chunks: keep(page.callout.chunks) } : page.callout,
  }
  return { page: next, dropped }
}

/** Chunk ids a page cites, in reading order, without repeats. */
export function citedChunks(page: AcademicPage): string[] {
  const out: string[] = []
  const add = (chunks: string[] | undefined) =>
    chunks?.forEach((id) => out.includes(id) || out.push(id))
  add(page.lead?.chunks)
  for (const s of page.sections) s.paragraphs.forEach((p) => add(p.chunks))
  page.definitions.forEach((d) => add(d.chunks))
  page.figures.forEach((f) => add(f.chunks))
  add(page.callout?.chunks)
  return out
}

// -------------------------------------------------------------- validation

export type ValidateOptions = {
  design: AcademicDesignId
  /** Text of every supplied chunk, by id; an empty map means the document has no sources. */
  evidence: ReadonlyMap<string, string>
}

/**
 * What the model must fix on a retry: structure the design cannot show, factual
 * paragraphs with no citation (when there are sources) and figures the cited
 * evidence does not contain. Length is not a validation matter: the fit loop
 * fixes it with one expand or condense call.
 */
export function validateAcademicPage(page: AcademicPage, { design, evidence }: ValidateOptions) {
  const found: PageProblem[] = []
  const info = ACADEMIC_DESIGNS[design]
  if (page.design !== design)
    found.push({ code: 'wrong_design', field: 'design', detail: `expected ${design}` })
  const count = (field: string, n: number, [min, max]: readonly [number, number]) => {
    if (n < min) found.push({ code: 'missing', field, detail: `need at least ${min}, got ${n}` })
    if (n > max) found.push({ code: 'extra', field, detail: `at most ${max}, got ${n}` })
  }
  count('sections', page.sections.length, info.sections)
  if (info.definitions) count('definitions', page.definitions.length, info.definitions)
  else if (page.definitions.length) found.push({ code: 'extra', field: 'definitions' })
  if (info.figures) count('figures', page.figures.length, info.figures)
  else if (page.figures.length) found.push({ code: 'extra', field: 'figures' })
  if (design !== 'contents' && design !== 'references' && !page.lead)
    found.push({ code: 'missing', field: 'lead' })

  if (evidence.size) {
    page.sections.forEach((s, i) =>
      s.paragraphs.forEach((p, k) => {
        if (!p.chunks.length && p.text !== PLACEHOLDER)
          found.push({ code: 'uncited', field: `sections[${i}].paragraphs[${k}]` })
      })
    )
    page.definitions.forEach((d, i) => {
      if (!d.chunks.length && d.definition !== PLACEHOLDER)
        found.push({ code: 'uncited', field: `definitions[${i}]` })
    })
  }
  page.figures.forEach((f, i) => {
    const supporting = f.chunks.map((id) => evidence.get(id)).filter((t): t is string => !!t)
    if (!figureSupported(f.value, supporting))
      found.push({ code: 'invented_figure', field: `figures[${i}]`, detail: f.value })
  })
  return found
}

// --------------------------------------------------------------- serialize

type Node = TipTapBlock
const textNode = (value: string) => ({ type: 'text', text: value })

/** A paragraph with its citation marks. Shared with the composer. */
export const paragraphNode = (value: string, chunks: string[] = []): Node => ({
  type: 'paragraph',
  content: [
    textNode(value),
    ...chunks.map((id) => ({ type: 'sourceCitation', attrs: { sourceChunkId: id } })),
  ],
})
export const headingNode = (level: number, value: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [textNode(value)],
})
export const boldLead = (term: string, rest: string, chunks: string[] = []): Node => ({
  type: 'paragraph',
  content: [
    { type: 'text', text: term, marks: [{ type: 'bold' }] },
    textNode(` ${rest}`),
    ...chunks.map((id) => ({ type: 'sourceCitation', attrs: { sourceChunkId: id } })),
  ],
})
export const bulletsNode = (items: string[]): Node => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraphNode(item)] })),
})

/** Blocks of the sections: a heading, its paragraphs and bullets, in order. */
export function sectionBlocks(sections: readonly AcademicSection[], level = 2): Node[] {
  return sections.flatMap((s) => [
    headingNode(level, s.heading),
    ...s.paragraphs.map((p) => paragraphNode(p.text, p.chunks)),
    ...(s.bullets.length ? [bulletsNode(s.bullets)] : []),
  ])
}

/**
 * Pages as an ordinary flat document (a page break between pages), for the text
 * editor and for tests that check nothing the model wrote is lost. Chunk ids the
 * application never supplied are dropped, never turned into citations.
 */
export function documentFromAcademicPages(
  pages: AcademicPage[],
  { allowedChunkIds = new Set<string>() }: { allowedChunkIds?: ReadonlySet<string> } = {}
) {
  let dropped = false
  const content: Node[] = []
  pages.forEach((original, p) => {
    const clean = sanitizePage(original, allowedChunkIds)
    dropped ||= clean.dropped
    const page = clean.page
    if (p > 0) content.push({ type: 'horizontalRule' })
    content.push(headingNode(p === 0 ? 1 : 2, page.title))
    if (page.lead) content.push(paragraphNode(page.lead.text, page.lead.chunks))
    content.push(...sectionBlocks(page.sections, 3))
    for (const d of page.definitions) content.push(boldLead(d.term, d.definition, d.chunks))
    for (const f of page.figures) content.push(paragraphNode(`${f.value} — ${f.label}`))
    if (page.callout)
      content.push(boldLead(`${page.callout.title}.`, page.callout.text, page.callout.chunks))
    if (page.takeaway) content.push(paragraphNode(page.takeaway))
  })
  return { document: { type: 'doc' as const, content }, dropped }
}
