/**
 * Calibrates the text-capacity estimator (shared/canvas/fit.ts) against the real
 * renderer: sets fixed prose in a frame with the exact CSS the exports use, in
 * Chromium, measures the height it takes and fits the average glyph width that
 * makes the estimate match. Writes tests/fixtures/canvas/fit_calibration.json,
 * which tests/unit/canvas_fit.spec.ts checks the committed constants against.
 *
 *   node scripts/calibrate_fit.ts
 */
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { CANVAS_BASE_CSS, declarations, frameCss } from '../shared/canvas/css.ts'
import { FIT, blocksHeight } from '../shared/canvas/fit.ts'
import type { Frame, FrameStyle, TipTapBlock } from '../shared/canvas/model.ts'
import { PROSE } from '../tests/fixtures/canvas/prose.ts'

const PX_PER_MM = 96 / 25.4
const families = ['serif', 'sans'] as const
const sizes = ['sm', 'md'] as const
const widths = [830, 1000, 1360, 1700]

const paragraph = (text: string): TipTapBlock => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

const browser = await chromium.launch()
const page = await browser.newPage()
const cases: {
  family: string
  font: string
  width: number
  measuredMm: number
  words: number
}[] = []

for (const family of families)
  for (const font of sizes)
    for (const width of widths) {
      const style: FrameStyle = { family, font, lineHeight: 145, align: 'justify' }
      const blocks = PROSE.map(paragraph)
      const frame = {
        id: 'x',
        kind: 'text',
        geo: { x: 0, y: 0, w: width, h: 2000 },
        z: 0,
        order: 0,
        style,
        doc: blocks,
      } as Frame
      const css = { ...frameCss(frame), height: 'auto' }
      const html = `<!doctype html><style>*{box-sizing:border-box}body{margin:0;font-size:9.5pt}${CANVAS_BASE_CSS}</style><div class="cv-frame cv-text" id="f" style="${declarations(css)}">${PROSE.map((p) => `<p>${p}</p>`).join('')}</div>`
      await page.setContent(html)
      const px = await page.evaluate(() => document.getElementById('f')!.scrollHeight)
      // The last paragraph's gap is not drawn (`:last-child{margin-bottom:0}`), as in the estimate.
      cases.push({
        family,
        font,
        width,
        measuredMm: Number((px / PX_PER_MM).toFixed(2)),
        words: PROSE.join(' ').split(/\s+/).length,
      })
    }
const resolved = await page.evaluate(() => navigator.userAgent)
await browser.close()

/** The glyph width at which the estimate equals the measurement, by bisection. */
function fitted(family: 'serif' | 'sans', font: string, width: number, measured: number) {
  const style: FrameStyle = { family, font: font as never, lineHeight: 145, align: 'justify' }
  const blocks = PROSE.map(paragraph)
  const original = FIT.glyph[family]
  let lo = 0.3
  let hi = 0.8
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    ;(FIT.glyph as Record<string, number>)[family] = mid
    const est = blocksHeight(blocks, { w: width, h: 2000 }, style)
    if (est > measured) hi = mid
    else lo = mid
  }
  ;(FIT.glyph as Record<string, number>)[family] = original
  return Number(((lo + hi) / 2).toFixed(3))
}

const out = cases.map((c) => ({
  ...c,
  glyph: fitted(c.family as 'serif' | 'sans', c.font, c.width, c.measuredMm),
}))
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
const summary = Object.fromEntries(
  families.map((f) => [f, median(out.filter((c) => c.family === f).map((c) => c.glyph))])
)
writeFileSync(
  new URL('../tests/fixtures/canvas/fit_calibration.json', import.meta.url),
  `${JSON.stringify({ renderer: resolved, summary, cases: out }, null, 2)}\n`
)
console.log(JSON.stringify({ renderer: resolved, summary }, null, 2))
for (const c of out) console.log(c.family, c.font, c.width, c.measuredMm, c.glyph)
