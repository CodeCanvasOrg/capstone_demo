import { z } from 'zod'
import { COMMENTARY } from './checks.ts'
import { isFigure } from './figure.ts'
import {
  CAPABILITY_STATUSES,
  FORMAT_HEADINGS,
  FORMAT_ORDER,
  STATUS_LABEL,
  type EntryFormat,
  type SectionRoleName,
} from './formats.ts'

/**
 * Structured output contract for a branded one-to-two page entry (feedback §07).
 * The model fills fields; code decides blocks, order and layout. Missing
 * information is an empty field plus a reviewer note, never a sentence about
 * the source. Browser-safe: no server imports.
 */
export const ENTRY_LIMITS = {
  headline: 60,
  subhead: 160,
  challengeSentences: 3,
  resultValue: 24,
  resultLabel: 80,
  results: 4,
  steps: 5,
  stepTitle: 40,
  stepText: 140,
  capabilities: 3,
  capabilityTitle: 50,
  capabilityText: 200,
  roadmap: 240,
  limitations: 320,
  roadmapItems: 4,
  roadmapWhen: 24,
  roadmapItemText: 140,
  footnoteText: 240,
  footnotes: 12,
  notes: 20,
  note: 300,
  paragraph: 700,
  imageAlt: 120,
} as const

export type EntryLimits = { -readonly [K in keyof typeof ENTRY_LIMITS]: number }

/**
 * Per-template caps. A one-page template gets tighter counts so regenerated
 * copy fits its page budget instead of relying on the fitting step to shrink it.
 */
export function entryLimitsFor(
  template?: { pageBudget: number },
  format: EntryFormat = 'case_study'
): EntryLimits {
  const base: EntryLimits =
    !template || template.pageBudget > 1
      ? { ...ENTRY_LIMITS }
      : { ...ENTRY_LIMITS, results: 3, steps: 3, capabilities: 2, roadmap: 120, paragraph: 450 }
  // Each format has a different natural shape; the one-page cap still wins.
  const wider = !template || template.pageBudget > 1
  if (format === 'technical')
    return { ...base, results: wider ? 4 : 3, steps: wider ? 5 : 4, capabilities: wider ? 4 : 3 }
  if (format === 'portfolio') return { ...base, capabilities: wider ? 4 : 3 }
  if (format === 'vision')
    return {
      ...base,
      results: 0,
      steps: 3,
      capabilities: wider ? 4 : 3,
      roadmapItems: wider ? 4 : 3,
    }
  return base
}

export const EVIDENCE_KINDS = ['measured', 'estimated', 'client_reported', 'design_target'] as const
export const ENTRY_DOC_TYPES = ['client_case_study', 'product', 'research', 'news'] as const

const ids = z.array(z.number().int().min(1)).max(6).default([])
const paragraph = z.object({
  text: z.string().trim().max(ENTRY_LIMITS.paragraph),
  footnote_ids: ids,
})

