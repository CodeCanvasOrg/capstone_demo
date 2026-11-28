import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import RetrievalService from '#services/documents/retrieval_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { SourcePin } from '#services/workspaces/task_service'
import { wordCount } from '../../../../shared/canvas/fit.ts'
import type { CanvasOptions } from '../../../../shared/canvas/options.ts'
import type { PlanEntry, PortfolioPlan } from '../../../../shared/canvas/portfolio/content.ts'
import { anchor } from '../generation/page_queries.ts'
import { entryCount, plannerSystem, sourcesText } from './portfolio_prompts.ts'

export type PlannerInput = {
  context: WorkspaceAccessContext
  documentId: string
  pins: SourcePin[]
  title: string
  brief: string
  options: CanvasOptions
  guard: () => Promise<void>
}

export type PlannedPortfolio = {
  title: string
  eyebrow?: string
  thesis: string
  audience: string
  coverageGaps: string[]
  entries: PlanEntry[]
  /** Chunks the plan was made from. */
  chunks: SourceChunk[]
  tokens: number
  model: string
}

/** The broad retrieval the plan follows: what the sources actually cover. */
export const PLAN_RETRIEVAL = { chunks: 30, tokens: 6000 } as const
/** An entry needs about this many words of source to be written from, so thin sources plan fewer entries. */
export const SOURCE_WORDS_PER_ENTRY = 150

export const entryLimit = (chunks: SourceChunk[]) =>
  Math.max(
    1,
    Math.floor(wordCount(chunks.map((c) => c.content).join(' ')) / SOURCE_WORDS_PER_ENTRY)
  )

/**
 * Stage 1. A model call plans the entries from the brief and a broad look at the sources. The
 * plan is checked against the requested count and asked again once with the problem named, then
 * clamped, so a plan is always usable.
 */
export default class PortfolioPlanner {
  constructor(private provider = new OpenRouterService()) {}

  problems(plan: PortfolioPlan, options: CanvasOptions, limit = Number.POSITIVE_INFINITY) {
    const count = this.bounds(options, limit)
    return plan.entries.length < count.min || plan.entries.length > count.max
      ? [
          `Plan ${count.min === count.max ? `exactly ${count.min}` : `${count.min} to ${count.max}`} entries; the previous plan had ${plan.entries.length}.`,
        ]
      : []
  }

  /** The count asked for, held down to what the sources can fill (never when the author fixed it). */
  bounds(options: CanvasOptions, limit = Number.POSITIVE_INFINITY) {
    const count = entryCount(options.depth, options.entries)
    if (options.entries !== 'auto' || limit >= count.max) return count
    const max = Math.max(limit, 1)
    return { min: Math.min(count.min, max), max }
  }

  repair(plan: PortfolioPlan, options: CanvasOptions, limit = Number.POSITIVE_INFINITY) {
    return { ...plan, entries: plan.entries.slice(0, this.bounds(options, limit).max) }
  }

  async plan(input: PlannerInput): Promise<PlannedPortfolio> {
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
    const system = plannerSystem({ depth: options.depth, entries: options.entries })
    const limit = entryLimit(chunks)
    const bound = chunks.length ? limit : undefined
    const user = JSON.stringify({
      title: input.title,
      brief: input.brief,
      sourceWords: wordCount(chunks.map((c) => c.content).join(' ')),
      sources: sourcesText(chunks),
      ...(chunks.length ? {} : { note: 'There are no sources: plan from the brief alone.' }),
    })
    let tokens = countTokens(system) + countTokens(user)
    let plan = await this.provider.planPortfolio({ system, user, model }, guard)
    tokens += countTokens(JSON.stringify(plan))
    const found = this.problems(plan, options, bound)
    if (found.length) {
      const again = await this.provider.planPortfolio(
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
    const repaired = this.repair(plan, options, bound)
    return {
      title: repaired.title,
      eyebrow: repaired.eyebrow,
      thesis: repaired.thesis,
      audience: repaired.audience,
      coverageGaps: repaired.coverageGaps,
      entries: repaired.entries,
      chunks,
      tokens,
      model,
    }
  }
}
