import PdfUnavailableException from '#exceptions/pdf_unavailable_exception'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import {
  parseClientRenderData,
  type ClientRenderData,
  type ClientResult,
} from '../../../shared/publication/client.ts'
import { getBrandKit } from '../../../shared/layout/brand.ts'
import type { LayoutPlan } from '../../../shared/layout/plan.ts'
import { esc, renderBlocks } from '#services/exports/client_blocks'
import { PAGE_MARGIN_MM, renderLayoutHtml } from '#services/exports/layout_renderer'

type RenderOptions = {
  preview?: boolean
  publication?: boolean
  /** Template layout; takes precedence over `publication`. */
  layout?: LayoutPlan
}

const PUBLICATION_CSS = `
.hero { border-top: 6px solid #ffb902; padding-top: 14px; margin-bottom: 20px; }
.hero h1 { font-size: 24pt; line-height: 1.2; margin: 0 0 10px; }
.hero .summary { font-size: 13pt; color: #374151; }
.hero .summary p { margin: 0; }
sup.ref { font-size: 7pt; line-height: 0; color: #6b7280; margin-left: 1px; }
h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; break-after: avoid; }
h3 { break-after: avoid; }
img { break-inside: avoid; }
.results { margin-top: 24px; padding: 10px 14px; border-left: 4px solid #ffb902; background: #f9fafb; break-inside: avoid; }
.results h2 { font-size: 11pt; border: 0; margin: 0 0 6px; }
.results ul { margin: 0; padding-left: 18px; }
.results .qualifier { font-size: 8pt; color: #4b5563; text-transform: uppercase; letter-spacing: .04em; }
.sources { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9pt; color: #4b5563; break-inside: avoid; }
.sources h2 { font-size: 11pt; border: 0; margin: 0 0 6px; }
.sources ol { margin: 0; padding-left: 20px; }
`

/**
 * Vercel functions have no system Chromium, so they use the serverless build from
 * @sparticuz/chromium (matched to Playwright's Chromium major). Everywhere else
 * (local, Docker worker) uses Playwright's bundled browser.
 */
async function launchChromium() {
  if (process.env.VERCEL) {
    const { default: serverless } = await import('@sparticuz/chromium')
    return chromium.launch({
      executablePath: await serverless.executablePath(),
      args: serverless.args,
      headless: true,
    })
  }
  return chromium.launch()
}

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

export default class ExportPdfService {
  /**
   * Both layouts render the strict client DTO only. The value is re-parsed here,
   * so a saved document or any record carrying internal fields cannot be passed in.
   * `publication` selects the layout, never the privacy checks.
   */
  static async html(
    data: ClientRenderData,
    { preview = false, publication = false, layout }: RenderOptions = {}
  ) {
    const client = parseClientRenderData(data)
    if (layout) {
      const brand = getBrandKit(layout.brand.id, layout.brand.version)
      if (!brand) throw new Error('Unknown brand version')
      return renderLayoutHtml(layout, brand, { preview })
    }
    const render = renderBlocks
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
      ${preview ? '<p style="font-size:10pt;font-weight:bold;border-bottom:2px solid #ffb902;padding-bottom:12px">PREVIEW · NOT APPROVED FOR FINAL EXPORT</p>' : ''}
      ${contentHtml}
      </article>
      </body>
      </html>
    `

    return html
  }
  static async generate(data: ClientRenderData, options: RenderOptions = {}) {
    const { preview = false, layout } = options
    const html = await this.html(data, options)
    const margin = layout ? `${PAGE_MARGIN_MM}mm` : '20mm'
    const browser = await launchChromium().catch(() => {
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
        // Template layouts own their page margins (a full-bleed first page) in CSS.
        ...(layout
          ? { preferCSSPageSize: true }
          : { margin: { top: margin, right: margin, bottom: margin, left: margin } }),
      })
    } finally {
      await browser.close()
    }
  }
  /** Prints a finished, self-contained HTML page; the page's own @page rule sets size and margins. */
  static async fromHtml(html: string) {
    const browser = await launchChromium().catch(() => {
      throw new PdfUnavailableException()
    })
    try {
      const page = await browser.newPage()
      await page.route('**/*', (route) => route.abort())
      await page.setContent(html, { waitUntil: 'networkidle' })
      return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
    } finally {
      await browser.close()
    }
  }
}
