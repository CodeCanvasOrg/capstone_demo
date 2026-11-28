import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import type { CanvasOptions } from '../../../../shared/canvas/options.ts'
import type { FrameText } from '../../../../shared/canvas/ai_design/compose.ts'
import type {
  DesignPage,
  DesignPageContent,
  DesignSystem,
  PageClaim,
} from '../../../../shared/canvas/ai_design/schema.ts'
import {
  cleanFrameText,
  frameLines,
  frameProblems,
  trimToFrame,
} from '../../../../shared/canvas/ai_design/fit.ts'
import {
  charBudget,
  fitsFrame,
  isTextRole,
  measureText,
  resolveText,
} from '../../../../shared/canvas/ai_design/style.ts'
import {
  CITED_ROLES,
  citeCorrective,
  fitCorrective,
  type FrameBrief,
  writerSystem,
  writerUser,
} from './ai_design_prompts.ts'

/** Model rounds a page may spend repairing citations before the notes below apply. */
const ROUNDS = 2

export type WriteContext = {
  title: string
  brief: string
  system: DesignSystem
  outline: { page: number; purpose: string }[]
  options: CanvasOptions
  brand?: string
  guard: () => Promise<void>
}

export type WrittenPage = {
  texts: Map<string, FrameText>
  claims: PageClaim[]
  summary: string
  notes: string[]
  /** Model calls this page took. */
  attempts: number
  tokens: number
  supplied: SourceChunk[]
}

type Frame = DesignPage['frames'][number]

/** The text frames of a page that the writer fills: the ones with a text role. */
export const textFrames = (page: Pick<DesignPage, 'frames'>) =>
  page.frames.filter((f) => f.kind === 'text' && isTextRole(f.role))

/**
 * The model call that writes one designed page. The text is cleaned with the portfolio's copy rules,
 * checked for citations and numbers (corrected up to twice), then every frame is measured against its
 * own box: one condense call, then a deterministic cut at a sentence or word.
 */
export default class AiDesignWriter {
  constructor(private provider = new OpenRouterService()) {}

  /** The writing model: the planner's for concise depth, the writer's otherwise (as the portfolio's). */
  model(options: CanvasOptions) {
    return options.depth === 'concise' ? config.canvasPlannerModel : config.canvasWriterModel
  }

  private briefs(page: DesignPage, system: DesignSystem): FrameBrief[] {
    return textFrames(page).map((f) => {
      const budget = charBudget(f, resolveText(f, system))
      return {
        id: f.id,
        role: f.role,
        brief: f.brief?.trim() || f.role,
        lines: budget.lines,
        chars: Math.max(Math.round(budget.chars * 0.85), 1),
        cite: CITED_ROLES.has(f.role),
      }
    })
  }

  /** The model's frames, cleaned and limited to the frames and chunks that were supplied. */
  private clean(
    raw: DesignPageContent,
    frames: readonly Frame[],
    allowed: ReadonlySet<string>,
    brand?: string
  ) {
    const ids = new Set(frames.map((f) => f.id))
    const notes: string[] = []
    const texts = new Map<string, FrameText>()
    let dropped = false
    for (const item of raw.frames) {
      if (!ids.has(item.id) || texts.has(item.id)) continue
      const cleaned = cleanFrameText(item.text, brand)
      for (const gap of cleaned.gaps) notes.push(`Not in the sources: ${gap}`)
      const chunks = item.chunks.filter((id) => allowed.has(id) || ((dropped = true), false))
      texts.set(item.id, { text: cleaned.text, chunks })
    }
    if (dropped) notes.push('A citation pointed at a source that was not supplied and was removed.')
    return { texts, notes }
  }