const buildEntrySchema = (maxCapabilities: number) =>
  z.object({
    doc_type: z.enum(ENTRY_DOC_TYPES),
    hero: z.object({
      headline: z.string().trim().min(1).max(ENTRY_LIMITS.headline),
      subhead: z.string().trim().min(1).max(ENTRY_LIMITS.subhead),
    }),
    results: z
      .array(
        z.object({
          value: z.string().trim().min(1).max(ENTRY_LIMITS.resultValue),
          comparison: z.enum(['exact', 'up_to', 'at_least', 'range']).optional(),
          label: z.string().trim().min(1).max(ENTRY_LIMITS.resultLabel),
          evidence: z.enum(EVIDENCE_KINDS),
          footnote_ids: ids,
        })
      )
      .max(ENTRY_LIMITS.results),
    challenge: paragraph,
    solution: paragraph,
    steps: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(ENTRY_LIMITS.stepTitle),
          text: z.string().trim().min(1).max(ENTRY_LIMITS.stepText),
        })
      )
      .max(ENTRY_LIMITS.steps),
    capabilities: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(ENTRY_LIMITS.capabilityTitle),
          text: z.string().trim().min(1).max(ENTRY_LIMITS.capabilityText),
          /** Availability, written for the vision format only. */
          status: z.enum(CAPABILITY_STATUSES).optional(),
        })
      )
      .max(maxCapabilities),
    /** One supplied image chunk for the top-right of the hero; omitted when none suits. */
    hero_image: z
      .object({
        chunk_id: z.string().min(1).max(200),
        alt: z.string().trim().min(1).max(ENTRY_LIMITS.imageAlt),
      })
      .nullable()
      .optional(),
    roadmap: z.string().trim().max(ENTRY_LIMITS.roadmap).optional(),
    /** Technical format: what the evaluation did not cover and what is still open. */
    limitations: z.string().trim().max(ENTRY_LIMITS.limitations).optional(),
    /** Vision format: planned work by horizon ("Now", "Next", "Later"). */
    roadmap_items: z
      .array(
        z.object({
          when: z.string().trim().min(1).max(ENTRY_LIMITS.roadmapWhen),
          text: z.string().trim().min(1).max(ENTRY_LIMITS.roadmapItemText),
        })
      )
      .max(ENTRY_LIMITS.roadmapItems)
      .optional(),
    footnotes: z
      .array(
        z.object({
          id: z.number().int().min(1),
          text: z.string().trim().min(1).max(ENTRY_LIMITS.footnoteText),
          chunks: z.array(z.string().min(1).max(200)).max(6),
        })
      )
      .max(ENTRY_LIMITS.footnotes),
    reviewer_notes: z
      .array(z.string().trim().min(1).max(ENTRY_LIMITS.note))
      .max(ENTRY_LIMITS.notes),
  })

export const entrySchema = buildEntrySchema(ENTRY_LIMITS.capabilities)
/** The other formats show up to four capability cards. */
const wideEntrySchema = buildEntrySchema(ENTRY_LIMITS.capabilities + 1)
export const entrySchemaFor = (format: EntryFormat = 'case_study') =>
  format === 'case_study' ? entrySchema : wideEntrySchema
export type BrandedEntry = z.infer<typeof entrySchema>

export type EntryProblem = { code: string; field: string }

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const IDENTIFIER = new RegExp(`\\bchunk\\b|\\.pdf\\b|${UUID.source}`, 'i')
const QUALIFIER_WORDS = /^\s*(?:up to|at least|over|about|approximately|around|nearly)\b/i

/** Every string the reader sees, with its field path. */
function copyFields(entry: BrandedEntry): [string, string][] {
  return [
    ['hero.headline', entry.hero.headline],
    ['hero.subhead', entry.hero.subhead],
    ['challenge.text', entry.challenge.text],
    ['solution.text', entry.solution.text],
    ['roadmap', entry.roadmap ?? ''],
    ['limitations', entry.limitations ?? ''],
    ...(entry.roadmap_items ?? []).flatMap((r, i): [string, string][] => [
      [`roadmap_items[${i}].when`, r.when],
      [`roadmap_items[${i}].text`, r.text],
    ]),
    ...entry.results.map((r, i): [string, string] => [`results[${i}].label`, r.label]),
    ...entry.steps.flatMap((s, i): [string, string][] => [
      [`steps[${i}].title`, s.title],
      [`steps[${i}].text`, s.text],
    ]),
    ...entry.capabilities.flatMap((c, i): [string, string][] => [
      [`capabilities[${i}].title`, c.title],
      [`capabilities[${i}].text`, c.text],
    ]),
  ]
}

const sentences = (value: string) =>
  value.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/).filter(Boolean).length

/**
 * Hygiene the schema cannot express. Failing fields are reported by path so a
 * retry can target them; nothing here claims that a citation proves support.
 */
