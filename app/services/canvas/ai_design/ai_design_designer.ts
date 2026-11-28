import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import type { CanvasDesign } from '../../../../shared/canvas/ai_design/schema.ts'
import { normalizeDesign } from '../../../../shared/canvas/ai_design/normalize.ts'
import { validateDesign, type DesignProblem } from '../../../../shared/canvas/ai_design/validate.ts'
import { designCorrective, designSystemPrompt, designUser } from './ai_design_prompts.ts'
import AiDesignImages from './ai_design_images.ts'
import { excerptsOf, type Digest } from './ai_design_digest.ts'

export type DesignResult = {
  design: CanvasDesign
  /** What normalising changed, for the reviewer. */
  notes: string[]
  /** Rules the design still breaks after the corrective retry; empty when it is usable. */
  problems: DesignProblem[]
  /** Model calls made (1, or 2 with the corrective retry). */
  attempts: number
  tokens: number
  model: string
  /** Whether reference pictures were sent to the model. */
  sentImages: boolean
}

/**
 * The design step: one structured call, the geometry clamped, the rules checked, and one retry that
 * names every broken rule. The caller decides what an unusable design means (the pipeline falls back
 * to the portfolio template).
 */
export default class AiDesigner {
  constructor(
    private provider = new OpenRouterService(),
    private images = new AiDesignImages()
  ) {}

  model() {
    return config.canvasDesignModel
  }

  private check(raw: CanvasDesign, pages: number, brandFont: boolean) {
    // A longer list is only too long, and the application cuts it, as it does an over-long string.
    const trimmed = raw.pages.length > pages ? { ...raw, pages: raw.pages.slice(0, pages) } : raw
    const normalized = normalizeDesign(trimmed)
    const problems = validateDesign(normalized.design, { pages, allowBrandFont: brandFont })
    return { ...normalized, problems }
  }

  async design(input: {
    title: string
    brief: string
    digest: Digest
    guard: () => Promise<void>
  }): Promise<DesignResult> {
    const { digest, guard } = input
    const model = this.model()
    const brandFont = !!digest.brand
    const system = designSystemPrompt({ pages: digest.pageCount, brandFont })
    const user = designUser({
      title: input.title,
      brief: input.brief,
      pages: digest.pageCount,
      brand: digest.brand && {
        name: digest.brand.name,
        palette: digest.brand.palette,
        fontFamily: digest.brand.fontFamily,
      },
      files: [...new Set(digest.chunks.map((c) => c.fileName))],
      excerpts: excerptsOf(digest.chunks),
      images: digest.images.map((p) => ({
        ref: p.ref,
        origin: p.origin,
        width: p.width,
        height: p.height,
        aspect: p.aspect,
        caption: p.caption.slice(0, 200),
      })),
      note: digest.chunks.length ? undefined : 'There are no sources: design from the brief alone.',
    })
    // Pictures are sent only to a model that advertises image input.
    const thumbs =
      digest.images.length && (await this.provider.acceptsImageInput(model))
        ? await this.images.thumbnails(digest.images, guard)
        : []
    let tokens = countTokens(system) + countTokens(user)
    const first = await this.provider.designCanvas(
      { system, user, model, images: thumbs.length ? thumbs : undefined },
      guard
    )
    tokens += countTokens(JSON.stringify(first))
    let checked = this.check(first, digest.pageCount, brandFont)
    let attempts = 1
    if (checked.problems.length) {
      const again = await this.provider.designCanvas(
        {
          system,
          user,
          model,
          images: thumbs.length ? thumbs : undefined,
          corrections: [designCorrective(first, checked.problems)],
        },
        guard
      )
      tokens += countTokens(JSON.stringify(again))
      attempts = 2
      checked = this.check(again, digest.pageCount, brandFont)
    }
    return {
      design: checked.design,
      notes: checked.notes,
      problems: checked.problems,
      attempts,
      tokens,
      model,
      sentImages: thumbs.length > 0,
    }
  }
}
