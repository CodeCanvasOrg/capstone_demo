import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import RetrievalService from '#services/documents/retrieval_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { SourcePin } from '#services/workspaces/task_service'
import type { CanvasPlan, PagePlan } from '../../../../shared/canvas/academic/content.ts'
import type { CanvasOptions } from '../../../../shared/canvas/academic/options.ts'
import { plannerSystem, contentPageCount, TEMPLATE_DESIGNS } from './canvas_prompts.ts'
import { anchor } from './page_queries.ts'

/** What the planner is given beyond the options. */
export type PlannerInput = {
  context: WorkspaceAccessContext
  documentId: string
  pins: SourcePin[]
  title: string
  brief: string
  options: CanvasOptions
  guard: () => Promise<void>
}

export type PlannedDocument = {
  thesis: string
  audience: string
  coverageGaps: string[]
  /** Every page in order, with the title page, contents and references the application adds. */
  pages: PagePlan[]
  /** Chunks the plan was made from. */
  chunks: SourceChunk[]
  tokens: number
  model: string
}

/** The broad retrieval the plan follows: what the sources actually cover. */
export const PLAN_RETRIEVAL = { chunks: 30, tokens: 6000 } as const

const sourcesText = (chunks: SourceChunk[]) =>
  chunks
    .map(
      (chunk) =>
        `[Source chunk ID: ${chunk.id}; File: ${chunk.fileName}; Chunk: ${chunk.chunkIndex + 1}${chunk.pageNumber ? `; Page: ${chunk.pageNumber}` : ''}${chunk.section ? `; Section: ${chunk.section}` : ''}]\n${chunk.content}`
    )
    .join('\n\n')
export { sourcesText }

/**
 * Stage 1. A model call plans the content pages from the brief and a broad look
 * at the sources; the application adds the title page, a contents page from six
 * pages up and the references. The plan is checked against the template set (page
 * count, allowed designs, a closing conclusion) and asked again once with the
 * problem named, then repaired deterministically, so a plan is always usable.
 */
export default class CanvasPlanner {
  constructor(private provider = new OpenRouterService()) {}

  problems(plan: CanvasPlan, options: CanvasOptions) {
    const count = contentPageCount(options.templateSet, options.depth, options.pages)
    const allowed = new Set<string>(TEMPLATE_DESIGNS[options.templateSet])
    const found: string[] = []
    if (plan.pages.length < count.min || plan.pages.length > count.max)
      found.push(
        `Plan ${count.min === count.max ? `exactly ${count.min}` : `${count.min} to ${count.max}`} content pages; the previous plan had ${plan.pages.length}.`
      )
    const bad = plan.pages.filter((page) => !allowed.has(page.design)).map((page) => page.design)
    if (bad.length)
      found.push(`These designs are not available here: ${[...new Set(bad)].join(', ')}.`)
    if (plan.pages.at(-1)?.design !== 'conclusion')
      found.push('The last page must be a conclusion.')
    return found
  }

  /** Makes any plan fit the template set: clamps the count, swaps unavailable designs, closes with a conclusion. */
  repair(plan: CanvasPlan, options: CanvasOptions): CanvasPlan {
    const count = contentPageCount(options.templateSet, options.depth, options.pages)
    const allowed = TEMPLATE_DESIGNS[options.templateSet]
    const fallback = allowed.includes('essay') ? 'essay' : allowed[0]
    const pages = plan.pages.slice(0, count.max).map((page) => ({
      ...page,
      design: allowed.includes(page.design) ? page.design : fallback,
    }))
    if (pages.length) pages[pages.length - 1] = { ...pages.at(-1)!, design: 'conclusion' }
    return { ...plan, pages }
  }

  async plan(input: PlannerInput): Promise<PlannedDocument> {
    const { options, guard } = input
    const model = config.canvasPlannerModel
    const chunks = await new RetrievalService().search({
      context: input.context,
      documentId: input.documentId,
      pins: input.pins,
      query: anchor(input.title, input.brief) || input.title,
      guard,
      tokenBudget: PLAN_RETRIEVAL.tokens,
      maxText: PLAN_RETRIEVAL.chunks,
      imageMode: 'none',
    })
    const system = plannerSystem(options)
    const user = JSON.stringify({
      title: input.title,
      brief: input.brief,
      sources: sourcesText(chunks),
      ...(chunks.length ? {} : { note: 'There are no sources: plan from the brief alone.' }),
    })
    let tokens = countTokens(system) + countTokens(user)
    let plan = await this.provider.planCanvas({ system, user, model }, guard)
    tokens += countTokens(JSON.stringify(plan))
    const found = this.problems(plan, options)
    if (found.length) {
      const again = await this.provider.planCanvas(
        {
          system,
          user,
          model,
          corrections: [
            `The previous plan was:\n${JSON.stringify(plan)}\n\nIt broke these rules: ${found.join(' ')} Return the whole plan again.`,
          ],
        },
        guard
      )
      tokens += countTokens(JSON.stringify(again))
      plan = again
    }
    const repaired = this.repair(plan, options)
    const content = repaired.pages
    const pages: PagePlan[] = [
      {
        design: 'title_page',
        title: input.title,
        purpose: `Abstract of the whole document: ${repaired.thesis}`,
        questions: [repaired.thesis, input.title],
        keyTerms: [],
        wantsImage: false,
      },
      // A contents page from six pages up; a requested page count is kept exactly.
      ...(options.templateSet === 'academic_report' &&
      (options.pages === 'auto' ? content.length + 3 >= 6 : options.pages >= 6)
        ? [fixed('contents', 'Contents')]
        : []),
      ...content,
      fixed('references', 'References'),
    ]
    return {
      thesis: repaired.thesis,
      audience: repaired.audience,
      coverageGaps: repaired.coverageGaps,
      pages,
      chunks,
      tokens,
      model,
    }
  }
}

const fixed = (design: 'contents' | 'references', title: string): PagePlan => ({
  design,
  title,
  purpose: 'Written by the application.',
  questions: [],
  keyTerms: [],
  wantsImage: false,
})
