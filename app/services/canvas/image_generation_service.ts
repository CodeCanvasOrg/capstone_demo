import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import sharp from 'sharp'
import type DocumentImage from '#models/document_image'
import type { GenerationRecord } from '#models/document_image'
import DocumentImageService from '#services/documents/document_image_service'
import OpenRouterService from '#services/open_router_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import { COLORS, figureCells, ILLUSTRATION_LABEL } from '../../../shared/canvas/portfolio/tokens.ts'

/** Model used when `CANVAS_IMAGE_MODEL` is not set (docs/image-generation-research.md). */
export const DEFAULT_IMAGE_MODEL = 'google/gemini-3.1-flash-image'
export { ILLUSTRATION_LABEL }

/** Pixels of the single-picture figure cell at 300 dpi: what a generated picture is fitted to. */
export const PRINT_SIZE = (() => {
  const cell = figureCells(1)[0]
  return { width: Math.round((cell.w / 72) * 300), height: Math.round((cell.h / 72) * 300) }
})()
/** Shortest edge a model's picture may have: under this it would print soft after fitting. */
const MIN_SOURCE_EDGE = 640
/** The largest the fitting may enlarge a picture; beyond it the print would be visibly soft. */
const MAX_ENLARGE = 1.6
/** The stored original stays under the document image limit of 10 MB. */
const MAX_BYTES = 9 * 1024 * 1024

export type ImageReference = { bytes: Buffer; mime: string }

export type GeneratedImage = {
  /** Fitted to `PRINT_SIZE`; PNG, or JPEG when the PNG would be too large to store. */
  bytes: Buffer
  mime: 'image/png' | 'image/jpeg'
  width: number
  height: number
  record: GenerationRecord
}

/** What the provider returns, so tests and callers can stand in for it. */
export type ImageProvider = (input: {
  model: string
  prompt: string
  references: ImageReference[]
}) => ReturnType<OpenRouterService['generateImage']>

let override: ImageProvider | null = null

export class ImageGenerationFailure extends Error {
  constructor(
    message: string,
    readonly reason: 'provider' | 'refused' | 'unusable'
  ) {
    super(message)
  }
}

/**
 * Pictures from an image-output model, for places where the author has none: illustrations only.
 * They are fitted to the print size, stored as `generated` document images with the model and
 * prompt kept for audit, and never carry a source chunk, so nothing can cite them as evidence.
 * Off unless `CANVAS_IMAGE_GENERATION=on`. Callers (the portfolio image planner, the AI design
 * pipeline) must label what they place with `ILLUSTRATION_LABEL` and never put one where a real
 * source picture exists.
 */
export default class ImageGenerationService {
  static enabled() {
    return env.get('CANVAS_IMAGE_GENERATION') === 'on'
  }

