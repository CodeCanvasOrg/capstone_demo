import { z } from 'zod'
import { EVIDENCE_KINDS, evidenceKind } from '../copy_rules.ts'
import { charsPerLine, lineCount, trimToLines, hasOverlongWord } from './measure.ts'
import { COVER, ENTRY, HEADER, rowLines, type TYPE } from './tokens.ts'
import type { SlotBudget } from '../copy_rules.ts'

/**
 * What the portfolio pipeline's model calls return, and how it is checked against the
 * template's slot budgets. The model writes structured content, never canvas JSON;
 * `compose.ts` lays it out. Browser-safe.
 */
/** Keys whose value may be undefined become optional, so hand-written content need not list them. */
type Loose<T> = { [K in keyof T as undefined extends T[K] ? K : never]?: T[K] } & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K]
}

const text = (max: number) => z.string().trim().min(1).max(max)
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || undefined)
const ids = z.array(z.string().min(1).max(200)).max(6).default([])

// ----------------------------------------------------------------------- plan

export const planEntrySchema = z.object({
  /** One line of the entry page's heading. */
  title: text(60),
  /** The tag beside the section number: "Service design". */
  category: text(40),
  purpose: text(300),
  questions: z.array(text(200)).min(2).max(5),
  keyTerms: z.array(text(60)).max(6).default([]),
  wantsImages: z.boolean().default(false),
})
export type PlanEntry = Loose<z.infer<typeof planEntrySchema>>

export const portfolioPlanSchema = z.object({
  /** The cover's title: three composed lines. */
  title: text(80),
  eyebrow: optional(40),
  thesis: text(400),
  audience: text(200),
  entries: z.array(planEntrySchema).min(1).max(8),
  coverageGaps: z.array(text(300)).max(10).default([]),
})
export type PortfolioPlan = Loose<z.infer<typeof portfolioPlanSchema>>

// ---------------------------------------------------------------------- entry

export const rowSchema = z.object({
  label: text(40),
  /** Empty means the row has nothing to say: it is dropped. */
  body: z.string().trim().max(500).default(''),
  /** An explicit limit or constraint, shown first and in red. */
  constraint: optional(240),
  /** Chunks that support the row; they become footnote superscripts. */
  chunks: ids,
})
export type EntryRow = Loose<z.infer<typeof rowSchema>>

export const claimSchema = z.object({
  claim: text(60),
  /** The row (1 based) the claim comes from; its sources are the claim's. */
  row: z.number().int().min(1).max(8),
  // Models say "target" or "reported"; the stored kind is one of the four.
  kind: z
    .preprocess((v) => (typeof v === 'string' ? evidenceKind(v) : v), z.enum(EVIDENCE_KINDS))
    .default('measured'),
  /** Wording for the evidence type when the kind's own label is not right. */
  label: optional(32),
})
export type EntryClaim = Loose<z.infer<typeof claimSchema>>

export const entryPageSchema = z.object({
  title: text(60),
  category: text(40),
  intro: text(500),
  rows: z.array(rowSchema).min(1).max(ENTRY.maxRows),
  claims: z.array(claimSchema).max(3).default([]),
  sourceNotes: z
    .array(z.object({ chunk: text(200), note: text(160) }))
    .max(12)
    .default([]),
  /** Replaces the reading note on the sources page. */
  evidenceNote: optional(300),
  /** Printed under the heading of the sources page, in place of the standard sentence. */
  sourcesIntro: optional(500),
  /** One line for the entries written after this one; never part of the layout. */
  summary: text(300),
  reviewer_notes: z.array(text(300)).max(8).default([]),
})
export type EntryPage = Omit<Loose<z.infer<typeof entryPageSchema>>, 'rows' | 'claims'> & {
  rows: EntryRow[]
  claims: EntryClaim[]
}

export const coverPageSchema = z.object({
  eyebrow: optional(40),
  title: text(80),
  subtitle: text(400),
  reviewer_notes: z.array(text(300)).max(8).default([]),
})
export type CoverPage = Loose<z.infer<typeof coverPageSchema>>

export type CoverMeta = { label: string; value: string; secondary?: string }

// -------------------------------------------------------------------- budgets

const SUP_CHARS_PER_SOURCE = 1

/** Text of a row as it prints: the constraint, then the body. */
export const rowText = (row: Pick<EntryRow, 'body' | 'constraint'>) =>
  [row.constraint, row.body].filter(Boolean).join(' ')

/** Rows that will print: those with something to say. */
export const printedRows = (rows: readonly EntryRow[]) =>
  rows.filter((row) => row.label.trim() && rowText(row).trim())

export type BudgetIssue = { field: string; lines: number; max: number }

/** Lines `row` takes, with room kept for its footnote marks. */
export function rowBodyLines(row: EntryRow, count: number, index: number) {
  void index
  void count
  const marks = new Set(row.chunks).size * SUP_CHARS_PER_SOURCE
  return lineCount(rowText(row) + '0'.repeat(marks), ENTRY.rowsW, 'rowBody')
}

