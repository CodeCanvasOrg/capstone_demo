import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import CanvasGenerationPage from '#models/canvas_generation_page'
import type CanvasGenerationRun from '#models/canvas_generation_run'
import type { CanvasRunMetrics } from '#models/canvas_generation_run'
import CanvasService from '#services/canvas/canvas_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import RetrievalService, { type ImageEvidence } from '#services/documents/retrieval_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import { DEPTH_TOKENS } from '../../../../shared/canvas/options.ts'
import { portfolioReport } from '../../../../shared/canvas/portfolio/quality.ts'
import { parseCanvas } from '../../../../shared/canvas/model.ts'
import {
  composePortfolio,
  pagePlan,
  type EntryInput,
  type PortfolioImage,
  type PortfolioInput,
  type SourceInfo,
} from '../../../../shared/canvas/portfolio/compose.ts'
import {
  citedChunks,
  entryFill,
  type CoverPage,
  type PlanEntry,
} from '../../../../shared/canvas/portfolio/content.ts'
import { getBrandKit } from '../../../../shared/layout/brand.ts'
import { anchor } from '../generation/page_queries.ts'
import type { GenerateInput, Generated, PageRecord } from '../generation/canvas_pipeline.ts'
import { WRITE_CONCURRENCY } from '../generation/canvas_pipeline.ts'
import PortfolioImagePlanner, { type PictureChoice } from './portfolio_image_planner.ts'
import PortfolioPlanner from './portfolio_planner.ts'
import PortfolioWriter, {
  type Earlier,
  type WriteContext,
  type Written,
} from './portfolio_writer.ts'

export const PORTFOLIO_PIPELINE_VERSION = 'portfolio-1'

const FOOTER_MAX = 90

/** What the run stores as its plan: the entries, so a page can be rewritten from them later. */
export type StoredPlan = {
  title: string
  eyebrow?: string
  thesis: string
  audience: string
  coverageGaps: string[]
  pages: {
    design: string
    title: string
    purpose: string
    questions: string[]
    keyTerms: string[]
    wantsImage: boolean
  }[]
  /** Where every cited chunk is, so the sources pages can be composed again without the sources. */
  sources?: Record<string, SourceInfo>
}

const pageOf = (design: string, e: PlanEntry) => ({
  design,
  title: e.title,
  purpose: e.purpose,
  questions: e.questions,
  keyTerms: e.keyTerms,
  wantsImage: e.wantsImages,
})

/** What to look for in the sources for each entry: its subject first, then one query per question. */
export function entryQueries(
  entries: readonly PlanEntry[],
  title: string | null | undefined,
  brief: string
) {
  const context = anchor(title, brief)
  return entries.map((entry, index) => ({
    key: String(index),
    label: entry.title,
    queries: [
      `${entry.title}\n${entry.purpose}\n${context}`.trim(),
      ...entry.questions.map((q) => q.trim()).filter(Boolean),
    ],
  }))
}

/** Where a chunk is, for a locator: file, page and place in the file. */
export const sourceInfo = (chunk: SourceChunk): SourceInfo => ({
  fileName: chunk.fileName,
  pageNumber: chunk.pageNumber ?? null,
  chunkIndex: chunk.chunkIndex,
})

const summaries = (
  entries: readonly PlanEntry[],
  written: Map<number, Written>,
  before = Number.POSITIVE_INFINITY
): Earlier[] =>
  [...written.entries()]
    .filter(([i]) => i < before)
    .sort(([a], [b]) => a - b)
    .map(([i, w]) => ({ entry: i + 1, title: entries[i].title, summary: w.page.summary }))

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

/** A cover title set on composed lines, as one line of text. */
export const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

/** The cover's three facts: project, author and date; a column with no value is dropped by the composer. */
export async function coverMeta(
  context: WorkspaceAccessContext,
  title: string,
  entries: number,
  sources: number
) {
  const user = context.actorId ? await User.find(context.actorId).catch(() => null) : null
  return [
    {
      label: 'Project',
      value: clip(title, 40),
      secondary: `${entries} ${entries === 1 ? 'entry' : 'entries'}${sources ? ` · ${sources} ${sources === 1 ? 'source' : 'sources'}` : ''}`,
    },
    { label: 'Prepared by', value: clip(user?.fullName ?? '', 40) },
    { label: 'Date', value: DateTime.utc().toFormat('d LLLL yyyy') },
  ]
}

/** The brand's name, so every spelling of it in the copy is corrected. The template's own kit is not a company. */
export async function brandName(context: WorkspaceAccessContext, documentId: string) {
  try {
    const selection = await new LayoutSelectionService().peek(context.workspaceId, documentId)
    const kit = getBrandKit(selection.brandId, selection.brandVersion)
    return kit && !kit.templateOnly ? kit.name : undefined
  } catch (error) {
    logger.warn(
      { err: error, documentId },
      'The brand name was not read; brand spellings are not enforced'
    )
    return undefined
  }
}

