import { test } from '@japa/runner'
import CanvasPageWriter from '#services/canvas/generation/canvas_page_writer'
import type { AcademicMeta } from '../../shared/canvas/academic/compose.ts'
import { FILL } from '../../shared/canvas/fit.ts'
import { prose, samplePage } from '../fixtures/canvas/academic.ts'

const meta: AcademicMeta = { title: 'T', label: 'Report', keywords: [], references: [] }
const writer = new CanvasPageWriter()

test.group('canvas page writer: fitting', () => {
  test('an abstract that is too long loses its last sentences until it fits', ({ assert }) => {
    const page = samplePage('title_page')
    page.lead = { text: prose(420), chunks: [] }
    assert.isAbove(writer.measure(page, 'title_page', meta).maxFrame, FILL.high)
    const { page: trimmed, cut } = writer.trim(page, 'title_page', meta)
    assert.isTrue(cut)
    assert.isAtMost(writer.measure(trimmed, 'title_page', meta).maxFrame, FILL.high)
    // It was shortened from the end, not rewritten.
    assert.isTrue(page.lead.text.startsWith(trimmed.lead!.text.slice(0, 80)))
    assert.isBelow(trimmed.lead!.text.length, page.lead.text.length)
  })

  test('trimming a page that fits changes nothing', ({ assert }) => {
    const page = samplePage('essay')
    const { page: same, cut } = writer.trim(page, 'essay', meta)
    assert.isFalse(cut)
    assert.deepEqual(same, page)
  })

  test('a long essay loses trailing paragraphs, never its first', ({ assert }) => {
    const page = samplePage('essay', { fill: 1.9 })
    const { page: trimmed, cut } = writer.trim(page, 'essay', meta)
    assert.isTrue(cut)
    assert.isAtMost(writer.measure(trimmed, 'essay', meta).maxFrame, FILL.high)
    assert.equal(trimmed.sections[0].paragraphs[0].text, page.sections[0].paragraphs[0].text)
  })

  test('a continuation page is made only where both halves fit', ({ assert }) => {
    const page = samplePage('essay', { fill: 1.35 })
    const halves = writer.split(page, 'essay', meta)
    assert.lengthOf(halves!, 2)
    assert.match(halves![1].title, /\(continued\)$/)
    assert.isNull(halves![1].lead)
    // Nothing is lost between the halves.
    assert.equal(halves!.flatMap((h) => h.sections).length, page.sections.length)
    // One section cannot be split; a page far too long cannot be split into two that fit.
    assert.isNull(writer.split({ ...page, sections: page.sections.slice(0, 1) }, 'essay', meta))
    assert.isNull(writer.split(samplePage('essay', { fill: 2.6 }), 'essay', meta))
  })
})