export function validateEntry(
  entry: BrandedEntry,
  limits: EntryLimits = ENTRY_LIMITS
): EntryProblem[] {
  const found: EntryProblem[] = []
  const over = (field: string, size: number, max: number) => {
    if (size > max) found.push({ code: 'over_template_limit', field })
  }
  over('results', entry.results.length, limits.results)
  over('steps', entry.steps.length, limits.steps)
  over('capabilities', entry.capabilities.length, limits.capabilities)
  over('roadmap', (entry.roadmap ?? '').length, limits.roadmap)
  over('limitations', (entry.limitations ?? '').length, limits.limitations)
  over('roadmap_items', (entry.roadmap_items ?? []).length, limits.roadmapItems)
  over('challenge.text', entry.challenge.text.length, limits.paragraph)
  over('solution.text', entry.solution.text.length, limits.paragraph)
  for (const [field, value] of copyFields(entry)) {
    if (COMMENTARY.test(value)) found.push({ code: 'copy_commentary', field })
    if (IDENTIFIER.test(value)) found.push({ code: 'copy_identifier', field })
  }
  if (sentences(entry.challenge.text) > ENTRY_LIMITS.challengeSentences)
    found.push({ code: 'too_many_sentences', field: 'challenge.text' })
  entry.results.forEach((result, index) => {
    if (QUALIFIER_WORDS.test(result.value))
      found.push({ code: 'qualifier_in_value', field: `results[${index}].value` })
    else if (!isFigure(result.value))
      found.push({ code: 'non_numeric_value', field: `results[${index}].value` })
  })
  const known = new Set(entry.footnotes.map((note) => note.id))
  const refs: [string, number[]][] = [
    ['challenge.footnote_ids', entry.challenge.footnote_ids],
    ['solution.footnote_ids', entry.solution.footnote_ids],
    ...entry.results.map((r, i): [string, number[]] => [
      `results[${i}].footnote_ids`,
      r.footnote_ids,
    ]),
  ]
  for (const [field, list] of refs)
    if (list.some((id) => !known.has(id))) found.push({ code: 'unknown_footnote', field })
  return found
}

export const SECTION_HEADINGS = {
  results: 'Key results',
  challenge: 'The challenge',
  solution: 'The solution',
  steps: 'How it works',
  capabilities: 'Key capabilities',
  roadmap: 'Roadmap',
} as const

type Node = {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  content?: Node[]
}

export type ResultSidecar = {
  /** Top-level index of the paragraph that holds this result. */
  index: number
  /** Its full text, so the paragraph can be found again after normalization. */
  text: string
  valueLength: number
  qualifier: (typeof EVIDENCE_KINDS)[number]
  comparison?: 'exact' | 'up_to' | 'at_least' | 'range'
  units: string
  methodology?: string
  chunkIds: string[]
}
export type EntrySidecar = {
  /** The format the entry was written in; stored in the publication metadata. */
  format?: EntryFormat
  results: ResultSidecar[]
  /** Private reviewer notes: never part of the document body. */
  notes: string[]
}

const text = (value: string): Node => ({ type: 'text', text: value })
const para = (value: string, chunkIds: string[] = []): Node => ({
  type: 'paragraph',
  content: [
    text(value),
    ...chunkIds.map((id) => ({ type: 'sourceCitation', attrs: { sourceChunkId: id } })),
  ],
})
const heading = (level: number, value: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
})
const item = (value: string): Node => ({ type: 'listItem', content: [para(value)] })

/**
 * Builds ordinary editable TipTap blocks in the fixed section order. Empty
 * sections are not emitted. Chunk ids the application never supplied are
 * dropped and recorded as a private note instead of becoming a citation.
 */
