import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import Document from '#models/document'
import CanvasService from '#services/canvas/canvas_service'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import { account, source } from './workspaces.ts'
import { samplePage } from '../fixtures/canvas/academic.ts'
import { ACADEMIC_DESIGNS, type AcademicDesignId } from '../../shared/canvas/academic/designs.ts'
import type { CanvasPlan } from '../../shared/canvas/academic/content.ts'
import config from '#config/open_router'

type Account = Awaited<ReturnType<typeof account>>

export const EVIDENCE =
  'Surface temperatures fell by 83% across 12 monitored districts, which is 2.4x the baseline reduction. Planners review the results every summer against a baseline.'

/** An account whose document has `count` prepared sources, is open in the canvas editor and can be generated. */
export async function generatable(count = 4) {
  env.set('CANVAS_EDITOR', 'pilot')
  env.set('CANVAS_GENERATION', 'on')
  const a = await account()
  const sources = []
  for (let i = 0; i < count; i++) {
    const s = await source(a)
    await db
      .from('chunks')
      .where({ id: s.chunkId })
      .update({ content: `${EVIDENCE} Source ${i}.` })
    sources.push(s)
  }
  await new CanvasService().enable(a.context, a.document.id, randomUUID())
  const doc = await Document.findOrFail(a.document.id)
  return { a, sources, baseVersionId: doc.currentVersionId!, pins: sources.map((s) => s.pin) }
}

export function flagsOff() {
  env.set('CANVAS_EDITOR', undefined as never)
  env.set('CANVAS_GENERATION', undefined as never)
}

export type Call = { design: AcademicDesignId; corrections: string[]; model: string }

type Options = {
  /** Content designs the plan chooses, between the pages the application adds. */
  designs?: AcademicDesignId[]
  /** Share of its capacity a page of this design is written to on its first call. */
  first?: Partial<Record<AcademicDesignId, number>>
  /** Share on a corrected call (expand or condense); a list is used one call at a time, the last one repeating. */
  corrected?: number | number[]
  /** Throw for this design's page. */
  fail?: AcademicDesignId
  gaps?: string[]
  /** The planner waits for this before answering, so a test can watch the run in progress. */
  gate?: Promise<void>
}

/** Stand-ins for the planner and the writer. Restored by the returned function. */
export function installModel(options: Options = {}) {
  const proto = OpenRouterService.prototype
  const original = {
    plan: proto.planCanvas,
    write: proto.writeCanvasPage,
    caption: proto.captionCanvasImage,
    embed: EmbeddingService.prototype.embedQuery,
  }
  const calls: Call[] = []
  const plans: { model: string; corrections: string[] }[] = []
  let correctedCalls = 0
  EmbeddingService.prototype.embedQuery = async () =>
    Array.from({ length: config.embeddingDimensions }, (_, i) => (i === 0 ? 1 : 0))
  proto.planCanvas = async (input) => {
    await options.gate
    plans.push({ model: input.model, corrections: input.corrections ?? [] })
    const designs = options.designs ?? ['essay', 'two_column', 'data_findings', 'conclusion']
    return {
      thesis: 'Combined heat programmes outperform single measures.',
      audience: 'Municipal planners',
      pages: designs.map((design, i) => ({
        design,
        title: `${ACADEMIC_DESIGNS[design].label} ${i + 1}`,
        purpose: `Establish point ${i + 1} about urban heat.`,
        questions: [`What is point ${i + 1}?`, `Why does point ${i + 1} matter?`],
        keyTerms: [`term ${i + 1}`],
        wantsImage: false,
      })),
      coverageGaps: options.gaps ?? [],
    } satisfies CanvasPlan
  }
  proto.writeCanvasPage = async (input) => {
    const payload = JSON.parse(input.user)
    const design = payload.page.design as AcademicDesignId
    calls.push({ design, corrections: input.corrections ?? [], model: input.model })
    if (options.fail === design) throw Object.assign(new Error('boom'), { status: 500 })
    const corrected = (input.corrections ?? []).some((c) => /fills \d+%|exceeds its layout/.test(c))
    const ids = [...String(payload.sources).matchAll(/Source chunk ID: ([^;]+);/g)].map((m) => m[1])
    const sequence = [options.corrected ?? 0.85].flat()
    const fill = corrected
      ? sequence[Math.min(correctedCalls++, sequence.length - 1)]
      : (options.first?.[design] ?? 0.85)
    return samplePage(design, {
      chunks: ids.length ? ids : ['none'],
      fill,
      title: payload.page.title,
    })
  }
  return {
    calls,
    plans,
    restore() {
      proto.planCanvas = original.plan
      proto.writeCanvasPage = original.write
      proto.captionCanvasImage = original.caption
      EmbeddingService.prototype.embedQuery = original.embed
    },
  }
}

export type { Account }
