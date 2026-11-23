import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import sharp from 'sharp'
import config from '#config/open_router'
import DocumentImage from '#models/document_image'
import DocumentImageService from '#services/documents/document_image_service'
import ImageVariantService from '#services/documents/image_variant_service'
import OpenRouterService from '#services/open_router_service'
import type { ImageEvidence } from '#services/documents/retrieval_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { AcademicImage } from '../../../../shared/canvas/academic/compose.ts'
import type { PagePlan } from '../../../../shared/canvas/academic/content.ts'
import {
  ACADEMIC_DESIGNS,
  SLOTS,
  type AcademicDesignId,
  type ImageSlot,
} from '../../../../shared/canvas/academic/designs.ts'
import type { CanvasOptions } from '../../../../shared/canvas/academic/options.ts'
import {
  aspectClass,
  designForAspect,
  isDuplicate,
  printDpi,
  rejection,
  scoreCandidate,
} from '../../../../shared/canvas/image_rules.ts'
import type { Geo } from '../../../../shared/canvas/model.ts'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'

/** A picture chosen for a page, before and after it is registered as a document image. */
export type ImageChoice = {
  /** The document image; null until a source image is promoted. */
  imageId: string | null
  origin: 'upload' | 'source'
  slot: ImageSlot
  /** What the picture is, for the writer and the caption. */
  description: string
  width: number
  height: number
  score: number
  phash: string | null
  focus?: { x: number; y: number } | null
  caption?: string | null
  alt?: string | null
  /** The source chunk a promoted image came from. */
  chunkId?: string
  /** Where a source picture comes from, printed after its caption. */
  source?: string | null
  /** Bytes of a source picture, held until it is promoted. */
  contents?: Buffer
  filename?: string
}

export type ImageSelectInput = {
  context: WorkspaceAccessContext
  documentId: string
  options: CanvasOptions
  /** The plan; `select` may switch a figure page between its landscape and portrait design. */
  pages: PagePlan[]
  /** Image chunks that matched each page, by page index. */
  evidence: Map<number, ImageEvidence[]>
  /** The text chunks each page draws on, to find pictures from the same source page. */
  chunks?: Map<number, SourceChunk[]>
  guard: () => Promise<void>
}

const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3)
  )

/** Share of the page's words that also describe the picture, 0 to 1. */
export function overlap(page: string, picture: string) {
  const a = words(page)
  const b = words(picture)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of b) if (a.has(w)) shared++
  return Math.min(1, shared / Math.min(b.size, 6))
}

const IMAGE_SLOT_GEO: Partial<Record<AcademicDesignId, Geo>> = {
  figure_text: SLOTS.figure_text.image,
  side_figure: SLOTS.side_figure.image,
  case_box: SLOTS.case_box.image,
  title_page: SLOTS.title_page.image,
}

const sentence = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim()
  const first = /^.*?[.!?](?=\s|$)/.exec(clean)?.[0] ?? clean
  return (first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first).trim()
}

const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' }

/**
 * Stage 5. `select` runs before the pages are written, so the lead of a figure page
 * can say what the figure shows: it looks at the document's own pictures and at
 * the pictures the page's evidence matched, drops the unusable (too small, too
 * narrow, a duplicate of one already placed), scores the rest against the page and
 * chooses the best; the picture's shape picks the page's design. `place` runs after
 * the fit: it captions each chosen picture and registers source pictures with the
 * document, so a canvas only ever shows document images.
 */
export default class CanvasImagePlanner {
  constructor(
    private provider = new OpenRouterService(),
    private variants = new ImageVariantService()
  ) {}

