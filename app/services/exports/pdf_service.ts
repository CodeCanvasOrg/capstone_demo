import { readFile } from 'node:fs/promises'
import type DocumentVersion from '#models/document_version'
import { Node, mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { chromium } from 'playwright'

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
  static async generate(version: DocumentVersion, { preview = false }: { preview?: boolean } = {}) {
    const extensions = [StarterKit, Image, SourceCitationExtension]
    const contentHtml = generateHTML(version.content, extensions)

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

    const browser = await chromium.launch()

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
