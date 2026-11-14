import { z } from 'zod'
import { COMMENTARY } from './checks.ts'
import { isFigure } from './figure.ts'

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
  footnoteText: 240,
  footnotes: 12,
  notes: 20,
  note: 300,
  paragraph: 700,
} as const

export const EVIDENCE_KINDS = ['measured', 'estimated', 'client_reported', 'design_target'] as const
export const ENTRY_DOC_TYPES = ['client_case_study', 'product', 'research', 'news'] as const

const ids = z.array(z.number().int().min(1)).max(6).default([])
const paragraph = z.object({
  text: z.string().trim().max(ENTRY_LIMITS.paragraph),
  footnote_ids: ids,
})

export const entrySchema = z.object({
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
      })
    )
    .max(ENTRY_LIMITS.capabilities),
  roadmap: z.string().trim().max(ENTRY_LIMITS.roadmap).optional(),
  footnotes: z
    .array(
      z.object({
        id: z.number().int().min(1),
        text: z.string().trim().min(1).max(ENTRY_LIMITS.footnoteText),
        chunks: z.array(z.string().min(1).max(200)).max(6),
      })
    )
    .max(ENTRY_LIMITS.footnotes),
  reviewer_notes: z.array(z.string().trim().min(1).max(ENTRY_LIMITS.note)).max(ENTRY_LIMITS.notes),
})
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
export function validateEntry(entry: BrandedEntry): EntryProblem[] {
  const found: EntryProblem[] = []
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
  { allowedChunkIds }: { allowedChunkIds: ReadonlySet<string> }
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
  const results: ResultSidecar[] = []
  if (entry.results.length) {
    content.push(heading(2, SECTION_HEADINGS.results))
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
  }
  if (entry.challenge.text) {
    content.push(heading(2, SECTION_HEADINGS.challenge))
    content.push(para(entry.challenge.text, chunksFor(entry.challenge.footnote_ids)))
  }
  if (entry.solution.text) {
    content.push(heading(2, SECTION_HEADINGS.solution))
    content.push(para(entry.solution.text, chunksFor(entry.solution.footnote_ids)))
  }
  if (entry.steps.length) {
    content.push(heading(2, SECTION_HEADINGS.steps))
    content.push({
      type: 'orderedList',
      content: entry.steps.map((step) => item(`${step.title} — ${step.text}`)),
    })
  }
  if (entry.capabilities.length) {
    content.push(heading(2, SECTION_HEADINGS.capabilities))
    content.push({
      type: 'bulletList',
      content: entry.capabilities.map((cap) => item(`${cap.title} — ${cap.text}`)),
    })
  }
  if (entry.roadmap) {
    content.push(heading(2, SECTION_HEADINGS.roadmap))
    content.push(para(entry.roadmap))
  }

  if (dropped) notes.push('A citation referenced an unavailable source and was removed.')
  if (entry.doc_type !== 'client_case_study')
    notes.push(
      `The material looks like ${entry.doc_type.replace('_', ' ')} content; no template exists for it yet, so it was written as a case study.`
    )
  return { document: { type: 'doc', content }, sidecar: { results, notes } }
}