  /** Bytes, size and hash of a source picture; null when it is not a usable PNG or JPEG. */
  private async load(ev: ImageEvidence, guard: () => Promise<void>) {
    if (!ev.fileKey) return null
    await guard()
    try {
      const contents = Buffer.from(await drive.use().getBytes(ev.fileKey))
      const extension = EXTENSION[ev.chunk.mediaType ?? ''] ?? 'png'
      const filename = `${ev.chunk.fileName.replace(/\.[^.]+$/, '')}-p${ev.chunk.pageNumber ?? 0}.${extension}`
      // Only what the document image rules accept: a well-formed PNG or JPEG.
      DocumentImageService.mime(filename, contents)
      const meta = await sharp(contents, { pages: 1 }).rotate().metadata()
      const rotated = (meta.orientation ?? 1) >= 5
      const width = (rotated ? meta.height : meta.width) ?? 0
      const height = (rotated ? meta.width : meta.height) ?? 0
      if (!width || !height) return null
      return { contents, filename, width, height, phash: await this.variants.phash(contents) }
    } catch {
      return null
    }
  }

  async select(input: ImageSelectInput): Promise<Map<number, ImageChoice>> {
    const { pages, options } = input
    const choices = new Map<number, ImageChoice>()
    if (!options.images) return choices
    const own = await DocumentImage.query()
      .where({ workspaceId: input.context.workspaceId, documentId: input.documentId })
      .whereNotNull('width')
      .whereNotNull('height')
    const uploads = own.filter((image) => image.origin === 'upload')
    const used = { keys: new Set<string>(), hashes: [] as string[] }
    const loaded = new Map<string, Awaited<ReturnType<CanvasImagePlanner['load']>>>()

    const consider = async (index: number, page: PagePlan, slot: ImageSlot) => {
      const subject = [page.title, page.purpose, ...page.questions, ...page.keyTerms].join(' ')
      const siblings = input.chunks?.get(index) ?? []
      const found: ImageChoice[] = []
      for (const image of uploads) {
        const key = `upload:${image.id}`
        const text = [image.caption, image.altText, image.filename].filter(Boolean).join(' ')
        const bad = rejection(
          { width: image.width!, height: image.height!, bytes: image.byteSize },
          slot.minEdge
        )
        if (bad || (image.phash && isDuplicate(image.phash, used.hashes))) continue
        // A picture the author uploaded was put there on purpose: it starts ahead.
        found.push({
          imageId: image.id,
          origin: 'upload',
          slot,
          description: text || image.filename,
          width: image.width!,
          height: image.height!,
          phash: image.phash,
          focus:
            image.focusX !== null && image.focusY !== null
              ? { x: image.focusX, y: image.focusY }
              : null,
          caption: image.caption,
          alt: image.altText,
          score: scoreCandidate({
            similarity: 0.25 + 0.75 * overlap(subject, text),
            alreadyUsed: used.keys.has(key),
          }),
        })
      }
      for (const ev of input.evidence.get(index) ?? []) {
        const key = `chunk:${ev.chunk.id}`
        if (!loaded.has(key)) loaded.set(key, await this.load(ev, input.guard))
        const file = loaded.get(key)
        if (!file) continue
        const bad = rejection(
          { width: file.width, height: file.height, bytes: file.contents.length },
          slot.minEdge
        )
        if (bad || isDuplicate(file.phash, used.hashes)) continue
        found.push({
          imageId: null,
          origin: 'source',
          slot,
          description: ev.chunk.content.slice(0, 600),
          width: file.width,
          height: file.height,
          phash: file.phash,
          chunkId: ev.chunk.id,
          contents: file.contents,
          filename: file.filename,
          source: `${ev.chunk.fileName}${ev.chunk.pageNumber ? `, p. ${ev.chunk.pageNumber}` : ''}`,
          score: scoreCandidate({
            similarity: ev.score,
            sameSourcePage: siblings.some(
              (s) => s.fileName === ev.chunk.fileName && s.pageNumber === ev.chunk.pageNumber
            ),
            alreadyUsed: used.keys.has(key),
          }),
        })
      }
      return found.sort((a, b) => b.score - a.score)[0]
    }
    const take = (index: number, choice: ImageChoice) => {
      choices.set(index, choice)
      used.keys.add(choice.imageId ? `upload:${choice.imageId}` : `chunk:${choice.chunkId}`)
      if (choice.phash) used.hashes.push(choice.phash)
    }

    for (const [index, page] of pages.entries()) {
      const slot = ACADEMIC_DESIGNS[page.design].images[0]
      if (!slot || page.design === 'title_page') continue
      // An optional picture is only looked for when the planner asked for one.
      if (slot.optional && !page.wantsImage) continue
      const best = await consider(index, page, slot)
      if (!best) continue
      // A figure page takes the design its picture's shape asks for.
      if (!slot.optional) page.design = designForAspect(aspectClass(best.width, best.height))
      take(index, { ...best, slot: ACADEMIC_DESIGNS[page.design].images[0] })
    }
    // A landscape upload nothing else used becomes the title page's hero picture.
    const hero = pages.findIndex((p) => p.design === 'title_page')
    if (hero >= 0) {
      const slot = ACADEMIC_DESIGNS.title_page.images[0]
      const best = (await consider(hero, pages[hero], slot).catch(() => undefined)) as
        ImageChoice | undefined
      if (best?.origin === 'upload' && aspectClass(best.width, best.height) === 'landscape')
        take(hero, best)
    }
    return choices
  }

