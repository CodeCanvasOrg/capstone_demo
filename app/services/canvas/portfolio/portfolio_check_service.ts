import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import sharp from 'sharp'
import app from '@adonisjs/core/services/app'
import PortfolioRenderService, { PREVIEW_DPI, sampleCanvas } from './portfolio_render_service.ts'
import { frameIdFor } from '../../../../shared/canvas/portfolio/compose.ts'
import type { CanvasDocument } from '../../../../shared/canvas/model.ts'

/** Where the design lives, relative to the application root. */
export const DESIGN_DIR = 'docs/design/portfolio-template'

type Box = { x: number; y: number; w: number; h: number }
type TokenSlot = { name: string; box_pt: Box; font: { line_height_pt: number }; max_lines: number }
type Tokens = { pages: { name: string; slots: TokenSlot[] }[] }

export type Drift = {
  page: string
  slot: string
  metric: 'x' | 'y' | 'w' | 'h' | 'lines'
  expected: number
  actual: number
  delta: number
}

export type VisualResult = { page: string; differing: number; tolerance: number; ok: boolean }

/**
 * Slots whose design element is as wide as its text (inline spans, flex items), so only the
 * text's own width is comparable; and slots with padding inside the design's box (table cells).
 */
const INLINE = new Set([
  'cover.eyebrow',
  'entry.section_label',
  'sources.section_label',
  'entry.doc_title',
  'sources.doc_title',
  'entry.page_counter',
  'sources.page_counter',
])
const INSET_TOP: Record<string, number> = { th: 6, td: 9 }
const cellInset = (slot: string) =>
  slot.endsWith('.section_number')
    ? 0.75
    : slot.includes('.headers.')
      ? INSET_TOP.th
      : slot.includes('.evidence.rows.')
        ? INSET_TOP.td
        : 0
const isCell = (slot: string) => slot.includes('.headers.') || slot.includes('.evidence.rows.')
/** The reference number is a zero-line-height superscript in the design: only its left edge is comparable. */
const LEFT_ONLY = (slot: string) => slot.endsWith('.number') && slot.startsWith('sources.')
/**
 * Limits on the share of differing pixels. The geometry check is exact to a fraction of a point; the
 * pixel limits allow for the design previews being rasterised from variable-font Type 3 glyphs while
 * the export embeds static TrueType instances, which poppler anti-aliases slightly differently.
 */
const VISUAL_TOLERANCE: Record<string, number> = { cover: 0.02, entry: 0.045, sources: 0.04 }

/**
 * Renders the template's sample in Chromium and checks it against the design: the box of every
 * slot against `tokens.json` (position, width, line count against `max_lines`), and the pages
 * against the design's PNG previews. It reports drift; it never changes anything.
 */
export default class PortfolioCheckService {
  private root = () => app.makePath(DESIGN_DIR)

  async tokens(): Promise<Tokens> {
    return JSON.parse(await readFile(`${this.root()}/tokens.json`, 'utf8'))
  }

