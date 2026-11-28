import { test } from '@japa/runner'
import {
  balanceLines,
  charsPerLine,
  hasOverlongWord,
  lineCount,
  textWidth,
  trimToLines,
  wrap,
} from '../../shared/canvas/portfolio/measure.ts'
import { ENTRY, COVER } from '../../shared/canvas/portfolio/tokens.ts'

/**
 * The widths below were measured in Chromium with the template's fonts (the design's own
 * tokens.json boxes): the estimator must stay within a point of the browser.
 */
test.group('portfolio text measure', () => {
  test('text widths match the browser within a point', ({ assert }) => {
    // entry.section_label (7.5pt semibold, 1.05pt tracking, upper case): box 77.71pt wide.
    assert.approximately(textWidth('Service design', 'tagLabel'), 77.71, 0.6)
    // entry.doc_title (7pt regular): 153.75pt.
    assert.approximately(
      textWidth('Selected work · Research and product design', 'footer'),
      153.75,
      1
    )
    // cover.eyebrow (8.5pt semibold, 1.53pt tracking, upper case): 174.04pt.
    assert.approximately(textWidth('Selected project portfolio', 'eyebrow'), 174.04, 0.6)
    // sources.section_label: 117pt.
    assert.approximately(textWidth('Sources & references', 'tagLabel'), 117, 0.6)
  })

  test('the design’s own copy wraps onto the line counts its slots hold', ({ assert }) => {
    const lines = (text: string, width: number, role: Parameters<typeof lineCount>[2]) =>
      lineCount(text, width, role)
    assert.equal(
      lines(
        'A local service team handled requests across email and shared spreadsheets. Follow-up was difficult to track.',
        ENTRY.rowsW,
        'rowBody'
      ),
      2
    )
    assert.equal(
      lines('Map the journey, simplify intake and test the triage flow.', ENTRY.rowsW, 'rowBody'),
      1
    )
    assert.equal(
      lines('Prototype findings; production impact unmeasured.', ENTRY.rowsW, 'rowBody'),
      1
    )
    assert.equal(lines('Entry 01: a clearer path to support', 493.5, 'heading'), 1)
  })

  test('explicit newlines break lines, and trailing spaces do not count', ({ assert }) => {
    assert.deepEqual(wrap('one\ntwo', 400, 'intro'), ['one', 'two'])
    assert.equal(lineCount('', 100, 'intro'), 0)
  })

  test('a break is allowed after a hyphen or a dash', ({ assert }) => {
    const text = 'follow-up and cross-team hand-offs everywhere'
    const narrow = textWidth('follow-up and cross-', 'intro') + 1
    const out = wrap(text, narrow, 'intro')
    assert.isAbove(out.length, 1)
    assert.isTrue(out[0].endsWith('-') || out[0].endsWith('and cross-'))
  })

  test('an unbreakable word wider than the frame is reported', ({ assert }) => {
    assert.isTrue(hasOverlongWord('x'.repeat(80), 100, 'rowBody'))
    assert.isFalse(hasOverlongWord('plain words only', 100, 'rowBody'))
  })

  test('a cover title is composed onto at most three even lines', ({ assert }) => {
    const lines = balanceLines(
      'Designing the next chapter of public services',
      COVER.title.w,
      'coverTitle',
      3
    )!
    assert.lengthOf(lines, 3)
    for (const line of lines) assert.isAtMost(textWidth(line, 'coverTitle'), COVER.title.w)
    assert.equal(lines.join(' '), 'Designing the next chapter of public services')
    assert.deepEqual(balanceLines('Portfolio', COVER.title.w, 'coverTitle', 3), ['Portfolio'])
    assert.isNull(balanceLines('word '.repeat(60), COVER.title.w, 'coverTitle', 3))
  })

  test('trimming cuts at a sentence, else a word, and never mid-word', ({ assert }) => {
    const text =
      'First sentence is short. Second sentence keeps going for quite a while longer than the first one does.'
    const one = trimToLines(text, ENTRY.rowsW, 'rowBody', 1)
    assert.isTrue(one.cut)
    assert.equal(one.text, 'First sentence is short.')
    assert.deepEqual(trimToLines('fits', 100, 'rowBody', 1), { text: 'fits', cut: false })
    const words = trimToLines(
      'alpha beta gamma delta epsilon zeta eta theta iota kappa',
      60,
      'rowBody',
      1
    )
    assert.match(words.text, /^[a-z ]+\.$/)
    assert.isAtMost(lineCount(words.text, 60, 'rowBody'), 1)
  })

  test('characters per line follow the width and the type', ({ assert }) => {
    assert.isAbove(charsPerLine(ENTRY.rowsW, 'rowBody'), 45)
    assert.isBelow(charsPerLine(ENTRY.rowsW, 'rowBody'), 70)
    assert.isAbove(charsPerLine(430, 'intro'), 60)
  })
})
