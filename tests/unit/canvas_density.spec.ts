import { test } from '@japa/runner'
import { PLACEHOLDER } from '../../shared/brochure/content.ts'
import {
  composeAcademic,
  composeAcademicSheet,
  type AcademicMeta,
} from '../../shared/canvas/academic/compose.ts'
import {
  DEFAULT_THRESHOLDS,
  densityReport,
  overlap,
  pageMetrics,
  pageProblems,
} from '../../shared/canvas/density.ts'
import { IMAGE } from '../fixtures/canvas/index.ts'
import { prose, samplePage } from '../fixtures/canvas/academic.ts'

const meta: AcademicMeta = { title: 'T', label: 'Report', keywords: [], references: [] }
const image = { imageId: IMAGE, alt: 'a', caption: 'c' }

test.group('canvas density', () => {
  test('a well filled page passes every threshold', ({ assert }) => {
    const m = pageMetrics(
      composeAcademicSheet({ design: 'essay', page: samplePage('essay') }, 2, meta),
      2
    )
    assert.equal(m.kind, 'content')
    assert.isAtLeast(m.words, DEFAULT_THRESHOLDS.minWords)
    assert.isAtLeast(m.fill ?? 0, 0.7)
    assert.isAtLeast(m.citations, 2)
    assert.equal(m.placeholders, 0)
    assert.deepEqual(pageProblems(m), [])
  })

  test('a thin page is reported with its words and fill', ({ assert }) => {
    const page = samplePage('essay', { fill: 0.1 })
    const m = pageMetrics(composeAcademicSheet({ design: 'essay', page }, 2, meta), 2)
    const codes = pageProblems(m).map((p) => p.code)
    assert.include(codes, 'fill')
    assert.include(
      pageProblems(m, { ...DEFAULT_THRESHOLDS, minWords: m.words + 1 }).map((p) => p.code),
      'words'
    )
    assert.equal(m.fit, 'thin')
  })

  test('an overflowing frame is reported', ({ assert }) => {
    const page = samplePage('essay', { fill: 1.6 })
    const m = pageMetrics(composeAcademicSheet({ design: 'essay', page }, 2, meta), 2)
    assert.equal(m.fit, 'over')
    assert.include(
      pageProblems(m).map((p) => p.code),
      'overflow'
    )
  })

  test('uncited pages and placeholders are reported', ({ assert }) => {
    const page = samplePage('essay', { uncited: true })
    page.sections[0].paragraphs[0].text = PLACEHOLDER
    const m = pageMetrics(composeAcademicSheet({ design: 'essay', page }, 2, meta), 2)
    assert.equal(m.citations, 0)
    assert.equal(m.placeholders, 1)
    const codes = pageProblems(m).map((p) => p.code)
    assert.includeMembers(codes, ['citations', 'placeholders'])
  })

  test('title, contents and references are exempt from the content thresholds', ({ assert }) => {
    const canvas = composeAcademic(
      [
        { design: 'title_page', page: samplePage('title_page') },
        { design: 'contents' },
        { design: 'references' },
      ],
      { ...meta, references: [{ label: 'source.pdf', pages: 'p. 1' }] }
    )
    const report = densityReport(canvas)
    assert.deepEqual(
      report.pages.map((p) => p.kind),
      ['title', 'contents', 'references']
    )
    assert.deepEqual(
      report.pages.flatMap((p) => pageProblems(p)),
      []
    )
    assert.equal(report.avgFill, 0)
  })

  test('image resolution comes from the pixel size and the frame', ({ assert }) => {
    const sheet = composeAcademicSheet(
      { design: 'figure_text', page: samplePage('figure_text'), image },
      2,
      meta
    )
    const sharp = pageMetrics(sheet, 2, {
      images: new Map([[IMAGE, { width: 2400, height: 1600 }]]),
    })
    assert.isAtLeast(sharp.images[0].dpi ?? 0, 300)
    assert.equal(sharp.lowDpiImages, 0)
    const soft = pageMetrics(sheet, 2, { images: new Map([[IMAGE, { width: 600, height: 400 }]]) })
    assert.isBelow(soft.images[0].dpi ?? 999, 200)
    assert.equal(soft.lowDpiImages, 1)
    assert.include(
      pageProblems(soft).map((p) => p.code),
      'dpi'
    )
    // An image whose size is unknown is not guessed at.
    assert.isNull(pageMetrics(sheet, 2).images[0].dpi)
  })

  test('the document report totals its pages', ({ assert }) => {
    const canvas = composeAcademic(
      [
        { design: 'essay', page: samplePage('essay') },
        { design: 'two_column', page: samplePage('two_column') },
      ],
      meta
    )
    const report = densityReport(canvas)
    assert.equal(report.pages.length, 2)
    assert.equal(report.words, report.pages[0].words + report.pages[1].words)
    assert.isAbove(report.avgFill, 0.7)
    assert.isAbove(report.citations, 4)
  })

  test('phrase overlap finds repeated pages and ignores different ones', ({ assert }) => {
    assert.isAbove(overlap(prose(120), prose(120)), 0.9)
    assert.isBelow(
      overlap(
        prose(60, 0),
        'Quite different words appear here and nothing is repeated at all today'
      ),
      0.05
    )
    assert.equal(overlap('', prose(20)), 0)
    const same = composeAcademic(
      [
        { design: 'essay', page: samplePage('essay') },
        { design: 'essay', page: samplePage('essay') },
      ],
      meta
    )
    assert.isAbove(densityReport(same).maxOverlap, 0.15)
  })
})
