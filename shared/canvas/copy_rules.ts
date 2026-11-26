/**
 * Rules for the client-facing text the canvas pipeline writes, as pure functions.
 * They know nothing about a design: a slot is a name with a character or line budget, so
 * the same checks serve any template. Browser-safe.
 */

// ----------------------------------------------------------- slot budgets

export type SlotBudget = {
  name: string
  maxChars?: number
  maxLines?: number
  charsPerLine?: number
}
export type LengthTarget = { name: string; minChars: number; targetChars: number; maxChars: number }

/** Characters a slot holds: its own cap, or lines times characters per line, whichever is smaller. */
export function slotChars(slot: SlotBudget): number {
  const byLines = slot.maxLines && slot.charsPerLine ? slot.maxLines * slot.charsPerLine : Infinity
  const cap = Math.min(slot.maxChars ?? Infinity, byLines)
  return Number.isFinite(cap) ? Math.max(Math.floor(cap), 0) : 0
}

/**
 * What to ask the model for so the text fits the first time: aim at `aim` of the budget
 * (default 85%), never below 60% of it, never above 100%.
 */
export function lengthTargets(slots: readonly SlotBudget[], aim = 0.85): LengthTarget[] {
  return slots
    .map((slot) => ({ slot, cap: slotChars(slot) }))
    .filter(({ cap }) => cap > 0)
    .map(({ slot, cap }) => ({
      name: slot.name,
      minChars: Math.floor(cap * 0.6),
      targetChars: Math.floor(cap * Math.min(Math.max(aim, 0.6), 1)),
      maxChars: cap,
    }))
}

/** The targets as prompt lines: "headline: 30 to 45 characters (never more than 52)". */
export function lengthRules(targets: readonly LengthTarget[]): string {
  return targets
    .map(
      (t) =>
        `- ${t.name}: about ${t.targetChars} characters, at least ${t.minChars}, never more than ${t.maxChars}.`
    )
    .join('\n')
}

/** Slots whose text is over budget, for the validator. */
export function overBudget(
  values: Readonly<Record<string, string | null | undefined>>,
  targets: readonly LengthTarget[]
) {
  return targets
    .filter((t) => (values[t.name]?.length ?? 0) > t.maxChars)
    .map((t) => ({ slot: t.name, chars: values[t.name]!.length, max: t.maxChars }))
}

// ---------------------------------------------------- inline citations