/** Every field of an entry page that is over its slot's line budget. */
export function entryOverBudget(page: EntryPage): BudgetIssue[] {
  const issues: BudgetIssue[] = []
  const add = (field: string, lines: number, max: number) => {
    if (lines > max) issues.push({ field, lines, max })
  }
  add('title', lineCount(page.title, HEADER.title.w, 'heading'), 1)
  add('category', lineCount(page.category, 200, 'tagLabel'), 1)
  add('intro', lineCount(page.intro, HEADER.intro.w, 'intro'), HEADER.intro.lines)
  const rows = printedRows(page.rows)
  const budgets = rowLines(rows.length)
  rows.forEach((row, i) => {
    add(`rows[${i}].label`, lineCount(row.label, ENTRY.rowsW, 'rowLabel'), 1)
    add(`rows[${i}].body`, rowBodyLines(row, rows.length, i), budgets[i])
    if (hasOverlongWord(rowText(row), ENTRY.rowsW, 'rowBody'))
      issues.push({ field: `rows[${i}].body`, lines: 99, max: budgets[i] })
  })
  return issues
}

/** The cover's fields over their budgets. */
export function coverOverBudget(cover: {
  eyebrow?: string
  title: string
  subtitle: string
  meta?: CoverMeta[]
}): BudgetIssue[] {
  const issues: BudgetIssue[] = []
  const add = (field: string, lines: number, max: number) => {
    if (lines > max) issues.push({ field, lines, max })
  }
  if (cover.eyebrow) add('eyebrow', lineCount(cover.eyebrow, COVER.eyebrow.w, 'eyebrow'), 1)
  const titleLines = cover.title.includes('\n')
    ? cover.title.split('\n').length
    : lineCount(cover.title, COVER.title.w, 'coverTitle')
  add('title', titleLines, COVER.title.lines)
  add(
    'subtitle',
    lineCount(cover.subtitle, COVER.subtitle.w, 'coverSubtitle'),
    COVER.subtitle.lines
  )
  cover.meta?.forEach((m, i) => {
    add(`meta[${i}].label`, lineCount(m.label, COVER.meta.w, 'metaLabel'), 1)
    add(`meta[${i}].value`, lineCount(m.value, COVER.meta.w, 'metaValue'), 2)
    if (m.secondary)
      add(`meta[${i}].secondary`, lineCount(m.secondary, COVER.meta.w, 'metaSecondary'), 2)
  })
  return issues
}

/** The entry page's slots as budgets for the prompt's "length per slot" lines. */
export function entrySlotBudgets(rowCount: number): SlotBudget[] {
  const n = Math.min(Math.max(rowCount, ENTRY.minRows), ENTRY.maxRows)
  return [
    { name: 'title', maxLines: 1, charsPerLine: charsPerLine(HEADER.title.w, 'heading') },
    { name: 'category', maxLines: 1, charsPerLine: 25 },
    {
      name: 'intro',
      maxLines: HEADER.intro.lines,
      charsPerLine: charsPerLine(HEADER.intro.w, 'intro'),
    },
    { name: 'rows[].label', maxLines: 1, charsPerLine: charsPerLine(ENTRY.rowsW, 'rowLabel') },
    ...rowLines(n).map((lines, i) => ({
      name: `rows[${i}].body (constraint included)`,
      maxLines: lines,
      // Footnote marks take a little room at the end of the last line.
      charsPerLine: charsPerLine(ENTRY.rowsW, 'rowBody') - 2,
    })),
    { name: 'sourceNotes[].note', maxChars: 90 },
    { name: 'claims[].claim', maxChars: 34 },
  ]
}

export function coverSlotBudgets(): SlotBudget[] {
  return [
    { name: 'eyebrow', maxChars: 30 },
    { name: 'title', maxLines: COVER.title.lines, charsPerLine: 20 },
    {
      name: 'subtitle',
      maxLines: COVER.subtitle.lines,
      charsPerLine: charsPerLine(COVER.subtitle.w, 'coverSubtitle'),
    },
  ]
}

/**
 * An entry page made to fit its budgets without the model: over-long text is cut at a sentence
 * or word, and rows with nothing to say are removed. Returns what was cut, for reviewer notes.
 */