  async write(
    ctx: WriteContext,
    page: DesignPage,
    index: number,
    chunks: SourceChunk[],
    earlier: { page: number; summary: string }[]
  ): Promise<WrittenPage> {
    const frames = textFrames(page)
    const briefs = this.briefs(page, ctx.system)
    const cited = new Map(briefs.map((b) => [b.id, b.cite]))
    const system = writerSystem()
    const user = writerUser({
      title: ctx.title,
      brief: ctx.brief,
      page: {
        number: index + 1,
        of: ctx.outline.length,
        purpose: page.purpose,
        questions: page.questions,
      },
      outline: ctx.outline,
      frames: briefs,
      earlier,
      chunks,
    })
    const allowed = new Set(chunks.map((c) => c.id))
    const evidence = new Map(chunks.map((c) => [c.id, c.content]))
    const model = this.model(ctx.options)
    let tokens = 0
    let calls = 0
    const call = async (corrections: string[]) => {
      const raw = await this.provider.writeDesignPage(
        { system, user, model, corrections },
        ctx.guard
      )
      calls++
      tokens +=
        countTokens(system) +
        countTokens(user) +
        corrections.reduce((n, c) => n + countTokens(c), 0) +
        countTokens(JSON.stringify(raw))
      return raw
    }
    const problemsOf = (texts: Map<string, FrameText>) =>
      [...texts].flatMap(([id, t]) =>
        frameProblems({ id, ...t, cite: cited.get(id) ?? false }, evidence)
      )
    const notes: string[] = []
    let raw = await call([])
    let cleaned = this.clean(raw, frames, allowed, ctx.brand)
    let problems = problemsOf(cleaned.texts)
    for (let round = 1; round <= ROUNDS && problems.length; round++) {
      raw = await call([`The previous page was:\n${JSON.stringify(raw)}`, citeCorrective(problems)])
      cleaned = this.clean(raw, frames, allowed, ctx.brand)
      problems = problemsOf(cleaned.texts)
    }
    for (const p of problems)
      notes.push(
        p.code === 'uncited'
          ? `${p.id} has no source; check it against the sources.`
          : `${p.id} has a number its sources do not contain (${p.detail}).`
      )

    // Fit: one condense call naming the frames over their space, then a deterministic cut.
    const geo = (f: Frame) => ({ w: f.w, h: f.h })
    const over = () =>
      frames.flatMap((f) => {
        const text = cleaned.texts.get(f.id)?.text
        const r = resolveText(f, ctx.system)
        return text && !fitsFrame(text, geo(f), r)
          ? [{ id: f.id, lines: measureText(text, geo(f), r).lines, max: frameLines(geo(f), r) }]
          : []
      })
    const issues = over()
    if (issues.length) {
      raw = await call([`The previous page was:\n${JSON.stringify(raw)}`, fitCorrective(issues)])
      const again = this.clean(raw, frames, allowed, ctx.brand)
      // A frame the condense call lost keeps its earlier text.
      for (const [id, t] of again.texts) if (t.text) cleaned.texts.set(id, t)
      cleaned.notes.push(...again.notes)
    }
    for (const f of frames) {
      const t = cleaned.texts.get(f.id)
      if (!t?.text) continue
      const fitted = trimToFrame(t.text, geo(f), resolveText(f, ctx.system))
      if (fitted.cut) {
        cleaned.texts.set(f.id, { ...t, text: fitted.text })
        notes.push(`${f.id} was cut to fit its frame.`)
      }
    }
    // A title the writer left empty is the document's title (cover) or the page's purpose.
    for (const f of frames) {
      if (f.role !== 'title' || cleaned.texts.get(f.id)?.text) continue
      const base = index === 0 ? ctx.title : page.purpose
      const fitted = trimToFrame(base, geo(f), resolveText(f, ctx.system))
      cleaned.texts.set(f.id, { text: fitted.text, chunks: [] })
    }
    for (const [id, t] of [...cleaned.texts]) if (!t.text) cleaned.texts.delete(id)
    const claims = raw.claims.filter((c) => cleaned.texts.has(c.frame))
    return {
      texts: cleaned.texts,
      claims,
      summary: raw.summary,
      notes: [...new Set([...raw.reviewer_notes, ...cleaned.notes, ...notes])].slice(0, 8),
      attempts: calls,
      tokens,
      supplied: chunks,
    }
  }
}