  /** The measured box of every slot of the rendered canvas, by slot name, in points. */
  private async measure(canvas: CanvasDocument, html: string) {
    const ids = canvas.sheets.map((s) => s.id)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
      await page.emulateMedia({ media: 'print' })
      await page.setContent(html)
      await page.evaluate(() => document.fonts.ready)
      return await page.evaluate((sheetIds) => {
        const out: Record<
          string,
          Record<
            string,
            { x: number; y: number; w: number; h: number; sup?: { x: number; y: number } }
          >
        > = {}
        sheetIds.forEach((sheetId) => {
          const sheet = document.getElementById(sheetId)!
          const origin = sheet.getBoundingClientRect()
          const rec: Record<
            string,
            { x: number; y: number; w: number; h: number; sup?: { x: number; y: number } }
          > = {}
          sheet.querySelectorAll<HTMLElement>('.cv-frame').forEach((frame) => {
            const target = frame.querySelector('p') ?? frame
            const r = target.getBoundingClientRect()
            const range = document.createRange()
            range.selectNodeContents(target)
            const t = range.getBoundingClientRect()
            const sup = frame.querySelector('sup')?.getBoundingClientRect()
            rec[frame.id] = {
              x: (r.x - origin.x) * 0.75,
              y: (r.y - origin.y) * 0.75,
              w: r.width * 0.75,
              h: r.height * 0.75,
              // The width of the text itself, for slots as wide as their text.
              ...({ textW: t.width * 0.75, textX: (t.x - origin.x) * 0.75 } as object),
              ...(sup
                ? { sup: { x: (sup.x - origin.x) * 0.75, y: (sup.y - origin.y) * 0.75 } }
                : {}),
            } as never
          })
          out[sheetId] = rec
        })
        return out
      }, ids)
    } finally {
      await browser.close()
    }
  }

  /** Drift of every slot of the sample against `tokens.json`. */
  async geometry(tolerance = 1): Promise<{ drift: Drift[]; checked: number; failures: Drift[] }> {
    const canvas = sampleCanvas()
    const html = await new PortfolioRenderService().html(canvas)
    const measured = await this.measure(canvas, html)
    const tokens = await this.tokens()
    const sheetOf: Record<string, string> = { cover: 's0', entry: 's1', sources: 's2' }
    const drift: Drift[] = []
    let checked = 0
    for (const design of tokens.pages) {
      const sheetId = sheetOf[design.name]
      for (const slot of design.slots) {
        const row = /^entry\.rows\.(\d+)\.citation$/.exec(slot.name)
        const frameId = row
          ? frameIdFor(sheetId, `entry.rows.${row[1]}.body`)
          : slot.name === 'entry.figure'
            ? frameIdFor(sheetId, 'figure')
            : frameIdFor(sheetId, slot.name)
        const got = measured[sheetId]?.[frameId] as
          (Box & { textW: number; textX: number; sup?: { x: number; y: number } }) | undefined
        const push = (
          metric: Drift['metric'],
          expected: number,
          actual: number,
          limit = tolerance
        ) => {
          const delta = Math.round((actual - expected) * 100) / 100
          if (Math.abs(delta) > limit || metric === 'lines')
            drift.push({ page: design.name, slot: slot.name, metric, expected, actual, delta })
        }
        checked++
        if (!got) {
          drift.push({
            page: design.name,
            slot: slot.name,
            metric: 'x',
            expected: slot.box_pt.x,
            actual: Number.NaN,
            delta: Number.NaN,
          })
          continue
        }
        const b = slot.box_pt
        if (row) {
          if (!got.sup)
            drift.push({
              page: design.name,
              slot: slot.name,
              metric: 'x',
              expected: b.x,
              actual: Number.NaN,
              delta: Number.NaN,
            })
          else {
            push('x', b.x, got.sup.x, 2)
            push('y', b.y, got.sup.y, 2)
          }
          continue
        }
        if (slot.name === 'entry.figure') {
          for (const m of ['x', 'y', 'w', 'h'] as const) push(m, b[m], got[m] + 0)
          continue
        }
        const top = b.y + cellInset(slot.name)
        push('x', b.x, INLINE.has(slot.name) ? got.textX : got.x)
        if (LEFT_ONLY(slot.name)) continue
        push('y', top, got.y)
        if (INLINE.has(slot.name)) push('w', b.w, got.textW)
        else if (isCell(slot.name)) push('w', b.w - 9, got.w)
        else push('w', b.w, got.w)
        const line = slot.font.line_height_pt || 0
        if (line > 0) {
          const lines = Math.round(got.h / line)
          if (lines > slot.max_lines && slot.max_lines > 0)
            drift.push({
              page: design.name,
              slot: slot.name,
              metric: 'lines',
              expected: slot.max_lines,
              actual: lines,
              delta: lines - slot.max_lines,
            })
          const natural = Math.round(b.h / line)
          if (
            !isCell(slot.name) &&
            Math.abs(lines - natural) >= 1 &&
            natural > 0 &&
            slot.max_lines > 0
          )
            drift.push({
              page: design.name,
              slot: slot.name,
              metric: 'lines',
              expected: natural,
              actual: lines,
              delta: lines - natural,
            })
        }
      }
    }
    return {
      drift,
      checked,
      failures: drift.filter(
        (d) => !Number.isFinite(d.delta) || d.metric === 'lines' || Math.abs(d.delta) > tolerance
      ),
    }
  }

  /** The share of pixels that differ between a rendered page and the design's preview PNG. */
  async differing(rendered: Buffer, reference: Buffer) {
    const a = await sharp(reference).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const b = await sharp(rendered)
      .resize(a.info.width, a.info.height, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer()
    const pixels = a.info.width * a.info.height
    let bad = 0
    for (let i = 0; i < pixels; i++) {
      const m =
        (Math.abs(a.data[i * 3] - b[i * 3]) +
          Math.abs(a.data[i * 3 + 1] - b[i * 3 + 1]) +
          Math.abs(a.data[i * 3 + 2] - b[i * 3 + 2])) /
        3
      if (m > 40) bad++
    }
    return bad / pixels
  }

  /** Every sample page against `preview/pw-N.png`. */
  async visual(): Promise<VisualResult[]> {
    const pages = await new PortfolioRenderService().pages(sampleCanvas(), PREVIEW_DPI)
    const names = ['cover', 'entry', 'sources']
    const out: VisualResult[] = []
    for (const [i, name] of names.entries()) {
      const reference = await readFile(`${this.root()}/preview/pw-${i + 1}.png`)
      const differing = await this.differing(pages[i], reference)
      out.push({
        page: name,
        differing,
        tolerance: VISUAL_TOLERANCE[name],
        ok: differing <= VISUAL_TOLERANCE[name],
      })
    }
    return out
  }
}
