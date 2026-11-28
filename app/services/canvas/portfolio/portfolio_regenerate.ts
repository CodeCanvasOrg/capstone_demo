import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import DocumentImage from '#models/document_image'
import CanvasService from '#services/canvas/canvas_service'
import RetrievalService from '#services/documents/retrieval_service'
import EvidenceService from '#services/documents/evidence_service'
import { DEPTH_TOKENS } from '../../../../shared/canvas/options.ts'
import { parseCanvas, type CanvasDocument, type Sheet } from '../../../../shared/canvas/model.ts'
import {
  composePortfolio,
  pagePlan,
  representatives,
  type EntryInput,
  type PortfolioImage,
  type SourceInfo,
} from '../../../../shared/canvas/portfolio/compose.ts'
import {
  citedChunks,
  entryFill,
  type CoverPage,
  type EntryPage,
  type PlanEntry,
} from '../../../../shared/canvas/portfolio/content.ts'
import type { CanvasRunMetrics } from '#models/canvas_generation_run'
import type { GenerateInput, Generated, PageRecord } from '../generation/canvas_pipeline.ts'
import PortfolioWriter, {
  type Earlier,
  type WriteContext,
  type Written,
} from './portfolio_writer.ts'
import { portfolioReport } from '../../../../shared/canvas/portfolio/quality.ts'
import { brandName, coverMeta, oneLine, sourceInfo, type StoredPlan } from './portfolio_pipeline.ts'

const unusable = (message: string) =>
  Object.assign(new Error(message), { status: 422, unusableOutput: true })

/**
 * One page of the current portfolio again. The stored content of every entry is the source of
 * truth for the sources pages, so they are always recomposed; the sheets of entries the author
 * did not ask about are kept as they are while the page count stays the same.
 */
