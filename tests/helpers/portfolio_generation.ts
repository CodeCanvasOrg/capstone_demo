import db from '@adonisjs/lucid/services/db'
import config from '#config/open_router'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import type { CoverPage, EntryPage, PortfolioPlan } from '../../shared/canvas/portfolio/content.ts'
import { generatable } from './canvas_generation.ts'

export { flagsOff, generatable } from './canvas_generation.ts'

/** Like `generatable`, with each source its own named document (the sources pages list documents by file name). */
export async function portfolioGeneratable(count = 4) {
  const g = await generatable(count)
  for (const [i, s] of g.sources.entries())
    await db
      .from('files')
      .where({ id: s.file.id })
      .update({ filename: `Research summary ${i + 1}.pdf` })
  return g
}

const LABELS = [
  'Context',
  'Research',
  'Challenge',
  'Approach',
  'Solution',
  'Evaluation',
  'Evidence',
  'Next steps',
]
/** A body that fits `lines` lines of a row (about 56 characters a line) and uses numbers the test chunks contain. */
const BODIES = [
  'Surface temperatures fell by 83% across 12 monitored districts in the pilot years.',
  'Planners review the results every summer against a baseline, district by district.',
  'Heat reached its peak where tree cover was thinnest, across 12 of the districts.',
  'Map the districts and plant first.',
  'Permeable paving and street trees cut surface temperatures by 83% in the pilot.',
  'Planners compared 12 districts against the baseline reduction of 2.4x each summer.',
  'Results are from the pilot only.',
  'Extend the programme to the districts that were not monitored in the first summer.',
]

export type PortfolioModelOptions = {
  entries?: number
  /** First answer for an entry has a row far over its space; the condense call fixes it. */
  overflow?: boolean
  /** Never fix the over-long row: the deterministic cut must. */
  stubborn?: boolean
  /** Throw for the entry writer. */
  fail?: boolean
  gaps?: string[]
  /** The planner waits for this before answering. */
  gate?: Promise<void>
}

export type PortfolioCall = {
  kind: 'plan' | 'entry' | 'cover'
  corrections: string[]
  model: string
}

/** Stand-ins for the portfolio planner and writers. Restored by the returned function. */
export function installPortfolioModel(options: PortfolioModelOptions = {}) {
  const proto = OpenRouterService.prototype
  const original = {
    plan: proto.planPortfolio,
    entry: proto.writePortfolioEntry,
    cover: proto.writePortfolioCover,
    embed: EmbeddingService.prototype.embedQuery,
  }
  const calls: PortfolioCall[] = []
  EmbeddingService.prototype.embedQuery = async () =>
    Array.from({ length: config.embeddingDimensions }, (_, i) => (i === 0 ? 1 : 0))
  proto.planPortfolio = async (input) => {
    await options.gate
    calls.push({ kind: 'plan', corrections: input.corrections ?? [], model: input.model })
    const count = options.entries ?? 2
    return {
      title: 'Cooling the city through design',
      eyebrow: 'Urban heat portfolio',
      thesis: 'Combined heat programmes outperform single measures.',
      audience: 'Municipal planners',
      entries: Array.from({ length: count }, (_, i) => ({
        title: `Cooling district ${i + 1}`,
        category: 'Urban heat',
        purpose: `Show what worked in district ${i + 1}.`,
        questions: [
          `What changed in district ${i + 1}?`,
          `How was it measured in district ${i + 1}?`,
        ],
        keyTerms: [],
        wantsImages: false,
      })),
      coverageGaps: options.gaps ?? [],
    } satisfies PortfolioPlan
  }
  proto.writePortfolioEntry = async (input) => {
    calls.push({ kind: 'entry', corrections: input.corrections ?? [], model: input.model })
    if (options.fail) throw Object.assign(new Error('boom'), { status: 500 })
    const payload = JSON.parse(input.user)
    const ids = [...String(payload.sources).matchAll(/Source chunk ID: ([^;]+);/g)].map((m) => m[1])
    const wanted: number = payload.entry.rows.max
    const condensed = (input.corrections ?? []).some((c) => /over their space/.test(c))
    const rows = Array.from({ length: wanted }, (_, i) => ({
      label: LABELS[wanted === 8 ? i : i % LABELS.length],
      body: BODIES[i % BODIES.length],
      chunks: ids.length ? [ids[i % ids.length]] : [],
    }))
    if (options.overflow && (!condensed || options.stubborn))
      rows[0].body = `${BODIES[0]} ${BODIES[1]} ${BODIES[2]} ${BODIES[4]} Surface temperatures fell by 83% everywhere.`
    return {
      title: payload.entry.title,
      category: payload.entry.category,
      intro:
        'How a set of districts was cooled with trees and paving, measured against a baseline, and reviewed every summer by the planners.',
      rows,
      claims: [{ claim: 'Surface temperatures fell', row: 1, kind: 'measured' }],
      sourceNotes: ids
        .slice(0, 1)
        .map((chunk) => ({ chunk, note: 'Measured results of the pilot districts.' })),
      summary: `Entry ${payload.entry.number} showed measured cooling.`,
      reviewer_notes: [],
    } as EntryPage
  }
  proto.writePortfolioCover = async (input) => {
    calls.push({ kind: 'cover', corrections: input.corrections ?? [], model: input.model })
    return {
      eyebrow: 'Urban heat portfolio',
      title: 'Cooling the city through design',
      subtitle: 'Measured results from districts that were cooled with trees and paving.',
      reviewer_notes: [],
    } as CoverPage
  }
  return {
    calls,
    restore() {
      proto.planPortfolio = original.plan
      proto.writePortfolioEntry = original.entry
      proto.writePortfolioCover = original.cover
      EmbeddingService.prototype.embedQuery = original.embed
    },
  }
}
