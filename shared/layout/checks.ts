import {
  ClientContentError,
  parseClientRenderData,
  type ClientBlock,
  type ClientRenderData,
  type ClientResult,
} from '../publication/client.ts'
import { checkBrandSpelling, type BrandKit } from './brand.ts'
import { validateFootnotes } from './footnotes.ts'

/**
 * Deterministic publication checks (OUT-05). These find structure and hygiene
 * problems; they never claim that a citation proves support. Each finding
 * names an exact field so repair can target it instead of rewriting a section.
 */
export const MAX_REPAIR_ATTEMPTS = 2

export type ContentFinding = {
  code: string
  severity: 'error' | 'warning'
  field: string
  message: string
  range?: { from: number; to: number }
}

type Inline = { type: string; text?: string; content?: Inline[] }

/** Visits every text-bearing field with its exact path. */
function eachText(data: ClientRenderData, visit: (text: string, field: string) => void) {
  const inline = (nodes: Inline[] | undefined, field: string) =>
    nodes?.forEach((node, i) => {
      if (node.type === 'text' && node.text) visit(node.text, `${field}[${i}].text`)
    })
  const block = (node: ClientBlock, field: string) => {
    switch (node.type) {
      case 'paragraph':
      case 'heading':
      case 'codeBlock':
        return inline(node.content as Inline[], `${field}.content`)
      case 'blockquote':
        return node.content.forEach((child, i) => block(child, `${field}.content[${i}]`))
      case 'bulletList':
      case 'orderedList':
        return node.content.forEach((item, i) =>
          item.content.forEach((child, c) => block(child, `${field}.content[${i}].content[${c}]`))
        )
    }
  }
  if (data.title) visit(data.title, 'title')
  if (data.summary) block(data.summary, 'summary')
  data.body.forEach((node, i) => block(node, `body[${i}]`))
}

