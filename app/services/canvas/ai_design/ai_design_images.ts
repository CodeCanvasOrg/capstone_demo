import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import DocumentImage from '#models/document_image'
import DocumentImageService from '#services/documents/document_image_service'
import ImageVariantService from '#services/documents/image_variant_service'
import type { ImageEvidence } from '#services/documents/retrieval_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import {
  aspectClass,
  isDuplicate,
  rejection,
  scoreCandidate,
  type AspectClass,
} from '../../../../shared/canvas/image_rules.ts'
import type { DesignPage } from '../../../../shared/canvas/ai_design/schema.ts'
import type { FramePicture } from '../../../../shared/canvas/ai_design/compose.ts'
import PortfolioImagePlanner, { type PictureChoice } from '../portfolio/portfolio_image_planner.ts'

/** Shortest edge a picture may have, in pixels (the portfolio's rule). */
const MIN_EDGE = 300
/** A picture scoring under this is not relevant enough to place. */
const MIN_SCORE = 0.3
export const MAX_CANDIDATES = 10
/** Pictures sent to a model that accepts images, and their longest edge. */
export const MAX_THUMBNAILS = 4
const THUMB_EDGE = 512

export type Picture = {
  ref: string
  origin: 'upload' | 'source'
  /** Set when the picture is already a document image. */
  imageId: string | null
  chunkId?: string
  width: number
  height: number
  aspect: AspectClass
  caption: string
  phash: string | null
  bytes: number
  contents?: Buffer
  filename?: string
}

const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' }

const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3)
  )

/** Share of the picture's description words that the frame's subject also uses, 0 to 1. */
export function wordOverlap(subject: string, caption: string) {
  const a = words(subject)
  const b = words(caption)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of b) if (a.has(w)) shared++
  return Math.min(1, shared / Math.min(b.size, 6))
}

/** How close a picture's shape is to a frame's, 0 to 1 (1 is the same aspect ratio). */
export const aspectFit = (
  picture: { width: number; height: number },
  frame: { w: number; h: number }
) => {
  const a = picture.width / picture.height
  const b = frame.w / frame.h
  return Math.min(a, b) / Math.max(a, b)
}

/** `cover` when cropping loses little (within 25 percent of the frame's shape), else `contain`. */
export const fitFor = (
  picture: { width: number; height: number },
  frame: { w: number; h: number }
) => (aspectFit(picture, frame) >= 0.75 ? ('cover' as const) : ('contain' as const))

export type Assignment = { page: number; frame: string; picture: Picture; fit: 'cover' | 'contain' }

/**
 * Which picture goes in which image frame. The model's own `imageRef` wins when that picture is
 * free; otherwise the best by the portfolio's scoring (the frame's subject against the caption, with
 * the shape of the picture against the frame's). No picture is used twice, and a frame no picture
 * scores for stays empty (the composer drops it).
 */
export function assignPictures(
  pages: readonly Pick<DesignPage, 'purpose' | 'frames'>[],
  pictures: readonly Picture[]
): Assignment[] {
  const used = new Set<string>()
  const out: Assignment[] = []
  pages.forEach((page, p) => {
    for (const frame of page.frames) {
      if (frame.kind !== 'image') continue
      const subject = [frame.subject, frame.brief, page.purpose].filter(Boolean).join(' ')
      const asked = pictures.find((x) => x.ref === frame.imageRef && !used.has(x.ref))
      const best = asked
        ? { picture: asked, score: 1 }
        : pictures
            .filter((x) => !used.has(x.ref))
            .map((picture) => ({
              picture,
              score:
                0.6 *
                  scoreCandidate({
                    similarity: 0.25 + 0.75 * wordOverlap(subject, picture.caption),
                  }) +
                0.4 * aspectFit(picture, frame),
            }))
            .sort((a, b) => b.score - a.score)[0]
      if (!best || best.score < MIN_SCORE) continue
      const dupe = out.some((o) => isDuplicate(best.picture.phash, [o.picture.phash]))
      if (dupe) continue
      used.add(best.picture.ref)
      out.push({
        page: p,
        frame: frame.id,
        picture: best.picture,
        fit: fitFor(best.picture, frame),
      })
    }
  })
  return out
}

/** The pictures the materials offer the designer, and the placing of the chosen ones. */
export default class AiDesignImages {
  constructor(
    private variants = new ImageVariantService(),
    private planner = new PortfolioImagePlanner()
  ) {}

  private async measure(contents: Buffer) {
    const meta = await sharp(contents, { pages: 1 }).rotate().metadata()
    const rotated = (meta.orientation ?? 1) >= 5
    const width = (rotated ? meta.height : meta.width) ?? 0
    const height = (rotated ? meta.width : meta.height) ?? 0
    return width && height ? { width, height } : null
  }