  /** The caption and alt text of a picture: its own, its source's description, or a model's. */
  private async describe(choice: ImageChoice, page: PagePlan, guard: () => Promise<void>) {
    if (choice.caption && choice.alt) return { caption: choice.caption, alt: choice.alt }
    const text = choice.description.replace(/\s+/g, ' ').trim()
    if (choice.caption) return { caption: choice.caption, alt: choice.alt ?? choice.caption }
    if (text.length >= 20) {
      const caption = sentence(text, 200)
      return { caption, alt: sentence(text, 250) }
    }
    try {
      return await this.provider.captionCanvasImage(
        {
          model: config.canvasPlannerModel,
          context: JSON.stringify({
            page: { title: page.title, purpose: page.purpose },
            description: text || 'No description is available.',
          }),
        },
        guard
      )
    } catch (error) {
      logger.warn({ err: error }, 'Figure caption failed; using the page title')
      return { caption: page.title, alt: page.title }
    }
  }

  async place(
    input: ImageSelectInput & { choices: Map<number, ImageChoice> }
  ): Promise<Map<number, AcademicImage & { dpi: number | null }>> {
    const placed = new Map<number, AcademicImage & { dpi: number | null }>()
    for (const [index, choice] of input.choices) {
      const page = input.pages[index]
      // The page may have lost its picture slot (a design change after the choice).
      if (!page || !ACADEMIC_DESIGNS[page.design].images.length) continue
      await input.guard()
      const { caption, alt } = await this.describe(choice, page, input.guard)
      let image: DocumentImage | null = null
      if (choice.imageId) {
        image = await DocumentImage.find(choice.imageId)
        // Keep what the author wrote; otherwise store the caption so it can be edited.
        if (image && (!image.caption || !image.altText)) {
          image.merge({ caption: image.caption ?? caption, altText: image.altText ?? alt })
          await image.save()
        }
      } else if (choice.contents && choice.chunkId) {
        image = await new DocumentImageService().promote(input.context, input.documentId, {
          filename: choice.filename ?? 'source.png',
          contents: choice.contents,
          chunkId: choice.chunkId,
          caption,
          altText: alt,
        })
      }
      if (!image) continue
      choice.imageId = image.id
      const geo = IMAGE_SLOT_GEO[page.design]
      placed.set(index, {
        imageId: image.id,
        alt: image.altText ?? alt,
        caption: image.caption ?? caption,
        source: choice.source ?? null,
        focus:
          image.focusX !== null && image.focusY !== null
            ? { x: image.focusX, y: image.focusY }
            : (choice.focus ?? null),
        dpi: geo ? printDpi(choice, geo) : null,
      })
    }
    return placed
  }
}