export default class PortfolioRegenerate {
  async run(
    input: GenerateInput & {
      run: CanvasGenerationRun
      baseVersionId: string | null
      index: number
      mode: 'rewrite' | 'expand' | 'condense'
    }
  ): Promise<Pick<Generated, 'canvas' | 'metrics'>> {
    const started = performance.now()
    const { options, guard, index, mode } = input
    const recorder = input.recorder
    const previous = await CanvasGenerationRun.query()
      .where({ documentId: input.documentId, status: 'ready' })
      .whereNot('id', input.run.id)
      .orderBy('createdAt', 'desc')
      .firstOrFail()
    const stored = await CanvasGenerationPage.query()
      .where('runId', previous.id)
      .orderBy('pageIndex')
    const current = input.baseVersionId
      ? await new CanvasService().forVersion(input.baseVersionId)
      : null
    if (!current || stored.length !== current.project.sheets.length)
      throw unusable('The pages changed after they were generated.')
    const row = stored.find((r) => r.pageIndex === index)
    if (!row || !['cover', 'entry'].includes(row.designId))
      throw unusable('This page is written by the application; there is nothing to regenerate.')
    const plan = previous.plan as StoredPlan
    const entryRows = stored.filter((r) => r.designId === 'entry')
    const contents = entryRows.map((r) => r.content as EntryPage)
    const previousEntries = entryRows.map((r) => ({ page: r.content as EntryPage }))
    const sources = new Map<string, SourceInfo>(Object.entries(plan.sources ?? {}))
    const writer = new PortfolioWriter()
    const ctx: WriteContext = {
      title: input.title,
      thesis: plan.thesis,
      audience: plan.audience,
      outline: plan.pages.map(({ title, purpose }) => ({ title, purpose })),
      options,
      brand: await brandName(input.context, input.documentId),
      guard,
    }
    const summariesBefore = (j: number): Earlier[] =>
      contents.slice(0, j).map((c, i) => ({ entry: i + 1, title: c.title, summary: c.summary }))
    let cover = stored.find((r) => r.designId === 'cover')!.content as CoverPage
    let target: {
      notes: string[]
      attempts: number
      tokens: number
      fill: number | null
      chunkIds?: string[]
    } = {
      notes: row.notes,
      attempts: row.attempts,
      tokens: 0,
      fill: null,
    }
    await recorder?.stage('writing')
    if (row.designId === 'cover') {
      const made = await writer.writeCover(
        ctx,
        contents.map((c) => ({ title: c.title, summary: c.summary }))
      )
      cover = made.cover
      target = {
        notes: [...made.notes, ...cover.reviewer_notes],
        attempts: made.calls,
        tokens: made.tokens,
        fill: null,
      }
    } else {
      const j = entryRows.findIndex((r) => r.pageIndex === index)
      const planned = plan.pages[j]
      const entry: PlanEntry = {
        title: contents[j].title,
        category: contents[j].category,
        purpose: planned?.purpose ?? row.purpose,
        questions: planned?.questions ?? row.queries.slice(1),
        keyTerms: planned?.keyTerms ?? [],
        wantsImages: false,
      }
      await recorder?.stage('retrieving')
      const [found] = await new RetrievalService().searchPages({
        context: input.context,
        documentId: input.documentId,
        pins: input.pins,
        guard,
        pages: [{ key: '0', label: entry.title, queries: row.queries }],
        tokenBudget: DEPTH_TOKENS[options.depth],
      })
      const chunks = found?.chunks ?? []
      const extra = found?.extra ?? []
      await recorder?.stage('fitting')
      let written: Written
      if (mode === 'rewrite')
        written = await writer.write(ctx, entry, j, chunks, summariesBefore(j), extra)
      else {
        // The entry keeps the evidence it already cites, even where this retrieval does not return it.
        const ids = [...new Set([...row.chunkIds, ...citedChunks(contents[j])])]
        const ev = new EvidenceService()
        const rows = await ev.rows(input.context, input.documentId, ids, input.pins)
        const kept = rows.map((r) => ev.source(input.context, input.documentId, r))
        for (const c of kept) sources.set(c.id, sourceInfo(c))
        const base: Written = {
          page: contents[j],
          attempts: row.attempts,
          tokens: 0,
          notes: row.notes,
          supplied: [...new Map([...kept, ...chunks].map((c) => [c.id, c])).values()],
        }
        written = await writer.adjust(ctx, entry, j, base, extra, summariesBefore(j), mode)
      }
      contents[j] = written.page
      for (const c of [...chunks, ...extra]) sources.set(c.id, sourceInfo(c))
      target = {
        notes: [...new Set([...written.notes, ...written.page.reviewer_notes])],
        attempts: written.attempts,
        tokens: written.tokens,
        fill: entryFill(written.page),
        chunkIds: chunks.map((c) => c.id),
      }
    }
    await recorder?.stage('composing')
    // Pictures stay as the author left them on each entry's sheet; the stored ids give their alt text.
    const imageIds = [...new Set(entryRows.flatMap((r) => r.imageIds))]
    const found = imageIds.length
      ? await DocumentImage.query()
          .where('workspaceId', input.context.workspaceId)
          .whereIn('id', imageIds)
      : []
    const byId = new Map(found.map((image) => [image.id, image]))
    const entries: EntryInput[] = contents.map((page, j) => ({
      page,
      images: entryRows[j].imageIds.flatMap((id): PortfolioImage[] => {
        const image = byId.get(id)
        return image
          ? [
              {
                imageId: id,
                alt: image.altText ?? image.caption ?? image.filename,
                ...(image.origin === 'generated' ? { generated: true } : {}),
              },
            ]
          : []
      }),
    }))
    const cited = new Set(entries.flatMap((e) => citedChunks(e.page)))
    const sourceCount = new Set([...cited].map((id) => sources.get(id)?.fileName).filter(Boolean))
      .size
    const composed = composePortfolio({
      cover: {
        eyebrow: cover.eyebrow ?? plan.eyebrow ?? 'Selected project portfolio',
        title: cover.title,
        subtitle: cover.subtitle,
        meta: await coverMeta(
          input.context,
          input.title || oneLine(cover.title),
          entries.length,
          sourceCount
        ),
      },
      entries,
      sources,
      footer: current.project.sheets.length ? this.footerOf(current.project) : input.title,
    })
    const canvas = this.carry(
      composed,
      current.project,
      stored,
      plan.pages.length,
      entries,
      previousEntries,
      sources,
      index
    )
    if (!parseCanvas(canvas).ok) throw unusable('The composed canvas was not valid.')
    const report = portfolioReport(canvas)
    // Rows follow the new structure: the cover, then each entry with its sources pages.
    const records: Partial<PageRecord>[] = [
      {
        design: 'cover',
        status: 'fitted',
        purpose: stored[0].purpose,
        queries: [],
        chunkIds: [],
        citedChunkIds: [],
        imageIds: [],
        content: cover,
        wordCount: report.pages[0].words,
        fillRatio: null,
        attempts: row.designId === 'cover' ? target.attempts : stored[0].attempts,
        notes: row.designId === 'cover' ? target.notes : stored[0].notes,
      },
    ]
    const plans = pagePlan(entries, sources)
    entries.forEach((entry, j) => {
      const r = entryRows[j]
      const mine = r.pageIndex === index
      records.push({
        design: 'entry',
        status: 'fitted',
        purpose: r.purpose,
        queries: r.queries,
        chunkIds: mine && target.chunkIds ? target.chunkIds : r.chunkIds,
        citedChunkIds: citedChunks(entry.page),
        imageIds: r.imageIds,
        content: entry.page,
        wordCount: null,
        fillRatio: mine && target.fill !== null ? target.fill : entryFill(entry.page),
        attempts: mine ? target.attempts : r.attempts,
        notes: mine ? target.notes : r.notes,
      })
      for (let part = 1; part < plans[j]; part++)
        records.push({
          design: 'sources',
          status: 'fitted',
          purpose: `Sources of entry ${j + 1}.`,
          queries: [],
          chunkIds: [],
          citedChunkIds: citedChunks(entry.page),
          imageIds: [],
          content: null,
          wordCount: null,
          fillRatio: null,
          attempts: 1,
          notes: [],
        })
    })
    records.forEach((record, i) => {
      record.index = i
      record.wordCount = report.pages[i]?.words ?? null
    })
    await recorder?.pages(records as PageRecord[])
    await recorder?.plan(
      { ...plan, sources: Object.fromEntries(sources) },
      {
        planner: previous.plannerModel,
        writer: previous.writerModel,
      }
    )
    const metrics: CanvasRunMetrics = {
      pages: canvas.sheets.length,
      words: report.words,
      avgFill: report.avgFill,
      citations: report.citations,
      placeholders: 0,
      lowDpiImages: 0,
      durationMs: Math.round(performance.now() - started),
      tokens: target.tokens,
    }
    return { canvas, metrics }
  }

