import {
  enforceBrandName,
  sentences,
  stripGapSentences,
  stripInlineCitations,
} from '../copy_rules.ts'
import {
  fitsFrame,
  measureText,
  innerSize,
  measureSpec,
  paragraphs,
  type ResolvedText,
} from './style.ts'

/**
 * The writing conventions of the portfolio applied to a free text frame: citation tags, gap sentences
 * and brand spellings are removed; numbers and citations are checked against the chunks; text that
 * does not fit its frame is cut at a sentence or word. Browser-safe.
 */

/** A client-facing string, cleaned. `gaps` are the sentences that said the sources were silent. */
export function cleanFrameText(value: string, brand?: string) {
  // Paragraph breaks survive: each line is cleaned on its own.
  const gaps: string[] = []
  const text = value
    .split(/\n+/)
    .map((line) => {
      const stripped = stripGapSentences(stripInlineCitations(line))
      gaps.push(...stripped.gaps)
      return (brand ? enforceBrandName(stripped.text, brand) : stripped.text).trim()
    })
    .filter(Boolean)
    .join('\n')
  return { text, gaps }
}

const digits = (value: string) =>
  (value.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]+$/, '').replaceAll(',', ''))

export type FrameProblem = {
  code: 'uncited' | 'unsupported_number'
  id: string
  detail?: string
}

/** Facts without a source, and numbers the cited chunks do not contain. */
export function frameProblems(
  frame: { id: string; text: string; chunks: readonly string[]; cite: boolean },
  evidence: ReadonlyMap<string, string>
): FrameProblem[] {
  if (!frame.cite || !frame.text.trim() || !evidence.size) return []
  if (!frame.chunks.length) return [{ code: 'uncited', id: frame.id }]
  const have = new Set(digits(frame.chunks.map((id) => evidence.get(id) ?? '').join('\n')))
  const missing = digits(frame.text).filter((n) => !have.has(n))
  return missing.length
    ? [{ code: 'unsupported_number', id: frame.id, detail: missing.join(', ') }]
    : []
}

/** Lines a frame can hold at most: its inner height over the line height. */
export function frameLines(geo: { w: number; h: number }, r: ResolvedText) {
  const { spec } = measureSpec(r)
  return Math.max(Math.floor((innerSize(geo, r).h + 0.5) / spec.line), 1)
}

/**
 * `text` cut to fit its frame: whole sentences from the end first, then words of the last sentence,
 * never mid-word. Returns the text and whether anything was cut.
 */
export function trimToFrame(
  text: string,
  geo: { w: number; h: number },
  r: ResolvedText
): { text: string; cut: boolean } {
  if (fitsFrame(text, geo, r)) return { text, cut: false }
  const parts = paragraphs(text).map((p) => sentences(p))
  const build = () =>
    parts
      .filter((p) => p.length)
      .map((p) => p.join(' '))
      .join('\n')
  while (parts.length) {
    const last = parts.at(-1)!
    if (!last.length) {
      parts.pop()
      continue
    }
    if (parts.length === 1 && last.length === 1) break
    last.pop()
    if (fitsFrame(build(), geo, r)) return { text: build(), cut: true }
  }
  const words = (parts[0]?.[0] ?? text).split(/\s+/)
  for (let k = words.length - 1; k >= 1; k--) {
    const candidate = `${words
      .slice(0, k)
      .join(' ')
      .replace(/[\s,;:–—-]+$/, '')}.`
    if (fitsFrame(candidate, geo, r)) return { text: candidate, cut: true }
  }
  return { text: words[0] ?? '', cut: true }
}

export { measureText }
