import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import {
  sanitizePage,
  validateAcademicPage,
  type AcademicPage,
  type PageProblem,
  type PagePlan,
} from '../../../../shared/canvas/academic/content.ts'
import {
  composeAcademicSheet,
  type AcademicMeta,
} from '../../../../shared/canvas/academic/compose.ts'
import {
  DEPTH_FILL,
  pageCapacity,
  wordRange,
  type AcademicDesignId,
} from '../../../../shared/canvas/academic/designs.ts'
import type { CanvasOptions } from '../../../../shared/canvas/academic/options.ts'
import { pageMetrics } from '../../../../shared/canvas/density.ts'
import { FIGURE_PLACEHOLDER } from '../../../../shared/brochure/content.ts'
import { FILL } from '../../../../shared/canvas/fit.ts'
import {
  ABSTRACT_RULES,
  condenseCorrective,
  expandCorrective,
  problemCorrective,
  writerSystem,
} from './canvas_prompts.ts'
import { sourcesText } from './canvas_planner.ts'
import { cleanCopy, copyProblems } from './copy_clean.ts'

/** Pages that may continue on a second page of the same design when they overflow. */
export const SPLITTABLE: readonly AcademicDesignId[] = ['essay', 'two_column']

/** Model rounds a page may spend repairing structure and citations before the repairs below apply. */
const ROUNDS = 2

export type WriteContext = {
  title: string
  thesis: string
  audience: string
  /** Every planned page, titles and purposes only, so pages do not repeat each other. */
  outline: { design: AcademicDesignId; title: string; purpose: string }[]
  options: CanvasOptions
  /** The brand's name as it must be written everywhere; other spellings are corrected. */
  brand?: string
  guard: () => Promise<void>
}

export type Written = {
  page: AcademicPage
  /** Model calls this page took: the write, structure repairs and the fit retry. */
  attempts: number
  tokens: number
  notes: string[]
  /** Chunks the page was given, to check citations against and to report. */
  supplied: SourceChunk[]
}

const FIGURE_NOTE = 'A figure the sources do not contain was replaced with a placeholder.'

/** Chunk id → text, for the figure check. */
const evidenceOf = (chunks: readonly SourceChunk[]) =>
  new Map(chunks.map((chunk) => [chunk.id, chunk.content]))

/**
 * Stages 3 and 4. One model call writes one page from its own evidence; the page
 * is checked (structure, citations, figures) and corrected; then the composer
 * lays it out and the estimator says how full its frames are, and at most one
 * expand or condense call (or a split into a continuation page) fixes the fill.
 */
export default class CanvasPageWriter {
  constructor(private provider = new OpenRouterService()) {}

  /** The writing model: Haiku-class for concise depth, the writer model otherwise. */
  model(options: CanvasOptions) {
    return options.depth === 'concise' ? config.canvasPlannerModel : config.canvasWriterModel
  }

  private user(
    ctx: WriteContext,
    plan: PagePlan,
    index: number,
    chunks: SourceChunk[],
    earlier: { page: number; title: string; summary: string }[],
    figure?: string
  ) {
    const range = wordRange(plan.design, ctx.options.depth)
    return JSON.stringify({
      title: ctx.title,
      thesis: ctx.thesis,
      audience: ctx.audience,
      plan: ctx.outline.map((p, i) => ({ page: i + 1, ...p })),
      page: {
        number: index + 1,
        design: plan.design,
        title: plan.title,
        purpose: plan.purpose,
        questions: plan.questions,
        keyTerms: plan.keyTerms,
        words: range.capacity ? { min: range.min, max: range.max } : undefined,
        ...(figure ? { figure } : {}),
      },
      earlierPages: earlier,
      sources: sourcesText(chunks),
      ...(chunks.length
        ? {}
        : { note: 'There are no sources: write from the brief and the plan.' }),
    })
  }

  private system(ctx: WriteContext, plan: PagePlan) {
    const base = writerSystem({
      profile: ctx.options.profile,
      depth: ctx.options.depth,
      design: plan.design,
    })
    return plan.design === 'title_page' ? `${base}\n\n${ABSTRACT_RULES}` : base
  }

