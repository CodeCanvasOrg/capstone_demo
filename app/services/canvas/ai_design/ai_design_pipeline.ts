import logger from '@adonisjs/core/services/logger'
import type { CanvasRunMetrics } from '#models/canvas_generation_run'
import OpenRouterService from '#services/open_router_service'
import RetrievalService from '#services/documents/retrieval_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import { DEPTH_TOKENS } from '../../../../shared/canvas/options.ts'
import { densityReport, type ImageSize } from '../../../../shared/canvas/density.ts'
import { parseCanvas } from '../../../../shared/canvas/model.ts'
import {
  composeAiDesign,
  type FramePicture,
  type PageInput,
} from '../../../../shared/canvas/ai_design/compose.ts'
import type { CanvasDesign, DesignPage } from '../../../../shared/canvas/ai_design/schema.ts'
import type { SourceInfo } from '../../../../shared/canvas/portfolio/compose.ts'
import { anchor } from '../generation/page_queries.ts'
import {
  WRITE_CONCURRENCY,
  type GenerateInput,
  type Generated,
  type PageRecord,
} from '../generation/canvas_pipeline.ts'
import { brandName, sourceInfo } from '../portfolio/portfolio_pipeline.ts'
import AiDesigner, { type DesignResult } from './ai_design_designer.ts'
import { buildDigest, type Digest } from './ai_design_digest.ts'
import AiDesignImages, { assignPictures } from './ai_design_images.ts'
import AiDesignWriter, { type WriteContext, type WrittenPage } from './ai_design_writer.ts'

export const AI_DESIGN_PIPELINE_VERSION = 'ai-design-1'

const FOOTER_MAX = 90
const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

/** What the run stores as its plan: the design, so a reviewer can see what the model decided. */
export type StoredDesign = {
  kind: 'ai_design'
  title: string
  thesis: string
  audience: string
  coverageGaps: string[]
  design: { system: CanvasDesign['system']; pages: { purpose: string; frames: number }[] }
  pages: {
    design: string
    title: string
    purpose: string
    questions: string[]
    keyTerms: string[]
    wantsImage: boolean
  }[]
  sources?: Record<string, SourceInfo>
}

const pageQueries = (design: CanvasDesign, title: string, brief: string) => {
  const context = anchor(title, brief)
  return design.pages.map((page, i) => ({
    key: String(i),
    label: page.purpose.slice(0, 60),
    queries: [`${page.purpose}\n${context}`.trim(), ...page.questions.map((q) => q.trim())].filter(
      Boolean
    ),
  }))
}

/** Reads the brand palette the canvas can reference by name. */
const brandPalette = (digest: Digest) =>
  digest.brand
    ? ({
        primary: digest.brand.palette.primary,
        accent: digest.brand.palette.accent,
        accentText: digest.brand.palette.accentText,
        text: digest.brand.palette.text,
        muted: digest.brand.palette.muted,
        background: digest.brand.palette.background,
        surface: digest.brand.palette.surface,
      } as const)
    : undefined

/**
 * "Let AI choose": the model designs the pages. Digest the materials, design (validated, with one
 * corrective retry), retrieve per designed page, place pictures, write into each frame, fit, compose,
 * append the sources pages. An unusable design falls back to the portfolio template with a note.
 */
export default class AiDesignPipeline {
  /** The design step alone: what `canvas:ai-design --dry-run` prints. */
  async design(input: GenerateInput): Promise<{ digest: Digest; result: DesignResult }> {
    const digest = await buildDigest(input)
    await input.guard()
    const result = await new AiDesigner().design({
      title: input.title,
      brief: input.brief,
      digest,
      guard: input.guard,
    })
    return { digest, result }
  }

  /** The portfolio template, with the reason on the first page. */
  async fallback(input: GenerateInput, reason: string): Promise<Generated> {
    logger.warn({ documentId: input.documentId, reason }, 'AI design fell back to the portfolio')
    const { default: PortfolioPipeline } = await import('../portfolio/portfolio_pipeline.ts')
    const generated = await new PortfolioPipeline().generate(input)
    const note = `AI design fell back to the portfolio template: ${reason}`
    const first = generated.pages[0]
    first.notes = [note, ...first.notes].slice(0, 8)
    await input.recorder?.pages(generated.pages)
    return { ...generated, fallback: { reason } }
  }

