import { test } from '@japa/runner'
import { densityReport, overlap, pageMetrics } from '../../shared/canvas/density.ts'
import { IMAGE, minimal } from '../fixtures/canvas/index.ts'
import { PROSE } from '../fixtures/canvas/prose.ts'

// The density report still measures saved canvases made before the portfolio template
// (`canvas:density`); portfolio canvases use `portfolioReport`.
test.group('canvas density', () => {
  test('image resolution comes from the pixel size and the frame', ({ assert }) => {
    const sheet = minimal().sheets[1]
    const sharp = pageMetrics(sheet, 2, {
      images: new Map([[IMAGE, { width: 2400, height: 1600 }]]),
    })
    assert.isAtLeast(sharp.images[0].dpi ?? 0, 300)
    assert.equal(sharp.lowDpiImages, 0)
    const soft = pageMetrics(sheet, 2, { images: new Map([[IMAGE, { width: 600, height: 400 }]]) })
    assert.isBelow(soft.images[0].dpi ?? 999, 200)
    assert.equal(soft.lowDpiImages, 1)
    // An image whose size is unknown is not guessed at.
    assert.isNull(pageMetrics(sheet, 2).images[0].dpi)
  })

  test('citations are counted', ({ assert }) => {
    assert.equal(pageMetrics(minimal().sheets[0], 1).citations, 1)
  })

  test('the document report totals its pages', ({ assert }) => {
    const report = densityReport(minimal())
    assert.equal(report.pages.length, 2)
    assert.equal(report.words, report.pages[0].words + report.pages[1].words)
    assert.equal(report.citations, 1)
  })

  test('phrase overlap finds repeated pages and ignores different ones', ({ assert }) => {
    assert.isAbove(overlap(PROSE[0], PROSE[0]), 0.9)
    assert.isBelow(
      overlap(PROSE[0], 'Quite different words appear here and nothing is repeated at all today'),
      0.05
    )
    assert.equal(overlap('', PROSE[1]), 0)
  })
})