/**
 * The portfolio pipeline: plan the entries, retrieve per entry, choose pictures, write entry by
 * entry, fit every field to its slot, write the cover from the summaries, compose. Same stages and
 * records as the academic pipeline it replaced, so a run, its progress and its saved version work
 * unchanged.
 */
export default class PortfolioPipeline {
  async generate(input: GenerateInput): Promise<Generated> {
    const started = performance.now()
    const { options, guard } = input
    const recorder = input.recorder
    const planner = new PortfolioPlanner()
    const writer = new PortfolioWriter()
    const pictures = new PortfolioImagePlanner()
    const stage = (s: Parameters<NonNullable<typeof recorder>['stage']>[0]) => recorder?.stage(s)
    let tokens = 0

    await stage('planning')
    const planned = await planner.plan({ ...input })
    tokens += planned.tokens
    const entries = planned.entries
    const models = { planner: planned.model, writer: writer.model(options) }
    const stored: StoredPlan = {
      title: planned.title,
      eyebrow: planned.eyebrow,
      thesis: planned.thesis,
      audience: planned.audience,
      coverageGaps: planned.coverageGaps,
      pages: entries.map((e) => pageOf('entry', e)),
    }
    await recorder?.plan(stored, models)
    await guard()

    await stage('retrieving')
    const queries = entryQueries(entries, input.title, input.brief)
    const found = await new RetrievalService().searchPages({
      context: input.context,
      documentId: input.documentId,
      pins: input.pins,
      guard,
      pages: queries,
      tokenBudget: DEPTH_TOKENS[options.depth],
    })
    const evidence = new Map(found.map((f) => [Number(f.key), f]))
    const imageEvidence = new Map<number, ImageEvidence[]>(
      found.map((f) => [Number(f.key), f.images])
    )

    await stage('images')
    const choices = options.images
      ? await pictures.select({
          context: input.context,
          documentId: input.documentId,
          entries,
          evidence: imageEvidence,
          guard,
        })
      : new Map<number, PictureChoice[]>()

    await stage('writing')
    const brand = await brandName(input.context, input.documentId)
    const ctx: WriteContext = {
      title: input.title,
      thesis: planned.thesis,
      audience: planned.audience,
      outline: entries.map(({ title, purpose }) => ({ title, purpose })),
      options,
      brand,
      guard,
    }
    const written = new Map<number, Written>()
    const rows = new Map<number, Partial<PageRecord>>()
    for (let n = 0; n < entries.length; n += WRITE_CONCURRENCY) {
      await guard()
      const wave = entries.map((entry, i) => ({ entry, i })).slice(n, n + WRITE_CONCURRENCY)
      const earlier = summaries(entries, written)
      const results = await Promise.all(
        wave.map(({ entry, i }) =>
          writer.write(
            ctx,
            entry,
            i,
            evidence.get(i)?.chunks ?? [],
            earlier.filter((e) => e.entry - 1 < i),
            evidence.get(i)?.extra ?? []
          )
        )
      )
      wave.forEach(({ i }, k) => {
        written.set(i, results[k])
        tokens += results[k].tokens
        rows.set(i, {
          status: 'written',
          content: results[k].page,
          attempts: results[k].attempts,
          notes: results[k].notes,
        })
      })
    }
    // Every field of every entry is measured and fitted inside `write`; this stage is the cover.
    await stage('fitting')
    const known = new Map<string, SourceChunk>()
    for (const c of planned.chunks) known.set(c.id, c)
    for (const e of evidence.values()) for (const c of [...e.chunks, ...e.extra]) known.set(c.id, c)
    const cover = await writer.writeCover(
      ctx,
      [...written.entries()]
        .sort(([a], [b]) => a - b)
        .map(([i, w]) => ({ title: entries[i].title, summary: w.page.summary }))
    )
    tokens += cover.tokens
    await guard()

    // Entries with no usable source picture get a labelled AI illustration when that is switched on.
    if (options.images) {
      const illustrated = await pictures.illustrate({
        context: input.context,
        documentId: input.documentId,
        pages: entries.map((_, i) => written.get(i)!.page),
        choices,
        guard,
      })
      for (const [i, notes] of illustrated)
        rows.set(i, { ...rows.get(i), notes: [...(rows.get(i)?.notes ?? []), ...notes] })
    }
    await guard()

    const placed = options.images
      ? await pictures.place({
          context: input.context,
          documentId: input.documentId,
          choices,
          guard,
        })
      : new Map<number, (PortfolioImage & { dpi: number })[]>()

    await stage('composing')
    const sources = new Map<string, SourceInfo>()
    for (const [id, chunk] of known) sources.set(id, sourceInfo(chunk))
    const inputs: EntryInput[] = entries.map((_, i) => ({
      page: written.get(i)!.page,
      images: placed.get(i) ?? [],
    }))
    const cited = new Set(inputs.flatMap((e) => citedChunks(e.page)))
    const sourceCount = new Set([...cited].map((id) => sources.get(id)?.fileName).filter(Boolean))
      .size
    const portfolio: PortfolioInput = {
      cover: {
        eyebrow: cover.cover.eyebrow ?? planned.eyebrow ?? 'Selected project portfolio',
        title: cover.cover.title || planned.title,
        subtitle: cover.cover.subtitle,
        // An untitled case study gets its title from this cover, so the cover names the project itself.
        meta: await coverMeta(
          input.context,
          input.title || oneLine(cover.cover.title || planned.title),
          entries.length,
          sourceCount
        ),
      },
      entries: inputs,
      sources,
      footer: clip(input.title, FOOTER_MAX),
    }
    stored.sources = Object.fromEntries(
      [...cited].flatMap((id) => (sources.has(id) ? [[id, sources.get(id)!]] : []))
    )
    await recorder?.plan(stored, models)
    const canvas = composePortfolio(portfolio)
    const parsed = parseCanvas(canvas)
    if (!parsed.ok)
      throw Object.assign(new Error('The composed canvas was not valid.'), {
        status: 422,
        unusableOutput: true,
      })
    const { records } = this.records(
      entries,
      inputs,
      written,
      rows,
      pagePlan(inputs, sources),
      choices,
      placed,
      evidence,
      cover.cover
    )
    const report = portfolioReport(canvas)
    report.pages.forEach((m, i) => {
      if (records[i].fillRatio === null || records[i].fillRatio === undefined)
        records[i].fillRatio = m.fill
      records[i].wordCount = m.words
      records[i].index = i
    })
    await recorder?.pages(records as PageRecord[])
    const metrics: CanvasRunMetrics = {
      pages: canvas.sheets.length,
      words: report.words,
      avgFill: report.avgFill,
      citations: report.citations,
      placeholders: 0,
      lowDpiImages: 0,
      durationMs: Math.round(performance.now() - started),
      tokens,
    }
    return {
      canvas,
      plan: {
        thesis: planned.thesis,
        audience: planned.audience,
        coverageGaps: planned.coverageGaps,
        pages: stored.pages,
      },
      pages: records as PageRecord[],
      report,
      metrics,
      models,
      evidence: Object.fromEntries([...known].map(([id, chunk]) => [id, chunk.content])),
    }
  }