/** Chunk ids and citation tags the model writes into prose; footnotes carry them instead. */
const INLINE_CITATION = [
  /\[\s*(?:chunk|source|src)s?\s*[:#]?\s*[\w-]+(?:\s*[,;]\s*[\w-]+)*\s*\]/gi,
  /\(\s*(?:chunk|source|src)s?\s*[:#]?\s*[\w-]+(?:\s*[,;]\s*[\w-]+)*\s*\)/gi,
  /\[\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{4,}[^\]]*\]/gi,
  /\[\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\]/g,
  /[¹²³⁰-⁹]+/g,
]

export function stripInlineCitations(value: string): string {
  let out = value
  for (const pattern of INLINE_CITATION) out = out.replace(pattern, '')
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'
/** 12 -> "¹²": the footnote marker the layout shows for the n-th source. */
export const footnoteMarker = (n: number) =>
  String(Math.max(Math.trunc(n), 0))
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)])
    .join('')

/**
 * Footnote numbers for the chunks a page cites, in first-use order, and the sources list
 * that goes with them. Pass the ids in reading order (repeats are fine).
 */
export function footnotesFor(chunkIds: readonly string[], titleOf: (id: string) => string) {
  const order: string[] = []
  for (const id of chunkIds) if (!order.includes(id)) order.push(id)
  return {
    numbers: new Map(order.map((id, i) => [id, i + 1])),
    sources: order.map((id, i) => ({ n: i + 1, chunkId: id, title: titleOf(id) })),
  }
}

// -------------------------------------------------------- gap sentences

const GAP = [
  /\b(?:the\s+)?(?:source|sources|document|documents|material|materials|provided\s+(?:text|information)|available\s+(?:information|data|evidence))\b[^.!?]*\b(?:do(?:es)?\s+not|don't|doesn't|did\s+not|cannot|can't|fail(?:s)?\s+to)\s+(?:provide|contain|mention|specify|state|include|say|describe|cover|give|offer|address)\b/i,
  /\b(?:no|not\s+enough|insufficient|limited)\s+(?:information|data|detail|details|evidence)\s+(?:is|are|was|were)?\s*(?:available|provided|given|found|supplied)\b/i,
  /\b(?:is|are|was|were)\s+not\s+(?:specified|stated|mentioned|provided|available|documented)\s+in\s+the\s+(?:source|sources|document|material|text)/i,
  /\binformation\s+(?:on|about|regarding)\b[^.!?]*\bis\s+(?:not\s+available|unavailable|missing)\b/i,
  /\[\s*insert[^\]]*\]/i,
]

export const isGapSentence = (sentence: string) => GAP.some((p) => p.test(sentence))

/** Splits text into sentences without losing their closing punctuation. */
export const sentences = (value: string) =>
  value
    .match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? []

/**
 * Removes sentences that talk about what the sources lack. They are not client copy;
 * the caller sends `gaps` to reviewer_notes.
 */
export function stripGapSentences(value: string): { text: string; gaps: string[] } {
  const keep: string[] = []
  const gaps: string[] = []
  for (const sentence of sentences(value)) (isGapSentence(sentence) ? gaps : keep).push(sentence)
  return { text: keep.join(' ').trim(), gaps }
}

// ------------------------------------------------------- empty fields

const isEmpty = (v: unknown) =>
  v === null ||
  v === undefined ||
  (typeof v === 'string' &&
    (!v.trim() || /^(n\/a|none|tbd|null|undefined|-|—)$/i.test(v.trim()))) ||
  (Array.isArray(v) && !v.length)

/** Drops fields that carry no content, so a missing fact leaves no explanation behind. */
export function dropEmpty<T>(value: T): T {
  if (Array.isArray(value))
    return value
      .map(dropEmpty)
      .filter((v) => !isEmpty(v) && !(isRecord(v) && !Object.keys(v).length)) as T
  if (isRecord(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const next = dropEmpty(item)
      if (!isEmpty(next) && !(isRecord(next) && !Object.keys(next).length)) out[key] = next
    }
    return out as T
  }
  return value
}
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Applies `fn` to every string in a structure, except keys listed in `skip` (ids, enums).
 * Returns a copy.
 */
export function mapStrings<T>(
  value: T,
  fn: (s: string, key: string) => string,
  skip: readonly string[] = [],
  key = ''
): T {
  if (typeof value === 'string') return fn(value, key) as T
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn, skip, key)) as T
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, skip.includes(k) ? v : mapStrings(v, fn, skip, k)])
    ) as T
  return value
}

// ----------------------------------------------------------- brand name

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Rewrites spelling variants of the brand ("Code Canvas", "codecanvas") to the one name. */
export function enforceBrandName(value: string, brand: string): string {
  const key = squash(brand)
  if (!key) return value
  const pattern = new RegExp(
    `\\b${[...key].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-_.]?')}\\b`,
    'gi'
  )
  return value.replace(pattern, (m) => (squash(m) === key ? brand : m))
}

/** Distinct spellings of the brand found in the text that differ from `brand`. */
export function brandVariants(value: string, brand: string): string[] {
  const out = new Set<string>()
  const fixed = enforceBrandName(value, brand)
  if (fixed === value) return []
  const pattern = new RegExp(`\\b${[...squash(brand)].join('[\\s\\-_.]?')}\\b`, 'gi')
  for (const m of value.matchAll(pattern)) if (m[0] !== brand) out.add(m[0])
  return [...out]
}

// ------------------------------------------------------- repeated titles

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

const STOP = new Set(
  'a an and are as at be but by for from how in into is it its of on or our that the their this to we what when where which who why with you your'.split(
    ' '
  )
)
/** Words that carry meaning: a repeated "of the" is not a repeated title. */
const content = (s: string) => words(s).filter((w) => !STOP.has(w))

