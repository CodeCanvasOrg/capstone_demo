import PdfUnavailableException from '#exceptions/pdf_unavailable_exception'
import { readFile } from 'node:fs/promises'
import { Node, type JSONContent } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { chromium } from 'playwright'
import {
  parseClientRenderData,
  type ClientBlock,
  type ClientInline,
  type ClientRenderData,
  type ClientResult,
} from '../../../shared/publication/client.ts'

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
.results { margin-top: 24px; padding: 10px 14px; border-left: 4px solid #f6d900; background: #f9fafb; break-inside: avoid; }
.results h2 { font-size: 11pt; border: 0; margin: 0 0 6px; }
.results ul { margin: 0; padding-left: 18px; }
.results .qualifier { font-size: 8pt; color: #4b5563; text-transform: uppercase; letter-spacing: .04em; }
.sources { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9pt; color: #4b5563; break-inside: avoid; }
.sources h2 { font-size: 11pt; border: 0; margin: 0 0 6px; }
.sources ol { margin: 0; padding-left: 20px; }
`

const QUALIFIER_LABELS = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
} as const

/** Context the author supplied, in a fixed order; absent fields print nothing. */
function resultContext(result: ClientResult) {
  const parts = [
    result.units,
    result.scope,
    result.baseline && `baseline: ${result.baseline}`,
    result.period,
    result.methodology,
  ].filter((part): part is string => Boolean(part))
  return parts.length ? ` — ${parts.map(esc).join('; ')}` : ''
}

/** Client DTO to TipTap JSON. Its input is exclusively the closed client union. */
const inline = (node: ClientInline): JSONContent => {
  if (node.type === 'reference') return { type: 'reference', attrs: { number: node.number } }
  if (node.type === 'hardBreak') return { type: 'hardBreak' }
  return {
    type: 'text',
    text: node.text,
    ...(node.marks?.length
      ? {
          marks: node.marks.map((mark) =>
            mark.type === 'link'
              ? {
                  type: 'link',
                  attrs: { href: mark.href, target: '_blank', rel: 'noopener noreferrer' },
                }
              : { type: mark.type }
          ),
        }
      : {}),
  }
}

const block = (node: ClientBlock): JSONContent => {
  switch (node.type) {
    case 'paragraph':
    case 'codeBlock':
      return { type: node.type, ...(node.content ? { content: node.content.map(inline) } : {}) }
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: node.level },
        ...(node.content ? { content: node.content.map(inline) } : {}),
      }
    case 'horizontalRule':
      return { type: 'horizontalRule' }
    case 'blockquote':
      return { type: 'blockquote', content: node.content.map(block) }
    case 'bulletList':
    case 'orderedList':
      return {
        type: node.type,
        ...(node.type === 'orderedList' && node.start !== undefined
          ? { attrs: { start: node.start } }
          : {}),
        content: node.content.map((item) => ({
          type: 'listItem',
          content: item.content.map(block),
        })),
      }
    case 'image': {
      const { type, ...attrs } = node
      return { type, attrs }
    }
  }
}

export default class ExportPdfService {
  /**
   * Both layouts render the strict client DTO only. The value is re-parsed here,
   * so a saved document or any record carrying internal fields cannot be passed in.
   * `publication` selects the layout, never the privacy checks.
   */
  static async html(
    data: ClientRenderData,
    { preview = false, publication = false }: RenderOptions = {}
  ) {
    const client = parseClientRenderData(data)
    const extensions = [StarterKit, Image, ReferenceExtension]
    const render = (blocks: ClientBlock[]) =>
      blocks.length
        ? generateHTML({ type: 'doc', content: blocks.map(block) } as JSONContent, extensions)
        : ''
    const sources = client.sources.length
      ? `<section class="sources"><h2>Sources</h2><ol>${client.sources
          .map(
            (source) =>
              `<li value="${source.number}">${esc(source.label)}${source.page ? `, p. ${source.page}` : ''}</li>`
          )
          .join('')}</ol></section>`
      : ''
    // The qualifier is visible text beside its value, not only a style or tooltip.
    const results = client.results?.length
      ? `<section class="results"><h2>Key results</h2><ul>${client.results
          .map(
            (result) =>
              `<li><strong>${esc(result.value)}</strong> <span class="qualifier">${QUALIFIER_LABELS[result.qualifier]}</span>${resultContext(result)}</li>`
          )
          .join('')}</ul></section>`
      : ''
    const summary = client.summary ? render([client.summary]) : ''
    const contentHtml = publication
      ? `
      <header class="hero">
      ${client.title ? `<h1>${esc(client.title)}</h1>` : ''}
      ${summary ? `<div class="summary">${summary}</div>` : ''}
      </header>
      ${render(client.body)}
      ${results}
      ${sources}`
      : `
      ${client.title ? `<h1>${esc(client.title)}</h1>` : ''}
      ${summary}
      ${render(client.body)}
      ${results}
      ${sources}`

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
  static async generate(data: ClientRenderData, options: RenderOptions = {}) {
    const { preview = false } = options
    const html = await this.html(data, options)
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