  /** The stored row of every sheet, in sheet order: the cover, then each entry and its sources pages. */
  private records(
    entries: PlanEntry[],
    inputs: EntryInput[],
    written: Map<number, Written>,
    rows: Map<number, Partial<PageRecord>>,
    plan: number[],
    choices: Map<number, PictureChoice[]>,
    placed: Map<number, (PortfolioImage & { dpi: number })[]>,
    evidence: Map<number, { chunks: SourceChunk[] }>,
    cover: CoverPage
  ) {
    const records: Partial<PageRecord>[] = [
      {
        design: 'cover',
        status: 'fitted',
        purpose: 'Cover: title, subtitle and three facts.',
        queries: [],
        chunkIds: [],
        citedChunkIds: [],
        imageIds: [],
        content: cover,
        wordCount: null,
        fillRatio: null,
        attempts: 1,
        notes: cover.reviewer_notes,
      },
    ]
    entries.forEach((entry, i) => {
      const w = written.get(i)!
      records.push({
        design: 'entry',
        status: 'fitted',
        purpose: entry.purpose,
        queries: entryQueries([entry], '', '')[0].queries,
        chunkIds: evidence.get(i)?.chunks.map((c) => c.id) ?? [],
        citedChunkIds: citedChunks(inputs[i].page),
        imageIds: (placed.get(i) ?? []).map((p) => p.imageId),
        content: inputs[i].page,
        wordCount: null,
        fillRatio: entryFill(inputs[i].page),
        attempts: w.attempts,
        notes: [...new Set([...rows.get(i)!.notes!, ...inputs[i].page.reviewer_notes])],
      })
      void choices
      for (let part = 1; part < plan[i]; part++)
        records.push({
          design: 'sources',
          status: 'fitted',
          purpose: `Sources of entry ${i + 1}.`,
          queries: [],
          chunkIds: [],
          citedChunkIds: citedChunks(inputs[i].page),
          imageIds: [],
          content: null,
          wordCount: null,
          fillRatio: null,
          attempts: 1,
          notes: [],
        })
    })
    return { records }
  }

  /**
   * One page of the current canvas, again: an entry rewritten from fresh retrieval (or made
   * deeper or shorter), or the cover rewritten from the entry summaries. Superscript numbers are
   * global, so every sources page is recomposed from stored content; entries the author did not
   * ask about keep their sheets exactly as they are, unless the page count changed.
   */
  async regenerate(
    input: GenerateInput & {
      run: CanvasGenerationRun
      baseVersionId: string | null
      index: number
      mode: 'rewrite' | 'expand' | 'condense'
    }
  ): Promise<Pick<Generated, 'canvas' | 'metrics'>> {
    const { default: Regenerate } = await import('./portfolio_regenerate.ts')
    return new Regenerate().run(input)
  }
}

export { CanvasGenerationPage, CanvasService }
