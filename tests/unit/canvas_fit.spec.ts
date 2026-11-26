import { test } from '@japa/runner'
import calibration from '../fixtures/canvas/fit_calibration.json' with { type: 'json' }
import { PROSE } from '../fixtures/canvas/prose.ts'
import {
  FIT,
  FILL,
  blocksHeight,
  capacityWords,
  charsPerLine,
  effectiveDpi,
  fillRatio,
  fitOf,
  lineCapacity,
  wordCount,
} from '../../shared/canvas/fit.ts'

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

test.group('canvas fit estimator', () => {
  test('the calibrated constants are pinned', ({ assert }) => {
    // Changing a constant changes every page's capacity: re-run scripts/calibrate_fit.ts first.
    assert.deepEqual(FIT.glyph, { brand: 0.52, sans: 0.5, serif: 0.5, mono: 0.6, display: 0.52 })
    assert.equal(FIT.wordChars, 6)
    assert.equal(FIT.paragraphGap, 0.6)
    assert.equal(FIT.ptMm, 0.3528)
  })

  test('the calibration run agrees with the constants', ({ assert }) => {
    // The fitted glyph width of the Chromium measurements is within 6% of the pinned one.
    for (const family of ['serif', 'sans'] as const) {
      const fitted = (calibration.summary as Record<string, number>)[family]
      assert.closeTo(fitted / FIT.glyph[family], 1, 0.06)
    }
  })

  test('the estimate matches every Chromium measurement within 10%', ({ assert }) => {
    const blocks = PROSE.map(para)
    for (const c of calibration.cases) {
      const style = { family: c.family, font: c.font, lineHeight: 145, align: 'justify' } as never
      const estimate = blocksHeight(blocks, { w: c.width, h: 2000 }, style)
      assert.closeTo(estimate / c.measuredMm, 1, 0.1, `${c.family} ${c.font} ${c.width}`)
    }
  })

  test('capacity for a known frame', ({ assert }) => {
    // 170 x 240 mm at 9.5 pt serif, 145% line: 97 characters (glyph 0.5, 4% line loss) on 49 lines.
    const geo = { w: 1700, h: 2400 }
    const style = { family: 'serif', font: 'md', lineHeight: 145 } as const
    assert.equal(charsPerLine(geo, style), 97)
    assert.equal(lineCapacity(geo, style), 49)
    assert.equal(capacityWords(geo, style), 792)
    assert.equal(capacityWords(geo, style, 10), 630)
  })

  test('padding and font size change the capacity', ({ assert }) => {
    const geo = { w: 800, h: 1000 }
    const plain = capacityWords(geo, { family: 'sans', font: 'md' })
    assert.isBelow(capacityWords(geo, { family: 'sans', font: 'md', padding: 100 }), plain)
    assert.isAbove(capacityWords(geo, { family: 'sans', font: 'sm' }), plain)
    assert.isBelow(capacityWords(geo, { family: 'sans', font: 'lg' }), plain)
  })

  test('headings, lists and gaps take height; the last gap is not drawn', ({ assert }) => {
    const geo = { w: 1000, h: 2000 }
    const style = { family: 'serif', font: 'md', lineHeight: 145 } as const
    const one = blocksHeight([para('Short.')], geo, style)
    assert.isAbove(blocksHeight([para('Short.'), para('Short.')], geo, style), one * 2)
    const heading = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Heading' }],
    }
    assert.isAbove(blocksHeight([heading, para('Short.')], geo, style), one)
    assert.equal(blocksHeight([], geo, style), 0)
  })

  test('fill ratio edges', ({ assert }) => {
    const geo = { w: 830, h: 1200 }
    const style = { family: 'serif', font: 'md', lineHeight: 145 } as const
    const text = (words: number) => [para(Array.from({ length: words }, () => 'wordy').join(' '))]
    assert.equal(fillRatio([], geo, style), 0)
    assert.equal(fitOf(fillRatio(text(40), geo, style)), 'thin')
    assert.equal(fitOf(fillRatio(text(5000), geo, style)), 'over')
    assert.equal(fitOf(FILL.low), 'ok')
    assert.equal(fitOf(FILL.high), 'ok')
    assert.equal(fitOf(FILL.low - 0.001), 'thin')
    assert.equal(fitOf(FILL.high + 0.001), 'over')
  })

  test('words ignore punctuation-only tokens and citations', ({ assert }) => {
    assert.equal(wordCount('A — dash, and 12 numbers.'), 5)
    assert.equal(
      wordCount([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'One two' }, { type: 'sourceCitation' }],
        },
      ]),
      2
    )
  })

  test('effective resolution follows the plan formula', ({ assert }) => {
    assert.equal(effectiveDpi(2000, 170), 299)
    assert.equal(effectiveDpi(600, 170), 90)
    assert.equal(effectiveDpi(600, 0), 0)
  })
})