export function fitEntry(page: EntryPage): { page: EntryPage; notes: string[] } {
  const notes: string[] = []
  const next: EntryPage = structuredClone(page)
  const cut = (
    field: string,
    value: string,
    width: number,
    role: keyof typeof TYPE,
    max: number
  ) => {
    const out = trimToLines(value, width, role, max)
    if (out.cut) notes.push(`${field} was shortened to fit its space.`)
    return out.text
  }
  next.title = cut('Title', next.title, HEADER.title.w, 'heading', 1)
  next.category = cut('Category', next.category, 200, 'tagLabel', 1)
  next.intro = cut('Intro', next.intro, HEADER.intro.w, 'intro', HEADER.intro.lines)
  next.rows = printedRows(next.rows).slice(0, ENTRY.maxRows)
  const budgets = rowLines(next.rows.length)
  next.rows = next.rows.map((row, i) => {
    const marks = '0'.repeat(new Set(row.chunks).size * SUP_CHARS_PLACEHOLDER)
    const label = cut(`Row ${i + 1} label`, row.label, ENTRY.rowsW, 'rowLabel', 1)
    // The constraint is kept whole when it fits alone; the body gives way first.
    const limit = budgets[i]
    const constraint = row.constraint
      ? cut(`Row ${i + 1} constraint`, row.constraint, ENTRY.rowsW, 'rowBody', limit)
      : undefined
    let body = row.body
    if (rowBodyLines({ ...row, label, constraint, body }, next.rows.length, i) > limit) {
      const joined = trimToLines(
        [constraint, body].filter(Boolean).join(' ') + marks,
        ENTRY.rowsW,
        'rowBody',
        limit
      )
      body = constraint
        ? joined.text.slice(constraint.length).trim().replace(/0+$/, '')
        : joined.text.replace(/0+$/, '')
      notes.push(`Row ${i + 1} was shortened to fit its space.`)
    }
    return { ...row, label, constraint, body }
  })
  next.rows = next.rows.filter((r) => rowText(r).trim())
  if (next.rows.length < ENTRY.minRows)
    notes.push(`Only ${next.rows.length} rows had content; the template shows three to eight.`)
  next.claims = next.claims.filter(
    (c) => c.row <= next.rows.length && next.rows[c.row - 1]?.chunks.length
  )
  return { page: next, notes }
}
const SUP_CHARS_PLACEHOLDER = SUP_CHARS_PER_SOURCE

/** Cover fields cut to their budgets. */
export function fitCover<T extends { eyebrow?: string; title: string; subtitle: string }>(
  cover: T
) {
  const notes: string[] = []
  const out = { ...cover }
  const cut = (
    field: string,
    value: string,
    width: number,
    role: keyof typeof TYPE,
    max: number
  ) => {
    const r = trimToLines(value, width, role, max)
    if (r.cut) notes.push(`The cover ${field} was shortened to fit its space.`)
    return r.text
  }
  if (out.eyebrow) out.eyebrow = cut('eyebrow', out.eyebrow, COVER.eyebrow.w, 'eyebrow', 1)
  out.title = cut('title', out.title, COVER.title.w, 'coverTitle', COVER.title.lines)
  out.subtitle = cut(
    'subtitle',
    out.subtitle,
    COVER.subtitle.w,
    'coverSubtitle',
    COVER.subtitle.lines
  )
  return { cover: out, notes }
}

/** Chunk ids an entry cites, in reading order without repeats. */
export function citedChunks(page: Pick<EntryPage, 'rows'>): string[] {
  const out: string[] = []
  for (const row of page.rows) for (const id of row.chunks) if (!out.includes(id)) out.push(id)
  return out
}

/** Drops chunk ids the application never supplied: the model may choose among ids, never create one. */
export function sanitizeEntry(page: EntryPage, allowed: ReadonlySet<string>) {
  let dropped = false
  const keep = (chunks: string[]) =>
    chunks.filter((id) => allowed.has(id) || ((dropped = true), false))
  const next: EntryPage = {
    ...page,
    rows: page.rows.map((r) => ({ ...r, chunks: keep(r.chunks) })),
    sourceNotes: page.sourceNotes.filter((n) => allowed.has(n.chunk)),
  }
  return { page: next, dropped }
}

export type EntryProblem = {
  code: 'uncited' | 'too_few_rows' | 'unsupported_number'
  field: string
  detail?: string
}

const digits = (value: string) =>
  (value.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]+$/, '').replaceAll(',', ''))

/**
 * What the model must fix on a retry: rows with facts and no source (when there are sources), too few
 * rows, and numbers in a row that its cited chunks do not contain.
 */
export function validateEntry(
  page: EntryPage,
  evidence: ReadonlyMap<string, string>
): EntryProblem[] {
  const found: EntryProblem[] = []
  const rows = printedRows(page.rows)
  if (rows.length < ENTRY.minRows)
    found.push({ code: 'too_few_rows', field: 'rows', detail: `need at least ${ENTRY.minRows}` })
  if (!evidence.size) return found
  rows.forEach((row, i) => {
    if (!row.chunks.length) return void found.push({ code: 'uncited', field: `rows[${i}]` })
    const have = new Set(digits(row.chunks.map((id) => evidence.get(id) ?? '').join('\n')))
    const missing = digits(rowText(row)).filter((n) => !have.has(n))
    if (missing.length)
      found.push({ code: 'unsupported_number', field: `rows[${i}]`, detail: missing.join(', ') })
  })
  return found
}

/** How full an entry's rows are: lines used over lines budgeted, 0 to 1 (a row cannot use more than its budget once fitted). */
export function entryFill(page: Pick<EntryPage, 'rows'>): number {
  const rows = printedRows(page.rows)
  if (!rows.length) return 0
  const budgets = rowLines(rows.length)
  const used = rows.reduce(
    (n, row, i) => n + Math.min(rowBodyLines(row, rows.length, i), budgets[i]),
    0
  )
  const room = budgets.reduce((a, b) => a + b, 0)
  return Number((used / room).toFixed(3))
}