  /**
   * One page from the model, checked. A page that breaks the structure or citation
   * rules is asked for again with the problems named (twice at most); what still
   * fails is repaired where that is honest (an unsupported figure becomes a
   * placeholder) and noted for the reviewer where it is not.
   */
  private async produce(
    ctx: WriteContext,
    plan: PagePlan,
    index: number,
    chunks: SourceChunk[],
    earlier: { page: number; title: string; summary: string }[],
    extra: string[] = [],
    figure?: string
  ) {
    const system = this.system(ctx, plan)
    const user = this.user(ctx, plan, index, chunks, earlier, figure)
    const allowed = new Set(chunks.map((c) => c.id))
    const evidence = evidenceOf(chunks)
    let corrections = [...extra]
    let tokens = 0
    let calls = 0
    let page: AcademicPage | undefined
    let problems: PageProblem[] = []
    let copy: { code: string; field: string; detail?: string }[] = []
    const notes: string[] = []
    for (let round = 0; round <= ROUNDS; round++) {
      const raw = await this.provider.writeCanvasPage(
        { system, user, model: this.model(ctx.options), corrections },
        ctx.guard
      )
      calls++
      tokens +=
        countTokens(system) +
        countTokens(user) +
        corrections.reduce((n, c) => n + countTokens(c), 0) +
        countTokens(JSON.stringify(raw))
      const clean = sanitizePage({ ...raw, design: plan.design }, allowed)
      const tidy = cleanCopy(clean.page, ctx.brand)
      page = tidy.page
      notes.push(...tidy.gaps)
      problems = validateAcademicPage(page, { design: plan.design, evidence })
      copy = copyProblems(page, plan.design)
      if (clean.dropped)
        notes.push('A citation pointed at a source that was not supplied and was removed.')
      if (!problems.length && !copy.length) break
      corrections = [
        ...extra,
        `The previous page was:\n${JSON.stringify(page)}`,
        problemCorrective([...problems, ...copy]),
      ]
    }
    // Repairs after the last round.
    for (const problem of problems) {
      if (problem.code === 'invented_figure') {
        const i = Number(/\[(\d+)\]/.exec(problem.field)?.[1])
        if (page!.figures[i]) {
          page!.figures[i] = { ...page!.figures[i], value: FIGURE_PLACEHOLDER }
          notes.push(FIGURE_NOTE)
        }
      } else if (problem.code === 'uncited')
        notes.push(`${problem.field} has no citation; check it against the sources.`)
      else if (problem.code === 'missing' || problem.code === 'extra')
        notes.push(`${problem.field}: ${problem.detail ?? problem.code}.`)
    }
    page!.reviewer_notes = [...new Set([...page!.reviewer_notes, ...notes])].slice(0, 8)
    return { page: page!, calls, tokens, notes }
  }

  /** Stage 3 for one page. `earlier` holds the one-line summaries of pages already written. */
  async write(
    ctx: WriteContext,
    plan: PagePlan,
    index: number,
    chunks: SourceChunk[],
    earlier: { page: number; title: string; summary: string }[],
    figure?: string
  ): Promise<Written> {
    const made = await this.produce(ctx, plan, index, chunks, earlier, [], figure)
    return {
      page: made.page,
      attempts: made.calls,
      tokens: made.tokens,
      notes: made.notes,
      supplied: chunks,
    }
  }

  /** How full the page's frames are when laid out, by the estimator. */
  measure(page: AcademicPage, design: AcademicDesignId, meta: AcademicMeta, withImage = false) {
    const sheet = composeAcademicSheet(
      {
        design,
        page,
        image: withImage
          ? { imageId: '00000000-0000-4000-8000-000000000000', alt: '', caption: '' }
          : null,
      },
      1,
      meta
    )
    const m = pageMetrics(sheet, 1)
    return { fill: m.fill ?? 0, maxFrame: m.maxFrameFill ?? 0 }
  }

  /**
   * Stage 4 for one page: at most one fit retry. Under 70% full gets one expand call
   * (the same evidence plus the next best chunks); over 100% gets a continuation page
   * (essay, two columns, when the page count is free) or one condense call. Whatever
   * still overflows is trimmed from its last paragraph, so nothing is clipped unseen.
   */
  async fit(
    ctx: WriteContext,
    plan: PagePlan,
    index: number,
    written: Written,
    extra: SourceChunk[],
    earlier: { page: number; title: string; summary: string }[],
    meta: AcademicMeta,
    figure?: string,
    withImage = false
  ): Promise<{ pages: Written[]; fill: number }> {
    const { depth } = ctx.options
    const design = plan.design
    let current = written
    let m = this.measure(current.page, design, meta, withImage)
    const target = (DEPTH_FILL[depth][0] + DEPTH_FILL[depth][1]) / 2
    const capacity = pageCapacity(design)
    const splitOk = SPLITTABLE.includes(design) && ctx.options.pages === 'auto'

    if (m.fill < FILL.low && m.maxFrame <= FILL.high && capacity) {
      const words = Math.max(20, Math.round((target - m.fill) * capacity))
      const chunks = [...written.supplied, ...extra]
      const made = await this.produce(
        ctx,
        plan,
        index,
        chunks,
        earlier,
        [`The page you wrote:\n${JSON.stringify(written.page)}`, expandCorrective(m.fill, words)],
        figure
      )
      const after = this.measure(made.page, design, meta, withImage)
      current = {
        page: after.fill > m.fill && after.maxFrame <= FILL.high ? made.page : written.page,
        attempts: written.attempts + made.calls,
        tokens: written.tokens + made.tokens,
        notes: [...written.notes, ...made.notes],
        supplied: chunks,
      }
      if (current.page === made.page) m = after
      else
        current.notes.push(
          'The page is thinner than its layout; the sources gave little more to say.'
        )
    } else if (m.maxFrame > FILL.high) {
      const split = splitOk ? this.split(current.page, design, meta, withImage) : null
      if (split) return { pages: split.map((page) => ({ ...current, page })), fill: m.fill }
      const range = wordRange(design, depth)
      const made = await this.produce(
        ctx,
        plan,
        index,
        written.supplied,
        earlier,
        [
          `The page you wrote:\n${JSON.stringify(written.page)}`,
          condenseCorrective(m.maxFrame - 1, range.max),
        ],
        figure
      )
      const after = this.measure(made.page, design, meta, withImage)
      current = {
        page: after.maxFrame < m.maxFrame ? made.page : written.page,
        attempts: written.attempts + made.calls,
        tokens: written.tokens + made.tokens,
        notes: [...written.notes, ...made.notes],
        supplied: written.supplied,
      }
      m = current.page === made.page ? after : m
      if (m.maxFrame > FILL.high) {
        const split2 = splitOk ? this.split(current.page, design, meta, withImage) : null
        if (split2) return { pages: split2.map((page) => ({ ...current, page })), fill: m.fill }
        const trimmed = this.trim(current.page, design, meta, withImage)
        current = {
          ...current,
          page: trimmed.page,
          notes: [
            ...current.notes,
            ...(trimmed.cut ? ['The page was shortened to fit its layout.'] : []),
          ],
        }
        m = this.measure(current.page, design, meta, withImage)
      }
    }
    return { pages: [current], fill: m.fill }
  }