  async generate(input: GenerateInput): Promise<Generated> {
    const started = performance.now()
    const { options, guard, recorder } = input
    const stage = (s: Parameters<NonNullable<typeof recorder>['stage']>[0]) => recorder?.stage(s)
    const images = new AiDesignImages()
    const writer = new AiDesignWriter()
    let tokens = 0

    await stage('planning')
    const digest = await buildDigest(input, images)
    await guard()
    let designed: DesignResult
    try {
      designed = await new AiDesigner(undefined, images).design({
        title: input.title,
        brief: input.brief,
        digest,
        guard,
      })
    } catch (error) {
      if (OpenRouterService.isUnusableOutput(error))
        return this.fallback(input, 'the model did not return a usable design.')
      throw error
    }
    tokens += designed.tokens
    if (designed.problems.length)
      return this.fallback(
        input,
        `the design still broke ${designed.problems.length} rule${designed.problems.length === 1 ? '' : 's'} after a retry (${designed.problems
          .slice(0, 3)
          .map((p) => p.message)
          .join(' ')}).`
      )
    const { design } = designed
    const models = { planner: designed.model, writer: writer.model(options) }
    const stored: StoredDesign = {
      kind: 'ai_design',
      title: input.title,
      thesis: design.pages[0]?.purpose ?? '',
      audience: '',
      coverageGaps: [],
      design: {
        system: design.system,
        pages: design.pages.map((p) => ({ purpose: p.purpose, frames: p.frames.length })),
      },
      pages: design.pages.map((p, i) => ({
        design: i === 0 ? 'cover' : 'ai_page',
        title: p.purpose.slice(0, 60),
        purpose: p.purpose,
        questions: p.questions,
        keyTerms: [],
        wantsImage: p.frames.some((f) => f.kind === 'image'),
      })),
    }
    await recorder?.plan(stored, models)
    await guard()

    await stage('retrieving')
    const found = await new RetrievalService().searchPages({
      context: input.context,
      documentId: input.documentId,
      pins: input.pins,
      guard,
      pages: pageQueries(design, input.title, input.brief),
      tokenBudget: DEPTH_TOKENS[options.depth],
    })
    const evidence = new Map(found.map((f) => [Number(f.key), f]))

    await stage('images')
    const assignments = options.images ? assignPictures(design.pages, digest.images) : []
    const placed = await images.place({
      context: input.context,
      documentId: input.documentId,
      assignments,
      guard,
    })

    await stage('writing')
    const ctx: WriteContext = {
      title: input.title,
      brief: input.brief,
      system: design.system,
      outline: design.pages.map((p, i) => ({ page: i + 1, purpose: p.purpose })),
      options,
      brand: await brandName(input.context, input.documentId),
      guard,
    }
    const written = new Map<number, WrittenPage>()
    for (let n = 0; n < design.pages.length; n += WRITE_CONCURRENCY) {
      await guard()
      const wave = design.pages.map((page, i) => ({ page, i })).slice(n, n + WRITE_CONCURRENCY)
      const earlier = [...written.entries()]
        .sort(([a], [b]) => a - b)
        .map(([i, w]) => ({ page: i + 1, summary: w.summary }))
        .filter((e) => e.summary)
      const results = await Promise.all(
        wave.map(({ page, i }) =>
          writer.write(
            ctx,
            page,
            i,
            evidence.get(i)?.chunks ?? [],
            earlier.filter((e) => e.page - 1 < i)
          )
        )
      )
      wave.forEach(({ i }, k) => {
        written.set(i, results[k])
        tokens += results[k].tokens
      })
    }

    // Every text frame is measured and fitted inside `write`; this stage is the check of the whole.
    await stage('fitting')
    const known = new Map<string, SourceChunk>()
    for (const c of digest.chunks) known.set(c.id, c)
    for (const e of evidence.values()) for (const c of [...e.chunks, ...e.extra]) known.set(c.id, c)

    await stage('composing')
    const sources = new Map<string, SourceInfo>()
    for (const [id, chunk] of known) sources.set(id, sourceInfo(chunk))
    const inputs: PageInput[] = design.pages.map((page, i) => ({
      page,
      texts: written.get(i)!.texts,
      pictures: placed.get(i) ?? new Map<string, FramePicture>(),
      claims: written.get(i)!.claims,
    }))
    const composed = composeAiDesign({
      system: design.system,
      pages: inputs,
      sources,
      footer: clip(input.title, FOOTER_MAX),
      brand: brandPalette(digest),
    })
    const parsed = parseCanvas(composed.canvas)
    if (!parsed.ok)
      return this.fallback(
        input,
        `the composed design was not a valid canvas (${parsed.problems
          .slice(0, 2)
          .map((p) => `${p.path} ${p.message}`)
          .join('; ')}).`
      )
    stored.sources = Object.fromEntries(
      [...new Set(inputs.flatMap((p) => [...p.texts.values()].flatMap((t) => t.chunks)))].flatMap(
        (id) => (sources.has(id) ? [[id, sources.get(id)!]] : [])
      )
    )
    await recorder?.plan(stored, models)

    const sizes = new Map<string, ImageSize>()
    for (const a of assignments) {
      const frame = placed.get(a.page)?.get(a.frame)
      if (frame) sizes.set(frame.imageId, { width: a.picture.width, height: a.picture.height })
    }
    const report = densityReport(composed.canvas, { images: sizes })
    const records: PageRecord[] = composed.canvas.sheets.map((_, i) => {
      const meta = composed.pages[i]
      if (meta.kind === 'sources') {
        const all = [
          ...new Set(inputs.flatMap((p) => [...p.texts.values()].flatMap((t) => t.chunks))),
        ]
        return {
          index: i,
          design: 'sources',
          status: 'fitted',
          purpose: 'Sources: the documents the pages cite.',
          queries: [],
          chunkIds: [],
          citedChunkIds: all,
          imageIds: [],
          content: null,
          wordCount: null,
          fillRatio: null,
          attempts: 1,
          notes: [],
        }
      }
      const page: DesignPage = design.pages[i]
      const w = written.get(i)!
      const cited = [...new Set([...w.texts.values()].flatMap((t) => t.chunks))]
      return {
        index: i,
        design: i === 0 ? 'cover' : 'ai_page',
        status: 'fitted',
        purpose: page.purpose,
        queries: pageQueries(design, input.title, input.brief)[i].queries,
        chunkIds: w.supplied.map((c) => c.id),
        citedChunkIds: cited,
        imageIds: [...(placed.get(i)?.values() ?? [])].map((p) => p.imageId),
        content: {
          page: { purpose: page.purpose, questions: page.questions },
          texts: Object.fromEntries(w.texts),
          claims: w.claims,
          summary: w.summary,
        },
        wordCount: meta.words,
        fillRatio: meta.fill,
        attempts: w.attempts,
        notes: [
          ...(i === 0 ? [...designed.notes, ...design.reviewer_notes] : []),
          ...w.notes,
        ].slice(0, 8),
      }
    })
    await recorder?.pages(records)
    const filled = composed.pages.filter((p) => p.kind === 'design' && p.fill !== null)
    const metrics: CanvasRunMetrics = {
      pages: composed.canvas.sheets.length,
      words: report.words,
      avgFill: filled.length
        ? Number((filled.reduce((n, p) => n + (p.fill ?? 0), 0) / filled.length).toFixed(3))
        : 0,
      citations: report.citations,
      placeholders: 0,
      lowDpiImages: report.lowDpiImages,
      durationMs: Math.round(performance.now() - started),
      tokens,
    }
    return {
      canvas: composed.canvas,
      plan: {
        thesis: stored.thesis,
        audience: stored.audience,
        coverageGaps: [],
        pages: stored.pages,
      },
      pages: records,
      report,
      metrics,
      models,
      evidence: Object.fromEntries([...known].map(([id, chunk]) => [id, chunk.content])),
    }
  }
}