const grams = (s: string, n: number, only = words) => {
  const w = only(s)
  const out = new Set<string>()
  if (w.length < n) return out
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

/** Longest run of words two titles share, as a share of the shorter title. */
export function titleOverlap(a: string, b: string, n = 3): number {
  const wa = content(a)
  const wb = content(b)
  if (!wa.length || !wb.length) return 0
  const size = Math.min(n, wa.length, wb.length)
  const x = grams(a, size, content)
  const y = grams(b, size, content)
  let shared = 0
  for (const g of x) if (y.has(g)) shared++
  return shared / Math.min(x.size, y.size)
}

export type TitleRepeat = { a: number; b: number; titles: [string, string] }

/**
 * Titles (headlines, page titles, section headings) that repeat each other: identical, or
 * sharing a run of `n` meaningful words. Returns index pairs so the caller can ask for a rewrite.
 */
export function titleRepeats(titles: readonly string[], n = 3): TitleRepeat[] {
  const found: TitleRepeat[] = []
  for (let i = 0; i < titles.length; i++)
    for (let j = i + 1; j < titles.length; j++) {
      const a = titles[i]
      const b = titles[j]
      if (!a?.trim() || !b?.trim()) continue
      if (words(a).join(' ') === words(b).join(' ') || titleOverlap(a, b, n) > 0)
        found.push({ a: i, b: j, titles: [a, b] })
    }
  return found
}

// ------------------------------------------------------- stats and evidence

export const EVIDENCE_KINDS = ['measured', 'estimated', 'client_reported', 'design_target'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

/** Words models use for the kinds, mapped to the stored value. */
const KIND_ALIASES: Record<string, EvidenceKind> = {
  'measured': 'measured',
  'measurement': 'measured',
  'actual': 'measured',
  'estimate': 'estimated',
  'estimated': 'estimated',
  'projected': 'estimated',
  'reported': 'client_reported',
  'client_reported': 'client_reported',
  'design target': 'design_target',
  'design_target': 'design_target',
  'target': 'design_target',
  'goal': 'design_target',
}
export const evidenceKind = (value: string | null | undefined): EvidenceKind =>
  KIND_ALIASES[(value ?? '').toLowerCase().trim()] ?? 'measured'

export type Stat = { value: string; label: string; kind: EvidenceKind }

const NUMBER =
  /(?:[~≈<>]\s?)?[$€£]?\d[\d.,]*\s?(?:%|x|×|ms|s|k|m|bn|million|billion|thousand|days?|weeks?|months?|years?|hours?|minutes?)?/giu

/** Numbers in running prose that deserve a stat field: the value and the words before it. */
export function numbersInProse(text: string): { value: string; context: string }[] {
  const out: { value: string; context: string }[] = []
  for (const sentence of sentences(text))
    for (const m of sentence.matchAll(NUMBER)) {
      const value = m[0].trim().replace(/[.,]+$/, '')
      if (!/\d/.test(value) || /^\d{4}$/.test(value)) continue
      if (!/[%x×$€£]|[a-z]/i.test(value) && value.replace(/\D/g, '').length < 2) continue
      out.push({ value, context: sentence })
    }
  return out
}

/** Whether prose still carries a number that is not in any stat: the model should have moved it. */
export function unmovedNumbers(text: string, stats: readonly Pick<Stat, 'value'>[]): string[] {
  const have = new Set(stats.map((s) => s.value.replace(/\s/g, '')))
  return numbersInProse(text)
    .map((n) => n.value)
    .filter((v) => /%|[x×$€£]|\d{2,}/.test(v) && !have.has(v.replace(/\s/g, '')))
}

// ------------------------------------------------------ chunk dedupe

const normalize = (s: string) => words(s).join(' ')

/** Share of the smaller chunk's word 5-grams found in the other: 1 means one contains the other. */
export function chunkOverlap(a: string, b: string): number {
  const x = grams(a, 5)
  const y = grams(b, 5)
  if (!x.size || !y.size) return normalize(a) === normalize(b) && normalize(a) ? 1 : 0
  let shared = 0
  for (const g of x) if (y.has(g)) shared++
  return shared / Math.min(x.size, y.size)
}

export type ChunkLike = { id: string; content: string }

/**
 * Keeps chunks that add something: drops a chunk already used on an earlier page, and one
 * that repeats (above `threshold`) a chunk kept before it. Order is preserved. Ids are
 * untouched so footnotes still point at the chunk the text came from.
 */
export function dedupeChunks<T extends ChunkLike>(
  chunks: readonly T[],
  used: ReadonlySet<string> = new Set(),
  threshold = 0.8
): T[] {
  const kept: T[] = []
  for (const chunk of chunks) {
    if (used.has(chunk.id) || kept.some((k) => k.id === chunk.id)) continue
    if (kept.some((k) => chunkOverlap(k.content, chunk.content) >= threshold)) continue
    kept.push(chunk)
  }
  return kept
}
