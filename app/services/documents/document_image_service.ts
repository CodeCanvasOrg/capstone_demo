import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import Document from '#models/document'
import DocumentImage from '#models/document_image'
import DocumentImageVariant from '#models/document_image_variant'
import ImageVariantService, { variantMime } from '#services/documents/image_variant_service'
import sharp from 'sharp'
import { chooseVariant, coverSize } from '../../../shared/canvas/image_rules.ts'
import AccessService, {
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'

const invalidImage = () => new Exception('Choose a PNG or JPEG image up to 10 MB', { status: 422 })

export default class DocumentImageService {
  static mime(filename: string, bytes: Buffer) {
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw invalidImage()
    const extension = path.extname(filename).toLowerCase()
    if (
      extension === '.png' &&
      bytes.length >= 45 &&
      bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      bytes.toString('ascii', 12, 16) === 'IHDR' &&
      bytes.readUInt32BE(8) === 13 &&
      bytes.readUInt32BE(16) > 0 &&
      bytes.readUInt32BE(20) > 0 &&
      bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))
    )
      return 'image/png'
    if (
      ['.jpg', '.jpeg'].includes(extension) &&
      bytes.length >= 20 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff &&
      bytes[bytes.length - 1] === 0xd9
    ) {
      // Walk the JPEG headers to require real dimensions and a scan, not just magic bytes.
      let offset = 2
      let dimensions = false
      while (offset + 4 <= bytes.length) {
        if (bytes[offset++] !== 0xff) break
        while (offset < bytes.length && bytes[offset] === 0xff) offset++
        if (offset + 3 > bytes.length) break
        const marker = bytes[offset++]
        const length = bytes.readUInt16BE(offset)
        if (length < 2 || offset + length > bytes.length) break
        if (
          [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
            marker
          )
        ) {
          dimensions =
            length >= 8 && bytes.readUInt16BE(offset + 3) > 0 && bytes.readUInt16BE(offset + 5) > 0
        }
        if (marker === 0xda && dimensions && offset + length < bytes.length - 2) return 'image/jpeg'
        offset += length
      }
    }
    throw invalidImage()
  }

  /**
   * Pixel size from the image header. Only called on bytes `mime` accepted, so the
   * header is known to be well formed; anything unexpected reads as unknown (null).
   */
  static dimensions(mime: string, bytes: Buffer): { width: number; height: number } | null {
    if (mime === 'image/png' && bytes.length >= 24)
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    if (mime !== 'image/jpeg') return null
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) return null
      while (offset < bytes.length && bytes[offset] === 0xff) offset++
      if (offset + 3 > bytes.length) return null
      const marker = bytes[offset++]
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) return null
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker
        ) &&
        length >= 8
      ) {
        const height = bytes.readUInt16BE(offset + 3)
        const width = bytes.readUInt16BE(offset + 5)
        return width > 0 && height > 0 ? { width, height } : null
      }
      offset += length
    }
    return null
  }

  receipt(image: DocumentImage) {
    return {
      id: image.id,
      filename: image.filename,
      mime: image.mime,
      byteSize: image.byteSize,
      width: image.width,
      height: image.height,
      caption: image.caption,
      altText: image.altText,
      focus:
        image.focusX !== null && image.focusY !== null
          ? { x: image.focusX, y: image.focusY }
          : null,
      origin: image.origin,
      src: `/workspaces/${image.workspaceId}/documents/${image.documentId}/images/${image.id}`,
    }
  }

  async upload(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      filename: string
      contents: Buffer
    }
  ) {
    return this.receipt(await this.store(context, documentId, input))
  }

  /**
   * Registers a picture from a source file as a document image, once: the canvas may
   * only show document images, so a source picture is promoted when it is placed.
   * The same source chunk is never promoted twice for one document.
   */
  async promote(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      filename: string
      contents: Buffer
      chunkId: string
      caption?: string | null
      altText?: string | null
    }
  ) {
    const existing = await DocumentImage.query()
      .where({ workspaceId: context.workspaceId, documentId, sourceChunkId: input.chunkId })
      .first()
    if (existing) return existing
    return this.store(context, documentId, { ...input, origin: 'source' })
  }

  private async store(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      filename: string
      contents: Buffer
      origin?: 'upload' | 'source'
      chunkId?: string
      caption?: string | null
      altText?: string | null
    }
  ) {
    const mime = DocumentImageService.mime(input.filename, input.contents)
    const size = DocumentImageService.dimensions(mime, input.contents)
    const id = randomUUID()
    const objectKey = `workspaces/${context.workspaceId}/documents/${documentId}/images/${id}.${mime === 'image/png' ? 'png' : 'jpg'}`
    const disk = drive.use()
    let written = false
    let image: DocumentImage
    try {
      image = await db.transaction(async (trx) => {
        await new AccessService().lock(context, trx)
        if (!uuid(documentId)) throw missingResource()
        await Document.query({ client: trx })
          .where({ id: documentId, workspaceId: context.workspaceId })
          .forUpdate()
          .firstOrFail()
        written = true
        await disk.put(objectKey, input.contents, { contentType: mime, visibility: 'private' })
        return DocumentImage.create(
          {
            id,
            workspaceId: context.workspaceId,
            documentId,
            uploaderId: context.actorId,
            objectKey,
            mime,
            byteSize: input.contents.length,
            width: size?.width ?? null,
            height: size?.height ?? null,
            filename: path.basename(input.filename).slice(0, 255),
            origin: input.origin ?? 'upload',
            sourceChunkId: input.chunkId ?? null,
            caption: input.caption?.slice(0, 400) ?? null,
            altText: input.altText?.slice(0, 300) ?? null,
          },
          { client: trx }
        )
      })
    } catch (error) {
      if (written)
        await disk.delete(objectKey).catch((cleanupError) => {
          logger.error(
            { err: cleanupError, documentId, imageId: id },
            'Unable to remove failed document image upload'
          )
        })
      throw error
    }
    // Copies for the library, the editor and print, made once. A failure never fails the
    // upload: `node ace images:optimize` builds what is missing.
    try {
      await new ImageVariantService().build(image, input.contents)
    } catch (error) {
      logger.warn({ err: error, documentId, imageId: id }, 'Unable to build image variants')
    }
    return image
  }

  /**
   * Fills in the size of images uploaded before sizes were recorded, reading
   * each file's header from storage. Maintenance only (`node ace images:measure`):
   * runs across workspaces, so it never returns image contents.
   */
  async measureMissing({ limit = 500, dryRun = false } = {}) {
    const rows = await DocumentImage.query()
      .whereNull('width')
      .orderBy('createdAt', 'asc')
      .limit(limit)
    const result = { checked: rows.length, measured: 0, unreadable: [] as string[] }
    for (const image of rows) {
      try {
        const bytes = Buffer.from(await drive.use().getBytes(image.objectKey))
        const size = DocumentImageService.dimensions(image.mime, bytes)
        if (!size) {
          result.unreadable.push(image.id)
          continue
        }
        if (!dryRun) await image.merge(size).save()
        result.measured++
      } catch (error) {
        logger.warn({ err: error, imageId: image.id }, 'Unable to measure document image')
        result.unreadable.push(image.id)
      }
    }
    return result
  }

  /** Every image uploaded to a document, newest first: the canvas's image library. */
  async list(context: WorkspaceAccessContext, documentId: string) {
    if (!uuid(documentId)) throw missingResource()
    await new AccessService().document(context, documentId)
    const images = await DocumentImage.query()
      .where({ workspaceId: context.workspaceId, documentId })
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'asc')
    return images.map((image) => this.receipt(image))
  }

  /**
   * The picture's bytes for a reader: the original, or the `thumb` or `screen` copy
   * when asked for and made (an image without it falls back to the original).
   */
  async asset(
    context: WorkspaceAccessContext,
    documentId: string,
    imageId: string,
    variant?: string
  ) {
    if (!uuid(documentId) || !uuid(imageId)) throw missingResource()
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .firstOrFail()
      const image = await DocumentImage.query({ client: trx })
        .where({ id: imageId, workspaceId: context.workspaceId, documentId })
        .firstOrFail()
      const wanted = variant === 'thumb' || variant === 'screen' ? variant : null
      const copy = wanted
        ? await DocumentImageVariant.query({ client: trx })
            .where({ imageId: image.id, purpose: wanted })
            .first()
        : null
      if (copy)
        return { mime: variantMime(copy.format), stream: await drive.use().getStream(copy.key) }
      return { mime: image.mime, stream: await drive.use().getStream(image.objectKey) }
    })
  }

  /**
   * The picture for a print export of a frame `frame` tenths of a millimetre wide
   * and tall: the smallest variant with the pixels the frame needs at 300 dpi,
   * resized to exactly that (never enlarged), as PNG when it has transparency and
   * JPEG otherwise. `cache` holds the resized bytes for the length of one export,
   * keyed by variant and size. An image with no variants falls back to its original.
   */
  async exportAsset(
    context: WorkspaceAccessContext,
    documentId: string,
    imageId: string,
    frame: { w: number; h: number },
    cache: Map<string, { mime: string; bytes: Buffer }> = new Map()
  ) {
    if (!uuid(documentId) || !uuid(imageId)) throw missingResource()
    await new AccessService().document(context, documentId)
    const image = await DocumentImage.query()
      .where({ id: imageId, workspaceId: context.workspaceId, documentId })
      .firstOrFail()
    const variants = await DocumentImageVariant.query().where('imageId', image.id)
    const chosen = chooseVariant(variants, frame)
    const key = chosen?.key ?? image.objectKey
    const known = chosen
      ? { width: chosen.width, height: chosen.height }
      : image.width && image.height
        ? { width: image.width, height: image.height }
        : null
    const size = known ? coverSize(known, frame) : null
    const id = `${key}:${size?.width ?? 0}x${size?.height ?? 0}`
    const hit = cache.get(id)
    if (hit) return hit
    const bytes = Buffer.from(await drive.use().getBytes(key))
    const mime = chosen ? variantMime(chosen.format) : image.mime
    let made: { mime: string; bytes: Buffer } = { mime, bytes }
    if (size && known && (size.width < known.width || size.height < known.height)) {
      const resized = sharp(bytes, { pages: 1 }).resize({ width: size.width, height: size.height })
      made =
        mime === 'image/png'
          ? { mime, bytes: await resized.png({ compressionLevel: 9 }).toBuffer() }
          : {
              mime: 'image/jpeg',
              bytes: await resized
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 85, mozjpeg: true })
                .toBuffer(),
            }
    } else if (mime === 'image/webp') {
      made = {
        mime: 'image/jpeg',
        bytes: await sharp(bytes)
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 85 })
          .toBuffer(),
      }
    }
    cache.set(id, made)
    return made
  }

  async references(context: WorkspaceAccessContext, documentId: string, value: TipTapDocument) {
    const ids = new Set<string>()
    const visit = (node: TipTapDocument['content'][number]) => {
      const id = node.attrs?.documentImageId
      if (id !== undefined && id !== null) {
        if (node.type !== 'image' || !uuid(id) || node.attrs?.sourceChunkId) throw invalidImage()
        ids.add(id)
      }
      node.content?.forEach(visit)
    }
    value.content.forEach(visit)
    if (!ids.size) return new Map<string, ReturnType<DocumentImageService['receipt']>>()
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .firstOrFail()
      const images = await DocumentImage.query({ client: trx })
        .where({ workspaceId: context.workspaceId, documentId })
        .whereIn('id', [...ids])
      if (images.length !== ids.size)
        throw new Exception(
          'An image is unavailable for this document. Remove it or upload it again.',
          { status: 422 }
        )
      return new Map(images.map((image) => [image.id, this.receipt(image)]))
    })
  }
}