  /** The footer title the portfolio was generated with, read from the current canvas. */
  private footerOf(canvas: CanvasDocument) {
    for (const sheet of canvas.sheets)
      for (const frame of sheet.frames)
        if (frame.kind === 'text' && /-(entry|sources)-doctitle$/.test(frame.id)) {
          const node = frame.doc[0] as { content?: { text?: string }[] }
          if (node.content?.[0]?.text) return node.content[0].text
        }
    return 'Portfolio'
  }

  /**
   * The composed canvas, with the entries the author did not ask about taken from the current
   * canvas, exactly as they are, when the pages line up one to one.
   */
  private carry(
    composed: CanvasDocument,
    current: CanvasDocument,
    stored: CanvasGenerationPage[],
    entryCount: number,
    entries: EntryInput[],
    previousEntries: Pick<EntryInput, 'page'>[],
    sources: ReadonlyMap<string, SourceInfo>,
    index: number
  ): CanvasDocument {
    void entryCount
    const sameStructure =
      composed.sheets.length === current.sheets.length &&
      pagePlan(entries, sources).every((n, j, all) => {
        const at = all.slice(0, j).reduce((a, b) => a + b, 1)
        return (
          stored[at]?.designId === 'entry' &&
          stored.slice(at + 1, at + n).every((r) => r.designId === 'sources') &&
          stored[at + n]?.designId !== 'sources'
        )
      })
    if (!sameStructure) return composed
    // A kept sheet cites its documents by the chunk the earlier compose chose; the sources pages
    // use the chunk chosen now. Where those differ, every sheet is composed again.
    const before = representatives(previousEntries, sources)
    const after = representatives(entries, sources)
    const sameCitations =
      before.size === after.size && [...after].every(([file, id]) => before.get(file) === id)
    if (!sameCitations) return composed
    const sheets: Sheet[] = composed.sheets.map((sheet, i) => {
      const design = stored[i].designId
      return (design === 'entry' || design === 'cover') && i !== index ? current.sheets[i] : sheet
    })
    return { ...composed, sheets }
  }
}
