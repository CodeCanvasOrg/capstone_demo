import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import sharp from 'sharp'
import DocumentImage from '#models/document_image'
import DocumentImageVariant, { type ImageVariantPurpose } from '#models/document_image_variant'

/**
 * Resized copies of a document image, made once at upload: `thumb` for the image
 * library, `screen` for the editor and `print` for exports (an A4 sheet at 300
 * dpi). Each is auto-rotated from EXIF, stripped of metadata and converted to sRGB.
 * Also finds the picture's focal point and a perceptual hash for de-duplication.
 */
export const VARIANT_SPEC = {
  thumb: { edge: 320, quality: 70 },
  screen: { edge: 1600, quality: 80 },
  /** A4 at 300 dpi: 297 mm is 3508 px. */
  print: { edge: 3508, quality: 85 },
} as const

export type Derived = {
  width: number
  height: number
  focus: { x: number; y: number }
  phash: string
  variants: {
    purpose: ImageVariantPurpose
    format: 'webp' | 'jpeg' | 'png'
    width: number
    height: number
    bytes: Buffer
  }[]
}

const EXTENSION = { webp: 'webp', jpeg: 'jpg', png: 'png' } as const
export const variantMime = (format: 'webp' | 'jpeg' | 'png') => `image/${format}`

export default class ImageVariantService {
  /** 64-bit average hash: the picture as 8 x 8 grey, each cell above or below the mean. */
  async phash(bytes: Buffer): Promise<string> {
    const grey = await sharp(bytes, { pages: 1 })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer()
    const mean = grey.reduce((sum, v) => sum + v, 0) / grey.length
    let bits = ''
    for (const value of grey) bits += value >= mean ? '1' : '0'
    return bits
      .match(/.{4}/g)!
      .map((nibble) => Number.parseInt(nibble, 2).toString(16))
      .join('')
  }

  /** Where the eye goes: sharp's attention crop, as percent of the picture's width and height. */
  async focus(bytes: Buffer): Promise<{ x: number; y: number }> {
    const { info } = await sharp(bytes, { pages: 1 })
      .rotate()
      .resize(200, 200, { fit: 'cover', position: sharp.strategy.attention })
      .toBuffer({ resolveWithObject: true })
    const meta = await sharp(bytes, { pages: 1 }).rotate().metadata()
    const rotated = (meta.orientation ?? 1) >= 5
    const width = (rotated ? meta.height : meta.width) ?? 1
    const height = (rotated ? meta.width : meta.height) ?? 1
    // The focal point is reported on the picture as scaled to cover the 200 px square.
    const scale = 200 / Math.min(width, height)
    const attention = info as typeof info & { attentionX?: number; attentionY?: number }
    const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))
    return {
      x: clamp(((attention.attentionX ?? (width * scale) / 2) / (width * scale)) * 100),
      y: clamp(((attention.attentionY ?? (height * scale) / 2) / (height * scale)) * 100),
    }
  }

  /** Every variant, the focal point and the hash, from the original bytes. */
  async derive(original: Buffer): Promise<Derived> {
    const base = sharp(original, { pages: 1 }).rotate().toColourspace('srgb')
    const meta = await sharp(original, { pages: 1 }).rotate().metadata()
    // An alpha channel that is fully opaque (common in exported PNGs) is not transparency.
    const stats = meta.hasAlpha ? await sharp(original, { pages: 1 }).stats() : null
    const transparent = !!stats && !stats.isOpaque
    const { data, info } = await base.clone().toBuffer({ resolveWithObject: true })
    const width = info.width
    const height = info.height
    const variants: Derived['variants'] = []
    for (const purpose of ['thumb', 'screen', 'print'] as const) {
      const { edge, quality } = VARIANT_SPEC[purpose]
      const resized = sharp(data, { pages: 1 }).resize({
        width: edge,
        height: edge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      // Alpha is kept for a print copy (a logo or diagram); the rest are flattened.
      const keepAlpha = transparent && purpose === 'print'
      const format = purpose === 'print' ? (keepAlpha ? 'png' : 'jpeg') : 'webp'
      const encoded = await (
        keepAlpha
          ? resized.png({ compressionLevel: 9 })
          : format === 'jpeg'
            ? resized.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true })
            : resized.flatten({ background: '#ffffff' }).webp({ quality })
      ).toBuffer({ resolveWithObject: true })
      variants.push({
        purpose,
        format,
        width: encoded.info.width,
        height: encoded.info.height,
        bytes: encoded.data,
      })
    }
    return {
      width,
      height,
      focus: await this.focus(original),
      phash: await this.phash(original),
      variants,
    }
  }

  private key(image: DocumentImage, purpose: ImageVariantPurpose, format: 'webp' | 'jpeg' | 'png') {
    return image.objectKey.replace(/\.[^./]+$/, `.${purpose}.${EXTENSION[format]}`)
  }

  /**
   * Stores the variants and updates the image row with its focal point, hash and size.
   * Replaces any variants it already had. Returns the derived data.
   */
  async persist(image: DocumentImage, derived: Derived) {
    const disk = drive.use()
    for (const v of derived.variants) {
      const key = this.key(image, v.purpose, v.format)
      await disk.put(key, v.bytes, { contentType: variantMime(v.format), visibility: 'private' })
      await DocumentImageVariant.query().where({ imageId: image.id, purpose: v.purpose }).delete()
      await DocumentImageVariant.create({
        imageId: image.id,
        workspaceId: image.workspaceId,
        purpose: v.purpose,
        format: v.format,
        width: v.width,
        height: v.height,
        bytes: v.bytes.length,
        key,
      })
    }
    image.merge({
      width: image.width ?? derived.width,
      height: image.height ?? derived.height,
      focusX: image.focusX ?? derived.focus.x,
      focusY: image.focusY ?? derived.focus.y,
      phash: derived.phash,
    })
    await image.save()
    return derived
  }

  /** Variants for one image from its original bytes (fetched from storage when not given). */
  async build(image: DocumentImage, original?: Buffer) {
    const bytes = original ?? Buffer.from(await drive.use().getBytes(image.objectKey))
    return this.persist(image, await this.derive(bytes))
  }

  /**
   * Builds what is missing: images with no `print` variant, oldest first. Maintenance
   * only (`node ace images:optimize`): runs across workspaces and never returns
   * image contents. A failure on one image is recorded and the rest go on.
   */
  async backfill({ limit = 500, dryRun = false } = {}) {
    const rows = await DocumentImage.query()
      .whereNotExists((query) =>
        query
          .from('document_image_variants')
          .select('id')
          .whereColumn('document_image_variants.image_id', 'document_images.id')
          .where('document_image_variants.purpose', 'print')
      )
      .orderBy('createdAt', 'asc')
      .limit(limit)
    const result = { checked: rows.length, built: 0, failed: [] as string[] }
    for (const image of rows) {
      if (dryRun) continue
      try {
        await this.build(image)
        result.built++
      } catch (error) {
        logger.warn({ err: error, imageId: image.id }, 'Unable to build image variants')
        result.failed.push(image.id)
      }
    }
    return result
  }

  async variants(imageId: string) {
    return DocumentImageVariant.query().where('imageId', imageId)
  }
}
