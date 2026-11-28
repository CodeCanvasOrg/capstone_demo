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

// -------------------------------------------------------- gap sentences

const GAP = [
  /\b(?:the\s+)?(?:source|sources|document|documents|material|materials|provided\s+(?:text|information)|available\s+(?:information|data|evidence))\b[^.!?]*\b(?:do(?:es)?\s+not|don't|doesn't|did\s+not|cannot|can't|fail(?:s)?\s+to)\s+(?:provide|contain|mention|specify|state|include|say|describe|cover|give|offer|address)\b/i,
  /\b(?:no|not\s+enough|insufficient|limited)\s+(?:information|data|detail|details|evidence)\s+(?:is|are|was|were)?\s*(?:available|provided|given|found|supplied)\b/i,
  /\b(?:is|are|was|were)\s+not\s+(?:specified|stated|mentioned|provided|available|documented)\s+in\s+the\s+(?:source|sources|document|material|text)/i,
  /\binformation\s+(?:on|about|regarding)\b[^.!?]*\bis\s+(?:not\s+available|unavailable|missing)\b/i,
  /\[\s*insert[^\]]*\]/i,
]

export const isGapSentence = (sentence: string) => GAP.some((p) => p.test(sentence))

/**
 * Splits text into sentences without losing their closing punctuation. A full stop inside a
 * number or an abbreviation ("2.4x", "e.g.x") does not end a sentence: only one followed by
 * a space or the end of the text does.
 */
export const sentences = (value: string) =>
  value
    .match(/(?:[^.!?]|[.!?](?!\s|$))+(?:[.!?]+(?=\s|$)|$)/g)
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

// ------------------------------------------------------- word splitting

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

const grams = (s: string, n: number, only = words) => {
  const w = only(s)
  const out = new Set<string>()
  if (w.length < n) return out
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
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
