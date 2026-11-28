import logger from '@adonisjs/core/services/logger'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import DocumentImage from '#models/document_image'
import DocumentImageService from '#services/documents/document_image_service'
import ImageVariantService from '#services/documents/image_variant_service'
import type { ImageEvidence } from '#services/documents/retrieval_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import {
  isDuplicate,
  printDpi,
  rejection,
  scoreCandidate,
} from '../../../../shared/canvas/image_rules.ts'
import ImageGenerationService, {
  ILLUSTRATION_LABEL,
  ImageGenerationFailure,
} from '#services/canvas/image_generation_service'
import type { PortfolioImage } from '../../../../shared/canvas/portfolio/compose.ts'
import type { PlanEntry } from '../../../../shared/canvas/portfolio/content.ts'
import { figureCells } from '../../../../shared/canvas/portfolio/tokens.ts'

/** Pictures an entry's figure frame holds. */
export const MAX_PICTURES = 4
/** Shortest edge a picture may have in a figure cell, in pixels. */
const MIN_EDGE = 300
/** A picture scoring under this is not relevant enough to print beside an entry. */
const MIN_SCORE = 0.3

export type PictureChoice = {
  imageId: string | null
  origin: 'upload' | 'source' | 'generated'
  description: string
  width: number
  height: number
  score: number
  phash: string | null
  chunkId?: string
  contents?: Buffer
  filename?: string
}

const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3)
  )

/** Share of the page's words that also describe the picture, 0 to 1. */
function overlap(page: string, picture: string) {
  const a = words(page)
  const b = words(picture)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of b) if (a.has(w)) shared++
  return Math.min(1, shared / Math.min(b.size, 6))
}

/** Entries illustrated at once: each call takes up to a minute, and each costs a few cents. */
const GENERATION_CONCURRENCY = 3

/** The page fields an entry's illustration is made from. */
export type IllustrationSubject = { title: string; intro?: string; category?: string }

const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' }

const sentence = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim()
  const first = /^.*?[.!?](?=\s|$)/.exec(clean)?.[0] ?? clean
  return (first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first).trim()
}

/**
 * Pictures for the entries' figure frames: the document's own uploads and the pictures the entry's
 * evidence matched, with the unusable dropped (too small, too narrow, a duplicate), scored against
 * the entry, up to four each and never the same picture twice. Source pictures are registered as
 * document images when placed, so a canvas only ever shows document images.
 */
export default class PortfolioImagePlanner {
  constructor(private variants = new ImageVariantService()) {}

