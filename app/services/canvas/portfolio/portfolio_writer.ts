import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import {
  enforceBrandName,
  stripGapSentences,
  stripInlineCitations,
} from '../../../../shared/canvas/copy_rules.ts'
import {
  coverOverBudget,
  entryOverBudget,
  fitCover,
  fitEntry,
  printedRows,
  sanitizeEntry,
  validateEntry,
  type CoverPage,
  type EntryPage,
  type PlanEntry,
} from '../../../../shared/canvas/portfolio/content.ts'
import type { CanvasOptions } from '../../../../shared/canvas/academic/options.ts'
import { ENTRY } from '../../../../shared/canvas/portfolio/tokens.ts'
import { sourcesText } from '../generation/canvas_planner.ts'
import {
  condenseCorrective,
  coverSystem,
  entrySystem,
  expandCorrective,
  problemCorrective,
  ROWS_BY_DEPTH,
} from './portfolio_prompts.ts'

/** Model rounds an entry may spend repairing structure and citations before the fixes below apply. */
const ROUNDS = 2

export type WriteContext = {
  title: string
  thesis: string
  audience: string
  /** Every planned entry, titles and purposes only, so entries do not repeat each other. */
  outline: { title: string; purpose: string }[]
  options: CanvasOptions
  /** The brand's name as it must be written everywhere; other spellings are corrected. */
  brand?: string
  guard: () => Promise<void>
}

export type Earlier = { entry: number; title: string; summary: string }

export type Written = {
  page: EntryPage
  /** Model calls this entry took. */
  attempts: number
  tokens: number
  notes: string[]
  /** Chunks the entry was given, to check citations against and to report. */
  supplied: SourceChunk[]
}

const evidenceOf = (chunks: readonly SourceChunk[]) =>
  new Map(chunks.map((chunk) => [chunk.id, chunk.content]))

/** Citation tags, gap sentences and brand spellings removed from every client-facing string. */
export function cleanEntry(page: EntryPage, brand?: string) {
  const gaps: string[] = []
  const tidy = (value: string) => {
    const stripped = stripGapSentences(stripInlineCitations(value))
    gaps.push(...stripped.gaps)
    return (brand ? enforceBrandName(stripped.text, brand) : stripped.text).trim()
  }
  const next: EntryPage = {
    ...page,
    title: tidy(page.title),
    category: tidy(page.category),
    intro: tidy(page.intro),
    rows: page.rows.map((row) => ({
      ...row,
      label: tidy(row.label),
      body: tidy(row.body),
      constraint: row.constraint ? tidy(row.constraint) || undefined : undefined,
    })),
    claims: page.claims.map((c) => ({ ...c, claim: tidy(c.claim) })),
    sourceNotes: page.sourceNotes.map((n) => ({ ...n, note: tidy(n.note) })),
  }
  next.reviewer_notes = [
    ...new Set([...page.reviewer_notes, ...gaps.map((g) => `Not in the sources: ${g}`)]),
  ].slice(0, 8)
  return next
}

/**
 * The portfolio's model calls. One call writes one entry from its own evidence; the entry is
 * cleaned, checked (structure, citations, numbers) and corrected; then every field is measured
 * against its slot and at most one condense call, then a deterministic cut, fits it.
 */
export default class PortfolioWriter {
  constructor(private provider = new OpenRouterService()) {}

  /** The writing model: the planner's for concise depth, the writer's otherwise. */
  model(options: CanvasOptions) {
    return options.depth === 'concise' ? config.canvasPlannerModel : config.canvasWriterModel
  }

