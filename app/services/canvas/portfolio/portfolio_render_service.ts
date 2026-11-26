import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import ContentService from '#services/documents/content_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import ExportPdfService from '#services/exports/pdf_service'
import {
  brandForCanvas,
  projectionDocument,
  renderCanvasHtml,
  splitProjected,
} from '#services/exports/canvas_renderer'
import { defaultLayout } from '#services/layout/layout_validation'
import {
  composePortfolio,
  type PortfolioInput,
} from '../../../../shared/canvas/portfolio/compose.ts'
import { SAMPLE } from '../../../../shared/canvas/portfolio/sample.ts'
import { type CanvasDocument } from '../../../../shared/canvas/model.ts'
import { getBrandKit } from '../../../../shared/layout/brand.ts'

const run = promisify(execFile)

/** Raster width the design's preview PNGs use: A4 at 90 dpi. */
export const PREVIEW_DPI = 90

/** The sample document composed from the design's own content. */
export const sampleCanvas = (input: PortfolioInput = SAMPLE): CanvasDocument =>
  composePortfolio(input)

/**
 * Draws a portfolio canvas the way every export does: its text goes through the same
 * projection (footnote numbering included), the template's brand kit supplies colours and
 * fonts, and Chromium prints it. Used by the CLI, the template seeder and the tests.
 */
export default class PortfolioRenderService {
  /** The canvas as one printable HTML page. There is no evidence to resolve in a template. */
  async html(canvas: CanvasDocument) {
    const layout = defaultLayout()
    const pinned = getBrandKit(layout.brandId, layout.brandVersion)!
    const brand = brandForCanvas(canvas, pinned)
    const content = new ContentService().normalize(projectionDocument(canvas), { repair: true })
    const { client } = new PublicationProjectionService().project(content)
    return renderCanvasHtml(canvas, brand, { content: splitProjected(canvas, client.body) })
  }

  async pdf(canvas: CanvasDocument) {
    return ExportPdfService.fromHtml(await this.html(canvas))
  }

  /** A PNG of every page of a PDF at `dpi`, with poppler when it is installed, else Chromium. */
  async pages(canvas: CanvasDocument, dpi = PREVIEW_DPI): Promise<Buffer[]> {
    const html = await this.html(canvas)
    const dir = await mkdtemp(join(tmpdir(), 'portfolio-'))
    try {
      const pdf = Buffer.from(await ExportPdfService.fromHtml(html))
      await writeFile(join(dir, 'doc.pdf'), pdf)
      try {
        await run('pdftoppm', ['-r', String(dpi), '-png', join(dir, 'doc.pdf'), join(dir, 'page')])
        const listed = await readdir(dir)
        const files = listed.filter((f) => f.endsWith('.png')).sort()
        return Promise.all(files.map((f) => readFile(join(dir, f))))
      } catch {
        return await this.screenshots(html, dpi)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  /** Chromium screenshots of each sheet, scaled to `dpi`. */
  private async screenshots(html: string, dpi: number) {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 794, height: 1123 },
        deviceScaleFactor: dpi / 96,
      })
      await page.setContent(html)
      await page.evaluate(() => document.fonts.ready)
      const out: Buffer[] = []
      for (const sheet of await page.locator('.cv-sheet').all()) out.push(await sheet.screenshot())
      return out
    } finally {
      await browser.close()
    }
  }

  /** Writes the PDF and the page PNGs of a canvas into `directory`. */
  async write(canvas: CanvasDocument, directory: string, dpi = PREVIEW_DPI) {
    await mkdir(directory, { recursive: true })
    const pdf = Buffer.from(await this.pdf(canvas))
    const pdfPath = join(directory, 'portfolio-sample.pdf')
    await writeFile(pdfPath, pdf)
    const pngs = await this.pages(canvas, dpi)
    const pngPaths: string[] = []
    for (const [i, png] of pngs.entries()) {
      const path = join(directory, `page-${i + 1}.png`)
      await writeFile(path, png)
      pngPaths.push(path)
    }
    return { pdfPath, pngPaths }
  }
}
