import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { templateHtml } from '#services/canvas/canvas_template_seeder'
import { defaultLayout } from '#services/layout/layout_validation'
import { composeAcademic, type AcademicMeta } from '../../shared/canvas/academic/compose.ts'
import { ACADEMIC_DESIGN_IDS, FIXED_DESIGN_IDS } from '../../shared/canvas/academic/designs.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import { samplePage } from '../fixtures/canvas/academic.ts'

const meta: AcademicMeta = {
  title: 'Cooling cities: evidence for heat mitigation',
  label: 'Academic report',
  date: '23 November 2026',
  keywords: ['urban heat', 'reflective roofs'],
  references: [{ label: 'heat_study.pdf', pages: 'pp. 3, 5' }],
}

/**
 * The estimator's promise, checked in the real renderer: a page written to the design's
 * range does not run past any of its frames. Skipped where Chromium is not installed.
 * When fonts or the canvas CSS change and this fails, re-run scripts/calibrate_fit.ts.
 */
test.group('Academic pages in Chromium', () => {
  test('every design, filled as the writer is told to fill it, fits every frame', async ({
    assert,
  }) => {
    if (!existsSync(chromium.executablePath())) return
    const layout = defaultLayout()
    const brand = getBrandKit(layout.brandId, layout.brandVersion)!
    const inputs = ACADEMIC_DESIGN_IDS.map((design) => ({
      design,
      ...(FIXED_DESIGN_IDS.includes(design as never) && design !== 'title_page'
        ? {}
        : { page: samplePage(design) }),
      image: null,
    }))
    const canvas = composeAcademic(inputs, meta)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
      await page.setContent(await templateHtml(canvas, brand))
      const over = await page.evaluate(() =>
        [...document.querySelectorAll('.cv-text')].flatMap((el) => {
          const e = el as HTMLElement
          // A 4 px (about 1 mm) tolerance covers a line's descender at a frame's edge.
          return e.scrollHeight > e.clientHeight + 4
            ? [`${e.id}: ${e.scrollHeight}px in ${e.clientHeight}px`]
            : []
        })
      )
      assert.deepEqual(over, [])
      // The render really drew the text: an empty frame would pass the check above.
      const empty = await page.evaluate(
        () =>
          [...document.querySelectorAll('.cv-text')].filter((e) => !e.textContent?.trim()).length
      )
      assert.equal(empty, 0)
    } finally {
      await browser.close()
    }
  })
})