  private user(
    ctx: WriteContext,
    plan: PlanEntry,
    index: number,
    chunks: SourceChunk[],
    earlier: Earlier[]
  ) {
    return JSON.stringify({
      title: ctx.title,
      thesis: ctx.thesis,
      audience: ctx.audience,
      plan: ctx.outline.map((p, i) => ({ entry: i + 1, ...p })),
      entry: {
        number: index + 1,
        title: plan.title,
        category: plan.category,
        purpose: plan.purpose,
        questions: plan.questions,
        keyTerms: plan.keyTerms,
        rows: ROWS_BY_DEPTH[ctx.options.depth],
      },
      earlierEntries: earlier,
      sources: sourcesText(chunks),
      ...(chunks.length
        ? {}
        : { note: 'There are no sources: write from the brief and the plan.' }),
    })
  }

  private async produce(
    ctx: WriteContext,
    plan: PlanEntry,
    index: number,
    chunks: SourceChunk[],
    earlier: Earlier[],
    extra: string[] = []
  ) {
    const system = entrySystem({ depth: ctx.options.depth })
    const user = this.user(ctx, plan, index, chunks, earlier)
    const allowed = new Set(chunks.map((c) => c.id))
    const evidence = evidenceOf(chunks)
    let corrections = [...extra]
    let tokens = 0
    let calls = 0
    let page: EntryPage | undefined
    let problems: ReturnType<typeof validateEntry> = []
    const notes: string[] = []
    for (let round = 0; round <= ROUNDS; round++) {
      const raw = await this.provider.writePortfolioEntry(
        { system, user, model: this.model(ctx.options), corrections },
        ctx.guard
      )
      calls++
      tokens +=
        countTokens(system) +
        countTokens(user) +
        corrections.reduce((n, c) => n + countTokens(c), 0) +
        countTokens(JSON.stringify(raw))
      const clean = sanitizeEntry(cleanEntry(raw as EntryPage, ctx.brand), allowed)
      page = clean.page
      problems = validateEntry(page, evidence)
      if (clean.dropped)
        notes.push('A citation pointed at a source that was not supplied and was removed.')
      if (!problems.length) break
      corrections = [
        ...extra,
        `The previous entry was:\n${JSON.stringify(page)}`,
        problemCorrective(problems),
      ]
    }
    for (const problem of problems) {
      if (problem.code === 'uncited')
        notes.push(`${problem.field} has no source; check it against the sources.`)
      else if (problem.code === 'unsupported_number')
        notes.push(`${problem.field} has a number its sources do not contain (${problem.detail}).`)
      else notes.push(`The entry has too few rows with content (${problem.detail}).`)
    }
    page!.reviewer_notes = [...new Set([...page!.reviewer_notes, ...notes])].slice(0, 8)
    return { page: page!, calls, tokens, notes }
  }

  /** One entry: written, checked, then fitted to its slots. */
  async write(
    ctx: WriteContext,
    plan: PlanEntry,
    index: number,
    chunks: SourceChunk[],
    earlier: Earlier[],
    extra: SourceChunk[] = []
  ): Promise<Written> {
    const first = await this.produce(ctx, plan, index, chunks, earlier)
    let current = first
    const supplied = [...chunks]
    const min = ROWS_BY_DEPTH[ctx.options.depth].min
    // A thin entry gets one more look with the next best evidence.
    if (printedRows(first.page.rows).length < min && extra.length) {
      supplied.push(...extra)
      const again = await this.produce(ctx, plan, index, supplied, earlier, [
        `The entry you wrote:\n${JSON.stringify(first.page)}`,
        expandCorrective(printedRows(first.page.rows).length, min),
      ])
      if (printedRows(again.page.rows).length > printedRows(first.page.rows).length)
        current = {
          ...again,
          calls: first.calls + again.calls,
          tokens: first.tokens + again.tokens,
        }
    }
    let { page } = current
    let calls = current.calls
    let tokens = current.tokens
    const notes = [...current.notes]
    const over = entryOverBudget(page)
    if (over.length) {
      const made = await this.produce(ctx, plan, index, supplied, earlier, [
        `The entry you wrote:\n${JSON.stringify(page)}`,
        condenseCorrective(over),
      ])
      calls += made.calls
      tokens += made.tokens
      if (entryOverBudget(made.page).length < over.length) page = made.page
      notes.push(...made.notes)
    }
    const fitted = fitEntry(page)
    page = {
      ...fitted.page,
      reviewer_notes: [...new Set([...fitted.page.reviewer_notes, ...fitted.notes])].slice(0, 8),
    }
    return { page, attempts: calls, tokens, notes: [...notes, ...fitted.notes], supplied }
  }