/** Paragraph-level text with whether the paragraph carries a citation. */
function eachParagraph(
  data: ClientRenderData,
  visit: (text: string, cited: boolean, field: string) => void
) {
  const paragraph = (node: ClientBlock, field: string) => {
    if (node.type !== 'paragraph' || !node.content) return
    visit(
      node.content.map((part) => (part.type === 'text' ? part.text : '')).join(''),
      node.content.some((part) => part.type === 'reference'),
      field
    )
  }
  const walk = (node: ClientBlock, field: string) => {
    if (node.type === 'paragraph') return paragraph(node, field)
    if (node.type === 'blockquote')
      node.content.forEach((c, i) => walk(c, `${field}.content[${i}]`))
    if (node.type === 'bulletList' || node.type === 'orderedList')
      node.content.forEach((item, i) =>
        item.content.forEach((c, k) => walk(c, `${field}.content[${i}].content[${k}]`))
      )
  }
  data.body.forEach((node, i) => walk(node, `body[${i}]`))
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
const plainText = (nodes: unknown): string =>
  ((nodes as Inline[] | undefined) ?? []).map((n) => n.text ?? plainText(n.content)).join('')

// Narrow phrases that read like retrieval commentary. The word "source" alone is fine.
export const COMMENTARY =
  /\b(?:the\s+(?:source|sources|documents?|provided\s+materials?|supplied\s+materials?|case\s+study|input|brief)\s+(?:does|do|did)\s+not\b|the\s+source\s+(?:states|says|mentions|notes|indicates|describes|reports|provides)\b|(?:not|n't)\s+(?:specified|mentioned|stated|provided)\s+in\s+the\s+(?:source|sources|documents?|case\s+study|input)\b|according\s+to\s+the\s+(?:source|provided)\b)/i
const NUMBER_CLAIM = /\d+(?:[.,]\d+)?\s*(?:%|percent\b|×)|[$€£]\s?\d/i

export function checkContent(
  data: ClientRenderData,
  { brand }: { brand: BrandKit }
): ContentFinding[] {
  const found: ContentFinding[] = []
  const add = (finding: ContentFinding) => void found.push(finding)

  try {
    parseClientRenderData(data)
  } catch (error) {
    if (!(error instanceof ClientContentError)) throw error
    // Field paths and codes only: never echo the offending value.
    for (const issue of error.issues)
      add({
        code: 'schema_invalid',
        severity: 'error',
        field: issue.field,
        message: `This field is not valid (${issue.code}).`,
      })
    return found
  }

  for (const finding of validateFootnotes(data))
    add({
      code:
        finding.code === 'dangling_reference'
          ? 'citation_missing_source'
          : finding.code === 'uncited_source'
            ? 'citation_uncited_source'
            : 'citation_duplicate_number',
      severity: finding.code === 'uncited_source' ? 'warning' : 'error',
      field: `sources[${finding.number}]`,
      message:
        finding.code === 'dangling_reference'
          ? `Reference ${finding.number} has no matching source.`
          : finding.code === 'uncited_source'
            ? `Source ${finding.number} is never cited.`
            : `Source number ${finding.number} is used twice.`,
    })

  if (data.title) {
    const title = normalize(data.title)
    const first = data.body[0]
    if (first?.type === 'heading' && normalize(plainText(first.content)) === title)
      add({
        code: 'title_repeated',
        severity: 'warning',
        field: 'body[0]',
        message: 'The first heading repeats the title.',
      })
    if (data.summary && normalize(plainText(data.summary.content)) === title)
      add({
        code: 'title_repeated',
        severity: 'warning',
        field: 'summary',
        message: 'The summary repeats the title.',
      })
  }

  eachText(data, (text, field) => {
    for (const spelling of checkBrandSpelling(text, brand))
      add({
        code: 'brand_spelling',
        severity: 'warning',
        field,
        range: { from: spelling.from, to: spelling.to },
        message: `Write "${spelling.canonical}" instead of "${spelling.found}".`,
      })
  })

  const declared = (data.results ?? []).map((result) => result.value)
  eachParagraph(data, (text, cited, field) => {
    const match = COMMENTARY.exec(text)
    if (match)
      add({
        code: 'pipeline_commentary',
        severity: 'warning',
        field,
        range: { from: match.index, to: match.index + match[0].length },
        message: 'Reads like retrieval commentary rather than publication copy.',
      })
    const number = NUMBER_CLAIM.exec(text)
    if (number && !cited && !declared.some((value) => text.includes(value)))
      add({
        code: 'unsupported_number',
        severity: 'warning',
        field,
        range: { from: number.index, to: number.index + number[0].length },
        message: 'A number appears with no citation and no declared result.',
      })
  })
  return found
}

const CONTEXT_KEYS = ['units', 'scope', 'baseline', 'period', 'methodology'] as const

/**
 * After any rewrite, every original result must keep its value, qualifier,
 * comparison ("up to") and author-supplied context. Nothing is auto-merged.
 */
export function checkQualifierPreservation(before: ClientResult[], after: ClientResult[]) {
  const found: ContentFinding[] = []
  before.forEach((result, index) => {
    const field = `results[${index}]`
    const next = after.find((candidate) => candidate.value === result.value)
    if (!next)
      return void found.push({
        code: 'result_removed',
        severity: 'error',
        field,
        message: 'A result was removed or its value changed.',
      })
    if (next.qualifier !== result.qualifier || next.comparison !== result.comparison)
      return void found.push({
        code: 'qualifier_changed',
        severity: 'error',
        field,
        message: 'The evidence label or "up to"/"at least" qualifier changed.',
      })
    if (CONTEXT_KEYS.some((key) => result[key] && !next[key]))
      found.push({
        code: 'context_dropped',
        severity: 'error',
        field,
        message: 'Units, scope, baseline, period or method were dropped.',
      })
  })
  return found
}

/** Only these are fixed by rewriting; unsupported numbers need evidence, not copy edits. */
const REPAIRABLE = new Set(['brand_spelling', 'title_repeated', 'pipeline_commentary'])

export type RepairHistory = {
  attempt: number
  accepted: boolean
  reason?: string
  fields: string[]
}
export type RepairResult = {
  original: ClientRenderData
  final: ClientRenderData
  resolved: boolean
  history: RepairHistory[]
  unresolved: ContentFinding[]
  error?: { code: 'repair_failed'; message: string }
}

/**
 * At most two targeted attempts. Each candidate is revalidated, and one that
 * damages a result qualifier is rejected. The original is always returned
 * alongside the final content, so the earlier revision is never lost.
 */
export async function repairContent(
  original: ClientRenderData,
  {
    brand,
    generate,
    maxAttempts = MAX_REPAIR_ATTEMPTS,
  }: {
    brand: BrandKit
    generate: (data: ClientRenderData, failing: ContentFinding[]) => Promise<ClientRenderData>
    maxAttempts?: number
  }
): Promise<RepairResult> {
  let current = original
  const history: RepairHistory[] = []
  const rejected: ContentFinding[] = []
  const failing = (data: ClientRenderData) =>
    checkContent(data, { brand }).filter((finding) => REPAIRABLE.has(finding.code))

  let targets = failing(current)
  const limit = Math.min(maxAttempts, MAX_REPAIR_ATTEMPTS)
  for (let attempt = 1; targets.length && attempt <= limit; attempt++) {
    const fields = targets.map((finding) => finding.field)
    let candidate: ClientRenderData
    try {
      candidate = await generate(current, targets)
    } catch {
      const unresolved = [...checkContent(current, { brand }), ...rejected]
      return {
        original,
        final: current,
        resolved: false,
        history,
        unresolved,
        error: {
          code: 'repair_failed',
          message: 'The repair request failed; no content was changed.',
        },
      }
    }
    const problems = [
      ...checkContent(candidate, { brand }).filter((finding) => finding.code === 'schema_invalid'),
      ...checkQualifierPreservation(original.results ?? [], candidate.results ?? []),
    ]
    if (problems.length) {
      rejected.push(...problems)
      history.push({ attempt, accepted: false, reason: problems[0].code, fields })
    } else {
      current = candidate
      history.push({ attempt, accepted: true, fields })
      targets = failing(current)
    }
  }
  const remaining = checkContent(current, { brand })
  const resolved = !failing(current).length
  return {
    original,
    final: current,
    resolved,
    history,
    unresolved: resolved ? [] : [...remaining, ...rejected],
  }
}