export function entryToDocument(
  entry: BrandedEntry,
  {
    allowedChunkIds,
    imageChunkIds = new Set<string>(),
    format = 'case_study',
  }: {
    allowedChunkIds: ReadonlySet<string>
    imageChunkIds?: ReadonlySet<string>
    format?: EntryFormat
  }
): { document: { type: 'doc'; content: Node[] }; sidecar: EntrySidecar } {
  const notes = [...entry.reviewer_notes]
  const byId = new Map(entry.footnotes.map((note) => [note.id, note]))
  let dropped = false
  const chunksFor = (footnoteIds: number[]) => {
    const out: string[] = []
    for (const id of footnoteIds)
      for (const chunk of byId.get(id)?.chunks ?? []) {
        if (!allowedChunkIds.has(chunk)) dropped = true
        else if (!out.includes(chunk)) out.push(chunk)
      }
    return out
  }

  const content: Node[] = [heading(1, entry.hero.headline), para(entry.hero.subhead)]
  // The hero illustration must be an image the application supplied; never an invented one.
  let droppedImage = false
  if (entry.hero_image) {
    if (imageChunkIds.has(entry.hero_image.chunk_id))
      content.push({
        type: 'image',
        attrs: { sourceChunkId: entry.hero_image.chunk_id, alt: entry.hero_image.alt },
      })
    else droppedImage = true
  }
  const results: ResultSidecar[] = []
  const heads = FORMAT_HEADINGS[format]
  const sections: Record<SectionRoleName, () => void> = {
    results: () => {
      if (!entry.results.length) return
      content.push(heading(2, heads.results))
      for (const result of entry.results) {
        const chunkIds = chunksFor(result.footnote_ids)
        results.push({
          index: content.length,
          text: `${result.value} — ${result.label}`,
          valueLength: result.value.length,
          qualifier: result.evidence,
          ...(result.comparison ? { comparison: result.comparison } : {}),
          units: result.label,
          ...(result.footnote_ids.length
            ? {
                methodology: result.footnote_ids
                  .map((id) => byId.get(id)?.text)
                  .filter(Boolean)
                  .join(' '),
              }
            : {}),
          chunkIds,
        })
        content.push(para(`${result.value} — ${result.label}`, chunkIds))
      }
    },
    challenge: () => {
      if (!entry.challenge.text) return
      content.push(heading(2, heads.challenge))
      content.push(para(entry.challenge.text, chunksFor(entry.challenge.footnote_ids)))
    },
    solution: () => {
      if (!entry.solution.text) return
      content.push(heading(2, heads.solution))
      content.push(para(entry.solution.text, chunksFor(entry.solution.footnote_ids)))
    },
    steps: () => {
      if (!entry.steps.length) return
      content.push(heading(2, heads.steps))
      content.push({
        type: 'orderedList',
        content: entry.steps.map((step) => item(`${step.title} — ${step.text}`)),
      })
    },
    capabilities: () => {
      if (!entry.capabilities.length) return
      content.push(heading(2, heads.capabilities))
      content.push({
        type: 'bulletList',
        content: entry.capabilities.map((cap) =>
          item(
            `${format === 'vision' && cap.status ? `[${STATUS_LABEL[cap.status]}] ` : ''}${cap.title} — ${cap.text}`
          )
        ),
      })
    },
    roadmap: () => {
      // Technical: what is still open. Vision: planned work by horizon. Others: one line.
      if (format === 'technical') {
        const limits = entry.limitations || entry.roadmap
        if (!limits) return
        content.push(heading(2, heads.roadmap), para(limits))
      } else if (format === 'vision' && entry.roadmap_items?.length) {
        content.push(heading(2, heads.roadmap))
        content.push({
          type: 'orderedList',
          content: entry.roadmap_items.map((r) => item(`${r.when} — ${r.text}`)),
        })
      } else if (entry.roadmap) {
        content.push(heading(2, heads.roadmap), para(entry.roadmap))
      }
    },
  }
  for (const role of FORMAT_ORDER[format]) sections[role]()

  if (dropped) notes.push('A citation referenced an unavailable source and was removed.')
  if (droppedImage)
    notes.push('The chosen hero image referenced an unavailable image and was removed.')
  if (entry.doc_type !== 'client_case_study')
    notes.push(
      `The material looks like ${entry.doc_type.replace('_', ' ')} content; no template exists for it yet, so it was written as a case study.`
    )
  return { document: { type: 'doc', content }, sidecar: { format, results, notes } }
}