  /**
   * Asked for by the author ("Add depth", "Make shorter"): one call on an entry as it stands.
   * Expanding may use the next best evidence; both keep the entry's chunk ids and fit it again.
   */
  async adjust(
    ctx: WriteContext,
    plan: PlanEntry,
    index: number,
    written: Written,
    extra: SourceChunk[],
    earlier: Earlier[],
    mode: 'expand' | 'condense'
  ): Promise<Written> {
    const supplied = mode === 'expand' ? [...written.supplied, ...extra] : written.supplied
    const rows = printedRows(written.page.rows).length
    const target = ROWS_BY_DEPTH[ctx.options.depth].max
    const correction =
      mode === 'expand'
        ? `${expandCorrective(rows, Math.min(Math.max(rows + 1, ENTRY.minRows), target))} Give each row as much as its space allows, with a concrete detail from the sources.`
        : 'Shorten the entry: merge overlapping sentences, drop restatement and keep only the strongest facts. Keep every figure and chunk id that still applies.'
    const made = await this.produce(ctx, plan, index, supplied, earlier, [
      `The entry you wrote:\n${JSON.stringify(written.page)}`,
      correction,
    ])
    const fitted = fitEntry(made.page)
    return {
      page: {
        ...fitted.page,
        reviewer_notes: [...new Set([...fitted.page.reviewer_notes, ...fitted.notes])].slice(0, 8),
      },
      attempts: written.attempts + made.calls,
      tokens: written.tokens + made.tokens,
      notes: [...written.notes, ...made.notes, ...fitted.notes],
      supplied,
    }
  }

  /** The cover, written last from the summaries of every entry. */
  async writeCover(
    ctx: WriteContext,
    entries: { title: string; summary: string }[]
  ): Promise<{ cover: CoverPage; tokens: number; calls: number; notes: string[] }> {
    const system = coverSystem()
    const user = JSON.stringify({
      title: ctx.title,
      thesis: ctx.thesis,
      audience: ctx.audience,
      entries,
    })
    let raw = await this.provider.writePortfolioCover(
      { system, user, model: this.model(ctx.options) },
      ctx.guard
    )
    let calls = 1
    let tokens = countTokens(system) + countTokens(user) + countTokens(JSON.stringify(raw))
    const issues = coverOverBudget(raw as never)
    if (issues.length) {
      const corrections = [
        `The cover you wrote:\n${JSON.stringify(raw)}`,
        condenseCorrective(issues).replace('entry', 'cover'),
      ]
      const again = await this.provider.writePortfolioCover(
        { system, user, model: this.model(ctx.options), corrections },
        ctx.guard
      )
      calls++
      tokens += countTokens(JSON.stringify(corrections)) + countTokens(JSON.stringify(again))
      if (coverOverBudget(again as never).length <= issues.length) raw = again
    }
    const tidy = (value: string) =>
      (ctx.brand
        ? enforceBrandName(stripGapSentences(stripInlineCitations(value)).text, ctx.brand)
        : stripGapSentences(stripInlineCitations(value)).text
      ).trim()
    const { cover, notes } = fitCover({
      ...raw,
      title: tidy(raw.title),
      subtitle: tidy(raw.subtitle),
      eyebrow: raw.eyebrow ? tidy(raw.eyebrow) : undefined,
    })
    return { cover: { ...raw, ...cover } as CoverPage, tokens, calls, notes }
  }
}
