import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import config from '#config/open_router'
import ModelImageException from '#exceptions/model_image_exception'

/** Ephemeral model input only. Callers must authorize the evidence key before calling. */
export default class ModelImageService {
  async prepare(key: string, guard: () => Promise<void>): Promise<string> {
    await guard()
    const stream = await drive.use().getStream(key)
    const chunks: Buffer[] = []
    let bytes = 0
    try {
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytes += buffer.length
        if (bytes > config.images.maxInputBytes) throw new ModelImageException()
        chunks.push(buffer)
      }
    } finally {
      stream.destroy()
    }
    await guard()
    const preview = await this.resize(Buffer.concat(chunks))
    await guard()
    return `data:image/jpeg;base64,${preview.toString('base64')}`
  }

  async resize(input: Buffer): Promise<Buffer> {
    if (!input.length || input.length > config.images.maxInputBytes) throw new ModelImageException()
    try {
      const image = sharp(input, { limitInputPixels: config.images.maxInputPixels, pages: 1 })
      const metadata = await image.metadata()
      if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format ?? ''))
        throw new ModelImageException()
      const output = await image
        .rotate()
        .resize({
          width: config.images.maxEdge,
          height: config.images.maxEdge,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 85 })
        .toBuffer()
      if (output.length > config.images.maxOutputBytes) throw new ModelImageException()
      return output
    } catch {
      throw new ModelImageException()
    }
  }
}