  /**
   * Asked for by the author ("Add depth", "Make shorter"): one expand or condense call
   * on a page as it stands, whatever its fill is. Citations and figures are kept.
   */
  async adjust(
    ctx: WriteContext,
    plan: PagePlan,
    index: number,
    written: Written,
    extra: SourceChunk[],
    earlier: { page: number; title: string; summary: string }[],
    mode: 'expand' | 'condense',
    meta: AcademicMeta,
    figure?: string,
    withImage = false
  ): Promise<Written> {
    const design = plan.design
    const m = this.measure(written.page, design, meta, withImage)
    const target = (DEPTH_FILL[ctx.options.depth][0] + DEPTH_FILL[ctx.options.depth][1]) / 2
    const chunks = mode === 'expand' ? [...written.supplied, ...extra] : written.supplied
    const correction =
      mode === 'expand'
        ? expandCorrective(
            Math.min(m.fill, FILL.low - 0.01),
            Math.max(40, Math.round((target - m.fill) * pageCapacity(design)))
          )
        : condenseCorrective(
            Math.max(m.maxFrame - 1, 0.1),
            wordRange(design, ctx.options.depth).max
          )
    const made = await this.produce(
      ctx,
      plan,
      index,
      chunks,
      earlier,
      [`The page you wrote:\n${JSON.stringify(written.page)}`, correction],
      figure
    )
    const trimmed =
      this.measure(made.page, design, meta, withImage).maxFrame > FILL.high
        ? this.trim(made.page, design, meta, withImage).page
        : made.page
    return {
      page: trimmed,
      attempts: written.attempts + made.calls,
      tokens: written.tokens + made.tokens,
      notes: [...written.notes, ...made.notes],
      supplied: chunks,
    }
  }

  /**
   * A continuation page: the sections that fit stay, the rest move to a second page
   * of the same design, which also takes the takeaway. Null when the first section
   * alone is too long to split.
   */
  split(
    page: AcademicPage,
    design: AcademicDesignId,
    meta: AcademicMeta,
    withImage = false
  ): AcademicPage[] | null {
    if (page.sections.length < 2) return null
    for (let keep = page.sections.length - 1; keep >= 1; keep--) {
      const first: AcademicPage = {
        ...page,
        sections: page.sections.slice(0, keep),
        takeaway: null,
      }
      if (this.measure(first, design, meta, withImage).maxFrame <= FILL.high) {
        const next: AcademicPage = {
          ...page,
          title: `${page.title} (continued)`,
          lead: null,
          sections: page.sections.slice(keep),
          definitions: [],
          figures: [],
          callout: null,
          reviewer_notes: [],
        }
        if (this.measure(next, design, meta).maxFrame > FILL.high) return null
        return [first, next]
      }
    }
    return null
  }

  /** Removes trailing paragraphs (then sections) until the page fits; the last resort. */
  trim(page: AcademicPage, design: AcademicDesignId, meta: AcademicMeta, withImage = false) {
    const next: AcademicPage = structuredClone(page)
    let cut = false
    while (this.measure(next, design, meta, withImage).maxFrame > FILL.high) {
      const last = next.sections.at(-1)
      if (!last) {
        // The title page has no sections: an abstract that is too long loses its last sentence.
        const sentences = next.lead?.text.split(/(?<=[.!?])\s+/) ?? []
        if (!next.lead || sentences.length < 2) break
        next.lead = { ...next.lead, text: sentences.slice(0, -1).join(' ') }
        cut = true
        continue
      }
      if (last.bullets.length) last.bullets.pop()
      else if (last.paragraphs.length > 1) last.paragraphs.pop()
      else if (next.sections.length > 1) next.sections.pop()
      else break
      cut = true
    }
    return { page: next, cut }
  }
}
