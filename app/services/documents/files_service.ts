import drive from '@adonisjs/drive/services/main'
import type Tesseract from 'tesseract.js'
import { createWorker } from 'tesseract.js'
import mammoth from 'mammoth'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { PDFParse } from 'pdf-parse'
import path from 'node:path'
import type Stream from 'node:stream'
import EmbeddFileService from './embedd_file_service.ts'

type FileProps = {
  filename: string
  objectKey: string
  objectUrl: string
}

type Chunk = {
  chunkIndex: number
  content: string
  embedding: number[]
  fileKey?: string
}

export default class FileService {
  static async processFile({ filename, objectKey, objectUrl }: FileProps) {
    const fileExtName = path.extname(objectKey).toLowerCase()
    const stream = await drive.use().getStream(objectKey)
    const file = await this.constructStream(stream)
    let chunks: Chunk[]

    switch (fileExtName) {
      case '.pdf':
        chunks = await this.processPdf(file)
        break
      case '.docx':
        chunks = await this.processDocx(file)
        break
      // case 'pptx':
      //   chunks = await this.processPptx(file)
      //   break
      case '.jpg':
      case '.jpeg':
      case '.png':
        chunks = await this.processImage(file, objectKey)
        break
      default:
        throw new Error(`Unsupported file type: ${fileExtName}`)
    }

    return {
      filename,
      filetype: fileExtName,
      objectKey,
      objectUrl,
      chunks,
    }
  }

  private static async constructStream(stream: Stream.Readable) {
    const chunks: Buffer[] = []

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    return Buffer.concat(chunks)
  }

  private static async processPdf(file: Buffer): Promise<Chunk[]> {
    const parser = new PDFParse(new Uint8Array(file))

    const resultText = await parser.getText()
    const textChunks = await this.splitText(resultText.text)
    const resultImages = await parser.getImage({
      imageThreshold: 100,
      imageBuffer: true,
      imageDataUrl: false,
    })

    if (!resultImages) return textChunks

    const images = resultImages.pages.flatMap((page) =>
      page.images.map((image) => Buffer.from(image.data))
    )

    // Process pdf Images
    const worker = await createWorker('eng')
    const imagesChunks: Chunk[] = []
    try {
      for (const image of images) {
        const key = await this.saveToDrive(image)
        const chunks = await this.processImage(image, key, worker)
        imagesChunks.push(...chunks)
      }
    } finally {
      await worker.terminate()
    }

    // Setup everything together
    const chunks = [...textChunks, ...imagesChunks].map((chunk, index) => ({
      ...chunk,
      chunkIndex: index,
    }))

    return chunks
  }

  private static async processDocx(file: Buffer): Promise<Chunk[]> {
    const resultText = await mammoth.extractRawText({ buffer: file })
    const text = resultText.value

    const textChunks = await this.splitText(text)

    return textChunks
  }

  // private static async processPptx(file: Buffer): Promise<Chunk[]> {
  //   const parser = new PptxParser(file)
  // }

  private static async processImage(
    image: string | Buffer,
    imageKey?: string,
    worker?: Tesseract.Worker
  ): Promise<Chunk[]> {
    // Assuming as the main language
    const useWorker = worker ?? (await createWorker('eng'))

    try {
      const response = await useWorker.recognize(image)
      const data = response.data.text

      return this.splitText(data, imageKey)
    } finally {
      if (!worker) await useWorker.terminate()
    }
  }

  private static async splitText(text: string, imageKey?: string) {
    const embeddFileService = new EmbeddFileService()

    // Split data
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })

    const chunks = await splitter.createDocuments([text])
    const promises = chunks.map(async (chunk, index) => ({
      chunkIndex: index,
      content: chunk.pageContent,
      fileKey: imageKey,
      embedding: await embeddFileService.embeddText(chunk.pageContent),
    }))

    const chunksInput = await Promise.all(promises)

    return chunksInput
  }

  private static async saveToDrive(file: Buffer) {
    try {
      const key = `uploads/processed/${crypto.randomUUID()}-image-file`
      await drive.use().put(key, file)

      return key
    } catch {
      return ''
    }
  }
}
