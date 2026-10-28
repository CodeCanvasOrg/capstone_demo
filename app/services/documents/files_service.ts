import { createHash, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type Stream from 'node:stream'

import drive from '@adonisjs/drive/services/main'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { DOMParser } from '@xmldom/xmldom'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { createWorker, type Worker } from 'tesseract.js'
import { z } from 'zod'

import File from '#models/file'
import pdfWorkerConfig from '#config/pdf_worker'
import PdfWorkerService from '#services/documents/pdf_worker_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { CanonicalBlock, SourceLocator } from './rag_types.ts'

// pdf.js needs its bundled font and CMap data for PDFs with non-embedded standard fonts or CJK
// text; resolve the copy pdf-parse actually loads. Node paths must end with a separator.
const pdfjsRoot = path.dirname(
  createRequire(import.meta.resolve('pdf-parse')).resolve('pdfjs-dist/package.json')
)
const pdfjsData = {
  standardFontDataUrl: path.join(pdfjsRoot, 'standard_fonts') + path.sep,
  cMapUrl: path.join(pdfjsRoot, 'cmaps') + path.sep,
  cMapPacked: true,
}

type FileProps = {
  id: string
  filename: string
  objectKey: string
  uploaderId: number
}

type SourceInfo = {
  fileKey: string
  fileUrl: string
  fileName: string
  mediaType: string
  storageRoot: string
  guard: () => Promise<void>
}

type OcrResult = {
  text: string
  confidence: number | null
}

const pdfExtractionSchema = z.object({
  pages: z.number().int().positive(),
  title: z.string().nullable(),
  toc: z.array(z.tuple([z.number(), z.string(), z.number()])),
  scannedPages: z.array(z.number()),
  timingsMs: z.record(z.string(), z.number()),
  blocks: z.array(
    z.object({
      key: z.string().regex(/^b\d+$/),
      blockType: z.enum(['heading', 'paragraph', 'list_item', 'table_row', 'image', 'code']),
      text: z.string(),
      pageNumber: z.number().int().positive(),
      bbox: z.array(z.number()).length(4),
      extractionMethod: z.string(),
      headingLevel: z.number().int().min(1).max(6).optional(),
      tableHeader: z.string().optional(),
      isHeader: z.boolean().optional(),
      isCaption: z.boolean().optional(),
      figure: z
        .string()
        .regex(/^f\d+\.png$/)
        .optional(),
      caption: z.string().nullable().optional(),
      scanned: z.boolean().optional(),
    })
  ),
})

const FILE_MEDIA_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export default class FileService {
  static async processFile(
    { id, filename, objectKey, uploaderId }: FileProps,
    context: WorkspaceAccessContext,
    guard: () => Promise<void>
  ) {
    const fileExtName = path.extname(objectKey).toLowerCase()
    const mediaType = FILE_MEDIA_TYPES[fileExtName]

    if (!mediaType) throw new Error(`Unsupported file type: ${fileExtName}`)
    if (
      !objectKey.startsWith(`workspaces/${context.workspaceId}/`) &&
      !objectKey.startsWith(`uploads/${uploaderId}/`)
    ) {
      throw new Error('File storage reference is outside its workspace lineage')
    }

    await guard()
    const fileUrl = `/workspaces/${context.workspaceId}/files/${id}/download`
    const source: SourceInfo = {
      fileKey: objectKey,
      fileUrl,
      fileName: filename,
      mediaType,
      storageRoot: `workspaces/${context.workspaceId}/derived/${id}`,
      guard,
    }
    const stream = await drive.use().getStream(objectKey)
    const file = await this.constructStream(stream)
    const generatedAssetKeys: string[] = []

    try {
      const blocks = await this.extractBlocks(file, source, fileExtName, generatedAssetKeys)

      return {
        id,
        filename,
        filetype: fileExtName,
        objectKey,
        objectUrl: fileUrl,
        mimeType: mediaType,
        sourceHash: createHash('sha256').update(file).digest('hex'),
        byteSize: file.byteLength,
        blocks,
        generatedAssetKeys,
      }
    } catch (error) {
      await this.cleanupGeneratedAssets(generatedAssetKeys)
      throw error
    }
  }

  static async cleanupGeneratedAssets(objectKeys: string[]) {
    const results = await Promise.allSettled(objectKeys.map((key) => drive.use().delete(key)))
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.warn(
          { err: result.reason, objectKey: objectKeys[index] },
          'Could not clean up an uncommitted extracted image'
        )
      }
    })
  }

  private static async extractBlocks(
    file: Buffer,
    source: SourceInfo,
    extension: string,
    generatedAssetKeys: string[]
  ): Promise<CanonicalBlock[]> {
    switch (extension) {
      case '.pdf':
        return pdfWorkerConfig.extractor === 'pymupdf'
          ? this.processPdfWithPyMuPdf(file, source, generatedAssetKeys)
          : this.processPdf(file, source, generatedAssetKeys)
      case '.docx':
        return this.processDocx(file, source, generatedAssetKeys)
      case '.md':
      case '.markdown':
        return this.processMarkdown(file, source)
      case '.txt':
        return this.processPlainText(file, source)
      case '.jpg':
      case '.jpeg':
      case '.png':
        return this.processImage(file, source)
      default:
        throw new Error(`Unsupported file type: ${extension}`)
    }
  }

  private static async constructStream(stream: Stream.Readable) {
    const chunks: Buffer[] = []

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    return Buffer.concat(chunks)
  }

  private static async processPdf(
    file: Buffer,
    source: SourceInfo,
    generatedAssetKeys: string[]
  ): Promise<CanonicalBlock[]> {
    const parser = new PDFParse({ data: new Uint8Array(file), ...pdfjsData })

    try {
      const resultText = await parser.getText()
      const blocks: CanonicalBlock[] = []

      for (const page of resultText.pages) {
        const text = page.text.trim()
        if (!text) continue

        blocks.push(
          this.makeBlock('paragraph', text, source, 'pdf-text', {
            pageNumber: page.num,
          })
        )
      }

      if (blocks.length === 0 && resultText.text.trim()) {
        blocks.push(this.makeBlock('paragraph', resultText.text.trim(), source, 'pdf-text'))
      }

      const resultImages = await parser.getImage({
        imageThreshold: 100,
        imageBuffer: true,
        imageDataUrl: false,
      })
      const images = resultImages.pages.flatMap((page) =>
        page.images.map((image) => ({ data: Buffer.from(image.data), pageNumber: page.pageNumber }))
      )

      if (images.length > 0) {
        const worker = await this.createOcrWorker()

        try {
          for (const image of images) {
            const storedImage = await this.saveToDrive(image.data, source.storageRoot, source.guard)
            generatedAssetKeys.push(storedImage.key)
            const ocr = await this.recognizeImage(image.data, worker)
            const locator = this.locator(source, {
              fileKey: storedImage.key,
              fileUrl: storedImage.url,
              mediaType: 'image/png',
              pageNumber: image.pageNumber,
            })

            blocks.push({
              id: randomUUID(),
              blockType: 'image',
              text: ocr.text || `Image evidence from ${source.fileName}`,
              orderIndex: blocks.length,
              sectionPath: [],
              sourceLocator: locator,
              extractionMethod: 'tesseract-ocr',
              confidence: ocr.confidence,
            })
          }
        } finally {
          await worker.terminate()
        }
      }

      return blocks
    } finally {
      await parser.destroy()
    }
  }

  /**
   * PyMuPDF layout extraction in the Python worker pool. Headings keep their levels, tables arrive
   * as rows with their header, figures and text-less pages come back as PNGs that are stored and
   * OCR'd here exactly like embedded DOCX images.
   */
  private static async processPdfWithPyMuPdf(
    file: Buffer,
    source: SourceInfo,
    generatedAssetKeys: string[]
  ): Promise<CanonicalBlock[]> {
    await source.guard()
    return new PdfWorkerService().withDocument('extract', file, {}, async (raw, outDir) => {
      const result = pdfExtractionSchema.parse(raw)
      const blocks: CanonicalBlock[] = []
      let worker: Worker | null = null
      try {
        for (const item of result.blocks) {
          const locator = {
            pageNumber: item.pageNumber,
            bbox: item.bbox,
            blockKey: item.key,
            ...(item.headingLevel ? { headingLevel: item.headingLevel } : {}),
            ...(item.tableHeader ? { tableHeader: item.tableHeader } : {}),
            ...(item.isCaption ? { caption: true } : {}),
          }
          if (item.blockType !== 'image' || !item.figure) {
            blocks.push(
              this.makeBlock(item.blockType, item.text, source, item.extractionMethod, locator)
            )
            continue
          }
          const image = await PdfWorkerService.readOutput(outDir, item.figure)
          const stored = await this.saveToDrive(image, source.storageRoot, source.guard)
          generatedAssetKeys.push(stored.key)
          worker ??= await this.createOcrWorker()
          const ocr = await this.recognizeImage(image, worker)
          const text = [item.caption, ocr.text].filter(Boolean).join('\n\n')
          blocks.push({
            id: randomUUID(),
            blockType: 'image',
            text: text || `Image evidence from ${source.fileName}`,
            orderIndex: blocks.length,
            sectionPath: [],
            sourceLocator: this.locator(source, {
              ...locator,
              fileKey: stored.key,
              fileUrl: stored.url,
              mediaType: 'image/png',
              ...(item.scanned ? { scanned: true } : {}),
            }),
            extractionMethod: item.scanned ? 'tesseract-ocr' : 'pymupdf-figure+tesseract-ocr',
            confidence: ocr.confidence,
          })
        }
      } finally {
        await worker?.terminate()
      }
      return blocks
    })
  }

  private static async processDocx(
    file: Buffer,
    source: SourceInfo,
    generatedAssetKeys: string[]
  ): Promise<CanonicalBlock[]> {
    const result = await mammoth.convertToHtml({ buffer: file })
    // Mammoth returns a fragment; xmldom requires one document element, even when empty.
    const document = new DOMParser().parseFromString(
      `<html><body>${result.value}</body></html>`,
      'text/html'
    )
    const blocks: CanonicalBlock[] = []
    let worker: Worker | null = null

    const collectImages = (node: HtmlNode): HtmlNode[] => {
      if (node.nodeType === 1 && node.nodeName.toLowerCase() === 'img') return [node]
      return childNodes(node).flatMap(collectImages)
    }

    const visit = async (node: HtmlNode): Promise<void> => {
      if (node.nodeType !== 1) {
        for (const child of childNodes(node)) await visit(child)
        return
      }

      const tag = node.nodeName.toLowerCase()
      if (tag === 'img') {
        const dataUri = node.getAttribute('src') ?? ''
        const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([\s\S]+)$/i.exec(dataUri)
        if (!match) return

        const mediaType = match[1].toLowerCase()
        const imageBytes = Buffer.from(match[2], 'base64')
        const storedImage = await this.saveToDrive(
          imageBytes,
          source.storageRoot,
          source.guard,
          mediaType
        )
        generatedAssetKeys.push(storedImage.key)

        let ocr: OcrResult = { text: '', confidence: null }
        try {
          worker ??= await this.createOcrWorker()
          ocr = await this.recognizeImage(imageBytes, worker)
        } catch (error) {
          logger.warn(
            { err: error, fileName: source.fileName },
            'Could not OCR an embedded DOCX image; retaining the image source'
          )
        }

        blocks.push({
          id: randomUUID(),
          blockType: 'image',
          text: ocr.text || `Image evidence from ${source.fileName}`,
          orderIndex: blocks.length,
          sectionPath: [],
          sourceLocator: this.locator(source, {
            fileKey: storedImage.key,
            fileUrl: storedImage.url,
            mediaType,
          }),
          extractionMethod: ocr.text ? 'mammoth-image-ocr' : 'mammoth-image',
          confidence: ocr.confidence,
        })
        return
      }

      if (/^h[1-6]$/.test(tag)) {
        const text = this.normalizeText(node.textContent ?? '')
        if (text) {
          blocks.push(
            this.makeBlock('heading', text, source, 'mammoth-html', {
              element: `heading-${blocks.length + 1}`,
              headingLevel: Number(tag.slice(1)),
            })
          )
        }
        return
      }

      if (tag === 'p' || tag === 'li' || tag === 'pre') {
        const text = this.normalizeText(node.textContent ?? '')
        if (text) {
          blocks.push(
            this.makeBlock(
              tag === 'li' ? 'list_item' : tag === 'pre' ? 'code' : 'paragraph',
              text,
              source,
              'mammoth-html',
              { element: `element-${blocks.length + 1}` }
            )
          )
        }
        for (const image of collectImages(node)) await visit(image)
        return
      }

      if (tag === 'tr') {
        const cells = childNodes(node)
          .filter((child) => ['th', 'td'].includes(child.nodeName.toLowerCase()))
          .map((cell) => this.normalizeText(cell.textContent ?? ''))
          .filter(Boolean)
        if (cells.length) {
          blocks.push(
            this.makeBlock('table_row', cells.join(' | '), source, 'mammoth-html', {
              element: `table-row-${blocks.length + 1}`,
            })
          )
        }
        for (const image of collectImages(node)) await visit(image)
        return
      }

      for (const child of childNodes(node)) await visit(child)
    }

    const root = document.documentElement as unknown as HtmlNode | null
    try {
      if (root) await visit(root)
      return blocks
    } finally {
      await (worker as Worker | null)?.terminate()
    }
  }

  private static processMarkdown(file: Buffer, source: SourceInfo) {
    const lines = file.toString('utf8').split(/\r?\n/)
    const blocks: CanonicalBlock[] = []
    let paragraph: string[] = []
    let code: string[] | null = null
    let paragraphStart = 1
    let codeStart = 1

    const flushParagraph = () => {
      const text = paragraph.join(' ').trim()
      if (text) {
        blocks.push(
          this.makeBlock('paragraph', text, source, 'markdown', { lineNumber: paragraphStart })
        )
      }
      paragraph = []
    }

    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1
      const trimmed = line.trim()

      if (trimmed.startsWith('```')) {
        flushParagraph()
        if (code) {
          blocks.push(
            this.makeBlock('code', code.join('\n'), source, 'markdown', { lineNumber: codeStart })
          )
          code = null
        } else {
          code = []
          codeStart = lineNumber + 1
        }
        continue
      }

      if (code) {
        code.push(line)
        continue
      }

      const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
      if (heading) {
        flushParagraph()
        blocks.push(
          this.makeBlock('heading', heading[2].trim(), source, 'markdown', {
            lineNumber,
            headingLevel: heading[1].length,
          })
        )
        continue
      }

      if (!trimmed) {
        flushParagraph()
        continue
      }

      if (/^\|?\s*:?-{3,}/.test(trimmed)) continue
      if (trimmed.includes('|')) {
        flushParagraph()
        blocks.push(
          this.makeBlock(
            'table_row',
            trimmed
              .replace(/^\||\|$/g, '')
              .split('|')
              .map((cell) => cell.trim())
              .join(' | '),
            source,
            'markdown',
            { lineNumber }
          )
        )
        continue
      }

      const listItem = /^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(trimmed)
      if (listItem) {
        flushParagraph()
        blocks.push(this.makeBlock('list_item', listItem[1], source, 'markdown', { lineNumber }))
        continue
      }

      if (paragraph.length === 0) paragraphStart = lineNumber
      paragraph.push(trimmed)
    }

    if (code) {
      blocks.push(
        this.makeBlock('code', code.join('\n'), source, 'markdown', { lineNumber: codeStart })
      )
    }
    flushParagraph()
    return blocks
  }

  private static processPlainText(file: Buffer, source: SourceInfo) {
    return file
      .toString('utf8')
      .split(/\n\s*\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) =>
        this.makeBlock('paragraph', text, source, 'plain-text', {
          element: `paragraph-${index + 1}`,
        })
      )
  }

  private static async processImage(file: Buffer, source: SourceInfo): Promise<CanonicalBlock[]> {
    const worker = await this.createOcrWorker()

    try {
      const result = await this.recognizeImage(file, worker)
      return [
        {
          id: randomUUID(),
          blockType: 'image',
          text: result.text || `Image evidence from ${source.fileName}`,
          orderIndex: 0,
          sectionPath: [],
          sourceLocator: this.locator(source),
          extractionMethod: 'tesseract-ocr',
          confidence: result.confidence,
        },
      ]
    } finally {
      await worker.terminate()
    }
  }

  private static async recognizeImage(image: Buffer, worker: Worker): Promise<OcrResult> {
    const response = await worker.recognize(image)
    const text = response.data.text.trim()
    const confidence = Number.isFinite(response.data.confidence) ? response.data.confidence : null

    return { text, confidence }
  }

  private static async createOcrWorker() {
    const cachePath = app.tmpPath('tesseract')
    await mkdir(cachePath, { recursive: true })

    return createWorker('eng', undefined, {
      langPath: app.makePath(),
      cachePath,
      gzip: false,
    })
  }

  private static makeBlock(
    blockType: CanonicalBlock['blockType'],
    text: string,
    source: SourceInfo,
    extractionMethod: string,
    locator: Record<string, unknown> = {}
  ): CanonicalBlock {
    return {
      id: randomUUID(),
      blockType,
      text,
      orderIndex: 0,
      sectionPath: [],
      sourceLocator: this.locator(source, locator),
      extractionMethod,
      confidence: null,
    }
  }

  private static locator(source: SourceInfo, extra: Record<string, unknown> = {}): SourceLocator {
    return {
      fileKey: source.fileKey,
      fileUrl: source.fileUrl,
      fileName: source.fileName,
      mediaType: source.mediaType,
      ...extra,
    }
  }

  private static normalizeText(text: string) {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r\n ]+/g, ' ')
      .trim()
  }

  private static async saveToDrive(
    file: Buffer,
    storageRoot: string,
    guard: () => Promise<void>,
    mediaType = 'image/png'
  ) {
    const extension = IMAGE_EXTENSIONS[mediaType] ?? 'png'
    const key = File.createFileName(storageRoot, `image.${extension}`)
    await guard()
    await drive.use().put(key, file, { contentType: mediaType, visibility: 'private' })

    return {
      key,
      url: '',
    }
  }
}

type HtmlNode = {
  nodeType: number
  nodeName: string
  textContent: string | null
  getAttribute(name: string): string | null
  childNodes: { length: number; item(index: number): HtmlNode | null }
}

function childNodes(node: HtmlNode): HtmlNode[] {
  return Array.from({ length: node.childNodes.length }, (_, index) =>
    node.childNodes.item(index)
  ).filter((child): child is HtmlNode => child !== null)
}