  static model() {
    return env.get('CANVAS_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL
  }

  /** Tests only: replaces the provider call. Pair with `restore`. */
  static fake(provider: ImageProvider) {
    override = provider
  }

  static restore() {
    override = null
  }

  /**
   * The prompt for an entry's illustration: its title, intro and category, in the Navy/Gold style,
   * with no text, people or data graphics that could pass for evidence.
   */
  static illustrationPrompt(entry: { title: string; intro?: string; category?: string }) {
    const clean = (text: string | undefined, max: number) =>
      (text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
    return [
      'Create a portrait editorial illustration to sit beside one page of a project portfolio.',
      `Subject: ${clean(entry.title, 120)}.`,
      entry.category ? `Category: ${clean(entry.category, 40)}.` : '',
      entry.intro ? `Theme: ${clean(entry.intro, 300)}` : '',
      `Style: flat, minimal, abstract vector illustration. Palette: deep navy ${COLORS.navy}, warm gold ${COLORS.gold}, off-white ${COLORS.paper}, with at most one muted accent. Generous negative space, calm composition.`,
      'Strict rules: no text, no letters, no numbers, no logos, no watermarks, no charts, graphs, tables, maps or screenshots, no recognisable people or faces. It must read clearly as an illustration, not a photograph or a document.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  /**
   * One picture from the prompt (and optional reference pictures), fitted to the print size.
   * Throws `ImageGenerationFailure` for a provider error, a refusal or a picture too small to
   * print; callers treat that as "no picture" and carry on.
   */
  async generate(input: {
    prompt: string
    references?: ImageReference[]
    guard?: () => Promise<void>
  }): Promise<GeneratedImage> {
    // The caller's guard (a lost lease, a cancelled run) is not a provider failure: it propagates.
    await input.guard?.()
    const model = ImageGenerationService.model()
    const references = input.references ?? []
    let result: Awaited<ReturnType<ImageProvider>>
    try {
      const call: ImageProvider =
        override ?? ((i) => new OpenRouterService().generateImage({ ...i, imageSize: '1K' }))
      result = await call({ model, prompt: input.prompt, references })
    } catch (error) {
      const failure = error as { status?: number; unusableOutput?: boolean; name?: string }
      if (failure.unusableOutput)
        throw new ImageGenerationFailure('The model returned no picture.', 'refused')
      logger.warn(
        { status: failure.status, name: failure.name, model },
        'Image generation call failed'
      )
      throw new ImageGenerationFailure(
        failure.status
          ? `The image model failed (${failure.status}).`
          : 'The image model did not answer in time.',
        'provider'
      )
    }
    const fitted = await this.fit(result.bytes)
    return {
      ...fitted,
      record: {
        model,
        prompt: input.prompt,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        sourceWidth: fitted.sourceWidth,
        sourceHeight: fitted.sourceHeight,
        referenceCount: references.length,
        at: new Date().toISOString(),
      },
    }
  }

  /** Generates a picture and registers it as a `generated` document image. */
  async generateAndStore(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      prompt: string
      /** Alt text of the picture, describing what it shows. */
      altText: string
      references?: ImageReference[]
      guard?: () => Promise<void>
    }
  ): Promise<DocumentImage> {
    const made = await this.generate(input)
    const extension = made.mime === 'image/png' ? 'png' : 'jpg'
    return new DocumentImageService().storeGenerated(context, documentId, {
      filename: `generated-illustration.${extension}`,
      contents: made.bytes,
      caption: ILLUSTRATION_LABEL,
      altText: `${ILLUSTRATION_LABEL}: ${input.altText}`.slice(0, 300),
      generation: made.record,
    })
  }

  /** Validates the model's picture and fits it to the print size: cover crop, then resize. */
  private async fit(bytes: Buffer) {
    let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>
    try {
      meta = await sharp(bytes, { pages: 1 }).metadata()
    } catch {
      throw new ImageGenerationFailure(
        'The model returned a file that is not a picture.',
        'unusable'
      )
    }
    const sourceWidth = meta.width ?? 0
    const sourceHeight = meta.height ?? 0
    if (Math.min(sourceWidth, sourceHeight) < MIN_SOURCE_EDGE)
      throw new ImageGenerationFailure('The picture is too small to print.', 'unusable')
    // The crop that has the frame's ratio, then how much it must grow (never shrink-then-grow).
    const ratio = PRINT_SIZE.width / PRINT_SIZE.height
    const cropWidth = Math.min(sourceWidth, Math.round(sourceHeight * ratio))
    if (PRINT_SIZE.width / cropWidth > MAX_ENLARGE)
      throw new ImageGenerationFailure('The picture is too small to print.', 'unusable')
    const base = sharp(bytes, { pages: 1 })
      .rotate()
      .flatten({ background: COLORS.paper })
      .toColourspace('srgb')
      .resize({
        width: PRINT_SIZE.width,
        height: PRINT_SIZE.height,
        fit: 'cover',
        position: 'centre',
        kernel: 'lanczos3',
      })
    let out = await base.clone().png({ compressionLevel: 9 }).toBuffer()
    let mime: GeneratedImage['mime'] = 'image/png'
    if (out.length > MAX_BYTES) {
      out = await base.clone().jpeg({ quality: 92, mozjpeg: true }).toBuffer()
      mime = 'image/jpeg'
    }
    return {
      bytes: out,
      mime,
      width: PRINT_SIZE.width,
      height: PRINT_SIZE.height,
      sourceWidth,
      sourceHeight,
    }
  }
}