  /** The document's registered images and the pictures the retrieval matched, usable ones only. */
  async candidates(input: {
    context: WorkspaceAccessContext
    documentId: string
    evidence: readonly ImageEvidence[]
    guard: () => Promise<void>
  }): Promise<Picture[]> {
    const found: Picture[] = []
    const hashes: string[] = []
    const accept = (picture: Omit<Picture, 'ref'>) => {
      if (
        found.length >= MAX_CANDIDATES ||
        rejection(
          { width: picture.width, height: picture.height, bytes: picture.bytes },
          MIN_EDGE
        ) ||
        isDuplicate(picture.phash, hashes)
      )
        return
      if (picture.phash) hashes.push(picture.phash)
      found.push({ ...picture, ref: `img${found.length + 1}` })
    }
    const own = await DocumentImage.query()
      .where({ workspaceId: input.context.workspaceId, documentId: input.documentId })
      .whereNotNull('width')
      .whereNotNull('height')
      .orderBy('createdAt', 'asc')
    const registered = new Set<string>()
    for (const image of own) {
      if (image.sourceChunkId) registered.add(image.sourceChunkId)
      accept({
        origin: image.origin === 'upload' ? 'upload' : 'source',
        imageId: image.id,
        chunkId: image.sourceChunkId ?? undefined,
        width: image.width!,
        height: image.height!,
        aspect: aspectClass(image.width!, image.height!),
        caption: [image.caption, image.altText, image.filename].filter(Boolean).join(' '),
        phash: image.phash,
        bytes: image.byteSize,
      })
    }
    for (const ev of input.evidence) {
      if (!ev.fileKey || registered.has(ev.chunk.id)) continue
      await input.guard()
      try {
        const contents = Buffer.from(await drive.use().getBytes(ev.fileKey))
        const size = await this.measure(contents)
        if (!size) continue
        const extension = EXTENSION[ev.chunk.mediaType ?? ''] ?? 'png'
        const filename = `${ev.chunk.fileName.replace(/\.[^.]+$/, '')}-p${ev.chunk.pageNumber ?? 0}.${extension}`
        DocumentImageService.mime(filename, contents)
        accept({
          origin: 'source',
          imageId: null,
          chunkId: ev.chunk.id,
          ...size,
          aspect: aspectClass(size.width, size.height),
          caption: ev.chunk.content.replace(/\s+/g, ' ').trim().slice(0, 300),
          phash: await this.variants.phash(contents),
          bytes: contents.length,
          contents,
          filename,
        })
      } catch {
        // A picture that cannot be read is simply not offered.
      }
    }
    return found
  }

  /** Small JPEG data URLs of the first pictures, for a model that accepts images. */
  async thumbnails(pictures: readonly Picture[], guard: () => Promise<void>) {
    const out: { ref: string; url: string }[] = []
    for (const picture of pictures) {
      if (out.length >= MAX_THUMBNAILS) break
      try {
        await guard()
        let contents = picture.contents
        if (!contents && picture.imageId) {
          const row = await DocumentImage.find(picture.imageId)
          if (row) contents = Buffer.from(await drive.use().getBytes(row.objectKey))
        }
        if (!contents) continue
        const jpeg = await sharp(contents, { pages: 1 })
          .rotate()
          .resize({
            width: THUMB_EDGE,
            height: THUMB_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 70 })
          .toBuffer()
        out.push({ ref: picture.ref, url: `data:image/jpeg;base64,${jpeg.toString('base64')}` })
      } catch {
        // No thumbnail for this one.
      }
    }
    return out
  }

  /** Registers the chosen source pictures as document images; returns each frame's picture. */
  async place(input: {
    context: WorkspaceAccessContext
    documentId: string
    assignments: readonly Assignment[]
    guard: () => Promise<void>
  }): Promise<Map<number, Map<string, FramePicture>>> {
    const byPage = new Map<number, Map<string, FramePicture>>()
    for (const [i, a] of input.assignments.entries()) {
      const choice: PictureChoice = {
        imageId: a.picture.imageId,
        origin: a.picture.origin,
        description: a.picture.caption,
        width: a.picture.width,
        height: a.picture.height,
        score: 1,
        phash: a.picture.phash,
        chunkId: a.picture.chunkId,
        contents: a.picture.contents,
        filename: a.picture.filename,
      }
      // One picture at a time, so a picture that cannot be registered leaves only its own frame empty.
      const placed = await this.planner.place({
        context: input.context,
        documentId: input.documentId,
        choices: new Map([[i, [choice]]]),
        guard: input.guard,
      })
      const picture = placed.get(i)?.[0]
      if (!picture) continue
      const frames = byPage.get(a.page) ?? new Map<string, FramePicture>()
      frames.set(a.frame, { imageId: picture.imageId, alt: picture.alt, fit: a.fit })
      byPage.set(a.page, frames)
    }
    return byPage
  }
}