  private async load(ev: ImageEvidence, guard: () => Promise<void>) {
    if (!ev.fileKey) return null
    await guard()
    try {
      const contents = Buffer.from(await drive.use().getBytes(ev.fileKey))
      const extension = EXTENSION[ev.chunk.mediaType ?? ''] ?? 'png'
      const filename = `${ev.chunk.fileName.replace(/\.[^.]+$/, '')}-p${ev.chunk.pageNumber ?? 0}.${extension}`
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

  async select(input: {
    context: WorkspaceAccessContext
    documentId: string
    entries: readonly PlanEntry[]
    evidence: Map<number, ImageEvidence[]>
    guard: () => Promise<void>
  }): Promise<Map<number, PictureChoice[]>> {
    const choices = new Map<number, PictureChoice[]>()
    const own = await DocumentImage.query()
      .where({ workspaceId: input.context.workspaceId, documentId: input.documentId })
      .whereNotNull('width')
      .whereNotNull('height')
    const uploads = own.filter((image) => image.origin === 'upload')
    const used = { keys: new Set<string>(), hashes: [] as string[] }
    for (const [index, entry] of input.entries.entries()) {
      const subject = [entry.title, entry.purpose, ...entry.questions, ...entry.keyTerms].join(' ')
      const found: PictureChoice[] = []
      for (const image of uploads) {
        if (used.keys.has(`upload:${image.id}`)) continue
        const text = [image.caption, image.altText, image.filename].filter(Boolean).join(' ')
        if (
          rejection(
            { width: image.width!, height: image.height!, bytes: image.byteSize },
            MIN_EDGE
          ) ||
          (image.phash && isDuplicate(image.phash, used.hashes))
        )
          continue
        found.push({
          imageId: image.id,
          origin: 'upload',
          description: text || image.filename,
          width: image.width!,
          height: image.height!,
          phash: image.phash,
          // A picture the author uploaded was put there on purpose: it starts ahead.
          score: scoreCandidate({ similarity: 0.25 + 0.75 * overlap(subject, text) }),
        })
      }
      for (const ev of input.evidence.get(index) ?? []) {
        if (used.keys.has(`chunk:${ev.chunk.id}`)) continue
        const file = await this.load(ev, input.guard)
        if (!file) continue
        if (
          rejection(
            { width: file.width, height: file.height, bytes: file.contents.length },
            MIN_EDGE
          ) ||
          isDuplicate(file.phash, used.hashes)
        )
          continue
        found.push({
          imageId: null,
          origin: 'source',
          description: ev.chunk.content.slice(0, 600),
          width: file.width,
          height: file.height,
          phash: file.phash,
          chunkId: ev.chunk.id,
          contents: file.contents,
          filename: file.filename,
          score: scoreCandidate({ similarity: ev.score }),
        })
      }
      // Taken one by one, so a near-duplicate within this entry is skipped as well.
      const best: PictureChoice[] = []
      const ranked = found.filter((c) => c.score >= MIN_SCORE).sort((a, b) => b.score - a.score)
      for (const c of ranked) {
        if (best.length >= MAX_PICTURES) break
        const key = c.imageId ? `upload:${c.imageId}` : `chunk:${c.chunkId}`
        if (used.keys.has(key) || (c.phash && isDuplicate(c.phash, used.hashes))) continue
        best.push(c)
        used.keys.add(key)
        if (c.phash) used.hashes.push(c.phash)
      }
      if (best.length) choices.set(index, best)
    }
    return choices
  }

  /**
   * When `CANVAS_IMAGE_GENERATION=on`, one illustrative AI picture for each entry that has no
   * usable source or uploaded picture, from the entry's title, intro and category. Adds them to
   * `choices` and never touches an entry that already has a picture. A picture that cannot be made
   * leaves the entry without a figure frame and returns a reviewer note; this never throws for a
   * provider failure. The pictures are stored as `generated` document images, with no source
   * chunk, so they stay out of citations, the sources pages and claim review.
   */
  async illustrate(input: {
    context: WorkspaceAccessContext
    documentId: string
    pages: readonly IllustrationSubject[]
    choices: Map<number, PictureChoice[]>
    guard: () => Promise<void>
    service?: ImageGenerationService
  }): Promise<Map<number, string[]>> {
    const notes = new Map<number, string[]>()
    if (!ImageGenerationService.enabled()) return notes
    const service = input.service ?? new ImageGenerationService()
    const missing = input.pages.map((_, i) => i).filter((i) => !input.choices.has(i))
    const make = async (i: number) => {
      await input.guard()
      const page = input.pages[i]
      try {
        const image = await service.generateAndStore(input.context, input.documentId, {
          prompt: ImageGenerationService.illustrationPrompt(page),
          altText: sentence(page.title, 200),
        })
        input.choices.set(i, [
          {
            imageId: image.id,
            origin: 'generated',
            description: ILLUSTRATION_LABEL,
            width: image.width ?? 0,
            height: image.height ?? 0,
            score: 1,
            phash: image.phash,
          },
        ])
        notes.set(i, [
          'This entry has no source picture. Its figure is an AI-generated illustration, not evidence.',
        ])
      } catch (error) {
        const reason =
          error instanceof ImageGenerationFailure
            ? error.message
            : 'the picture could not be stored'
        logger.warn({ documentId: input.documentId, entry: i, reason }, 'Illustration failed')
        notes.set(i, [
          `This entry has no source picture and an AI illustration could not be made (${reason}). The figure frame was left out.`,
        ])
      }
    }
    for (let n = 0; n < missing.length; n += GENERATION_CONCURRENCY)
      await Promise.all(missing.slice(n, n + GENERATION_CONCURRENCY).map(make))
    return notes
  }

  /** Registers the chosen source pictures as document images and returns the entries' pictures. */
  async place(input: {
    context: WorkspaceAccessContext
    documentId: string
    choices: Map<number, PictureChoice[]>
    guard: () => Promise<void>
  }): Promise<Map<number, (PortfolioImage & { dpi: number })[]>> {
    const placed = new Map<number, (PortfolioImage & { dpi: number })[]>()
    for (const [index, list] of input.choices) {
      // Resolve every choice first, so the cells match the pictures that are actually placed.
      const resolved: { image: DocumentImage; choice: PictureChoice; text: string }[] = []
      for (const choice of list) {
        await input.guard()
        let image: DocumentImage | null = null
        const text = choice.description.replace(/\s+/g, ' ').trim()
        if (choice.imageId) image = await DocumentImage.find(choice.imageId)
        else if (choice.contents && choice.chunkId)
          image = await new DocumentImageService().promote(input.context, input.documentId, {
            filename: choice.filename ?? 'source.png',
            contents: choice.contents,
            chunkId: choice.chunkId,
            caption: sentence(text || 'Picture from the sources', 200),
            altText: sentence(text || 'Picture from the sources', 250),
          })
        if (!image) continue
        choice.imageId = image.id
        resolved.push({ image, choice, text })
      }
      const cells = figureCells(resolved.length)
      const pictures: (PortfolioImage & { dpi: number })[] = []
      for (const [i, { image, choice, text }] of resolved.entries()) {
        const cell = cells[i] ?? cells[0]
        pictures.push({
          imageId: image.id,
          alt: image.altText ?? image.caption ?? sentence(text, 250),
          ...(image.origin === 'generated' ? { generated: true as const } : {}),
          dpi: printDpi(choice, { w: cell.w * 3.5278, h: cell.h * 3.5278 }),
        })
      }
      if (pictures.length) placed.set(index, pictures)
    }
    return placed
  }
}
