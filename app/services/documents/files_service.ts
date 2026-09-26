import drive from '@adonisjs/drive/services/main'
import { createWorker } from 'tesseract.js'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { PDFParse } from 'pdf-parse'
import path from 'node:path'
// import type Stream from 'node:stream'

type FileProps = {
  filename: string
  objectKey: string
  objectUrl: string
}

type Chunk = {
  chunkIndex: number
  content: string
  fileKey?: string
}

export default class FileService {
  static async processFile({ filename, objectKey, objectUrl }: FileProps) {
    const fileExtName = path.extname(objectKey)
    //const stream = await drive.use().getStream(objectKey)
    // const file = await this.constructStream(stream)
    let chunks: Chunk[]

    switch (fileExtName) {
      case 'pdf':
        chunks = await this.processPdf(objectUrl)
        break
      // case 'docx':
      // chunks = await this.processDocx(file)
      // break
      // case 'pptx':
      // chunks = await this.processPptx(file)
      // break
      default:
        chunks = await this.processImage(objectKey)
    }

    return {
      filename,
      filetype: fileExtName,
      objectKey,
      objectUrl,
      chunks,
    }
  }

  //   private static async constructStream(stream: Stream.Readable) {
  //     const chunks: Buffer[] = []
  //
  //     for await (const chunk of stream) {
  //       chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  //     }
  //
  //     return Buffer.concat(chunks)
  //   }

  private static async processPdf(file: string): Promise<Chunk[]> {
    const parser = new PDFParse({ url: new URL(file) })

    const resultText = await parser.getText()
    const resultImages = await parser.getImage({ imageThreshold: 80, imageDataUrl: true })
    const images = resultImages.pages.flatMap((page) => page.images.map((image) => image.dataUrl))

    const textChunks = await this.splitText(resultText.text)
    const promises = images.map(async (imageUrl) => await this.processImage(imageUrl))
    const imagesChunksProm = await Promise.all(promises)
    const imagesChunks = imagesChunksProm.flat()

    const chunks = [textChunks, imagesChunks].flat()

    return chunks
  }

  // private static async processPptx(file: Buffer): Promise<Chunk[]> {}
  // private static async processDocx(file: Buffer): Promise<Chunk[]> { }

  private static async processImage(imageKey: string): Promise<Chunk[]> {
    // Assuming as the main language
    const worker = await createWorker('eng')

    const imageUrl = drive.use().getUrl(imageKey)
    const response = await worker.recognize(imageUrl)

    const data = response.data.text
    await worker.terminate()

    return this.splitText(data)
  }

  private static async splitText(text: string, imageKey?: string) {
    // Split data
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })

    const chunks = await splitter.createDocuments([text])
    const chunksInput = chunks.map((chunk, index) => ({
      chunkIndex: index,
      content: chunk.pageContent,
      fileKey: imageKey,
    }))

    return chunksInput
  }
}
