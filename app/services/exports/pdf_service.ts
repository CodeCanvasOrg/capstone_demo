import PdfUnavailableException from '#exceptions/pdf_unavailable_exception'
import { readFile } from 'node:fs/promises'
import type DocumentVersion from '#models/document_version'
import { Node, mergeAttributes, type JSONContent } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { chromium } from 'playwright'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'

type RenderOptions = { preview?: boolean; publication?: boolean }

const ReferenceExtension = Node.create({
  name: 'reference',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { number: { default: null } }
  },
  renderHTML({ node }) {
    return ['sup', { class: 'ref' }, String(node.attrs.number)]
  },
})

const esc = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const PUBLICATION_CSS = `
.hero { border-top: 6px solid #f6d900; padding-top: 14px; margin-bottom: 20px; }
.hero h1 { font-size: 24pt; line-height: 1.2; margin: 0 0 10px; }
.hero .summary { font-size: 13pt; color: #374151; }
.hero .summary p { margin: 0; }
sup.ref { font-size: 7pt; line-height: 0; color: #6b7280; margin-left: 1px; }
h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; break-after: avoid; }
h3 { break-after: avoid; }
img { break-inside: avoid; }
.sources { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9pt; color: #4b5563; break-inside: avoid; }
.sources h2 { font-size: 11pt; border: 0; margin: 0 0 6px; }
.sources ol { margin: 0; padding-left: 20px; }
`

const SourceCitationExtension = Node.create({
  name: 'sourceCitation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      sourceChunkId: {
        default: null,
        renderHTML: (attributes) => ({ 'data-source-chunk-id': attributes.sourceChunkId }),
      },
      chunkText: { default: null, renderHTML: () => ({}) },
      fileName: { default: null, renderHTML: () => ({}) },
      fileUrl: { default: null, renderHTML: () => ({}) },
      mediaType: { default: null, renderHTML: () => ({}) },
      chunkIndex: { default: null, renderHTML: () => ({}) },
      pageNumber: { default: null, renderHTML: () => ({}) },
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const chunkNumber =
      typeof node.attrs.chunkIndex === 'number' ? ` · chunk ${node.attrs.chunkIndex + 1}` : ''
    const page = typeof node.attrs.pageNumber === 'number' ? ` · page ${node.attrs.pageNumber}` : ''
    const attributes = mergeAttributes(HTMLAttributes, {
      'data-source-citation': 'true',
      'class': 'tiptap-source-citation',
    })
    const label = `${node.attrs.fileName || 'Source'}${chunkNumber}${page}`

    if (typeof node.attrs.fileUrl === 'string') {
      return [
        'a',
        { ...attributes, href: node.attrs.fileUrl, target: '_blank', rel: 'noreferrer' },
        label,
      ]
    }

    return ['span', attributes, label]
  },
})

export default class ExportPdfService {
  static async html(
    version: DocumentVersion,
    { preview = false, publication = false }: RenderOptions = {}
  ) {
    const extensions = [StarterKit, Image, SourceCitationExtension, ReferenceExtension]
    let contentHtml: string
    if (publication) {
      const projected = new PublicationProjectionService().project(
        version.content as TipTapDocument
      )
      const render = (content: TipTapDocument['content']) =>
        content.length ? generateHTML({ type: 'doc', content } as JSONContent, extensions) : ''
      contentHtml = `
      <header class="hero">
      ${projected.title ? `<h1>${esc(projected.title)}</h1>` : ''}
      ${projected.summary ? `<div class="summary">${render([projected.summary])}</div>` : ''}
      </header>
      ${render(projected.body)}
      ${
        projected.sources.length
          ? `<section class="sources"><h2>Sources</h2><ol>${projected.sources
              .map((source) => `<li value="${source.number}">${esc(source.label)}</li>`)
              .join('')}</ol></section>`
          : ''
      }`
    } else contentHtml = generateHTML(version.content, extensions)

    const font = await readFile(
      new URL(
        import.meta.resolve('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')
      )
    )
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset="UTF-8" />

      <style>
      @font-face {font-family:Manrope; font-style:normal; font-weight:200 800; src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');}
      @page {
      size: A4;
      margin: 20mm;
      }

      body {
      font-family: Manrope, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111827;
      }

      h1 {
      font-size: 26pt;
      margin-bottom: 16px;
      }

      h2 {
      font-size: 20pt;
      margin-top: 32px;
      }

      h3 {
      font-size: 16pt;
      margin-top: 24px;
      }

      p {
      margin: 0 0 12px;
      }

      img {
      max-width: 100%;
      height: auto;
      }

      ul,
      ol {
      padding-left: 24px;
      }

      blockquote {
      border-left: 4px solid #ddd;
      padding-left: 16px;
      color: #555;
      }

      a {
      color: inherit;
      }
      ${publication ? PUBLICATION_CSS : ''}
      </style>
      </head>

      <body>
      <article>
      ${preview ? '<p style="font-size:10pt;font-weight:bold;border-bottom:2px solid #f6d900;padding-bottom:12px">PREVIEW · NOT APPROVED FOR FINAL EXPORT</p>' : ''}
      ${contentHtml}
      </article>
      </body>
      </html>
    `

    return html
  }
  static async generate(version: DocumentVersion, options: RenderOptions = {}) {
    const { preview = false } = options
    const html = await this.html(version, options)
    const browser = await chromium.launch().catch(() => {
      throw new PdfUnavailableException()
    })

    try {
      const page = await browser.newPage()

      await page.route('**/*', (route) => route.abort())
      await page.setContent(html, {
        waitUntil: 'networkidle',
      })

      return await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: preview,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="font-family:Arial;font-size:8px;width:100%;text-align:center">PREVIEW · NOT APPROVED</div>',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      })
    } finally {
      await browser.close()
    }
  }
}
