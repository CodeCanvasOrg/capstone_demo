import { test } from '@japa/runner'
import { columnLayout, paginate, sectionRoles, type BlockInfo } from '../../shared/layout/pages.ts'

const h = (level: number, text: string): BlockInfo => ({ type: 'heading', level, text })
const p = (text = 'text'): BlockInfo => ({ type: 'paragraph', text })

test.group('Editor section roles', () => {
  test('the first heading and its summary form the hero', ({ assert }) => {
    const roles = sectionRoles([h(1, 'Title'), p('Sub'), h(2, 'Key results'), p('90% — x')])
    assert.deepEqual(roles, ['hero', 'hero', 'results', 'results'])
  })

  test('each known section keeps its role until the next heading', ({ assert }) => {
    const roles = sectionRoles([
      h(1, 'T'),
      p(),
      h(2, 'The challenge'),
      p(),
      h(2, 'The solution'),
      p(),
      h(2, 'How it works'),
      { type: 'orderedList', text: '' },
      h(2, 'Key capabilities'),
      { type: 'bulletList', text: '' },
      h(2, 'Roadmap'),
      p(),
    ])
    assert.deepEqual(roles.slice(2), [
      'challenge',
      'challenge',
      'solution',
      'solution',
      'steps',
      'steps',
      'capabilities',
      'capabilities',
      'roadmap',
      'roadmap',
    ])
  })

  test('legacy headings get no role, so old documents keep their plain look', ({ assert }) => {
    const roles = sectionRoles([h(1, 'T'), p(), h(2, 'Executive Summary'), p()])
    assert.deepEqual(roles.slice(2), [null, null])
  })

  test('an image right after the subhead belongs to the hero', ({ assert }) => {
    const roles = sectionRoles([
      h(1, 'Title'),
      p('Sub'),
      { type: 'image', text: '' },
      h(2, 'Key results'),
    ])
    assert.deepEqual(roles, ['hero', 'hero', 'hero', 'results'])
    // An image further down is just an image.
    const later = sectionRoles([h(1, 'T'), p(), h(2, 'The challenge'), { type: 'image', text: '' }])
    assert.equal(later[3], 'challenge')
  })

  test('a document without a leading title has no hero', ({ assert }) => {
    assert.deepEqual(sectionRoles([p(), h(2, 'The challenge'), p()]), [
      null,
      'challenge',
      'challenge',
    ])
  })
})

test.group('Editor pagination', () => {
  test('blocks flow onto pages by measured height', ({ assert }) => {
    const result = paginate([300, 300, 300, 300], { pageHeight: 700 })
    assert.deepEqual(result.pageOf, [0, 0, 1, 1])
    assert.equal(result.pages, 2)
  })

  test('the spacer pushes the first block of a new page to the page boundary', ({ assert }) => {
    const result = paginate([300, 300, 300], { pageHeight: 700 })
    assert.deepEqual(result.breaks, [{ before: 2, fill: 100, page: 2 }])
  })

  test('a heading is never stranded at the bottom of a page', ({ assert }) => {
    const result = paginate([500, 60, 300], { pageHeight: 700, keepWithNext: [false, true, false] })
    assert.deepEqual(result.pageOf, [0, 1, 1])
  })

  test('a block taller than a page gets its own page and is flagged', ({ assert }) => {
    const result = paginate([100, 900, 100], { pageHeight: 700 })
    assert.deepEqual(result.pageOf, [0, 1, 2])
    assert.deepEqual(result.oversized, [1])
  })

  test('over budget is reported, never hidden', ({ assert }) => {
    const result = paginate([700, 700, 700], { pageHeight: 700, budget: 2 })
    assert.equal(result.pages, 3)
    assert.isTrue(result.overBudget)
    assert.isFalse(paginate([700, 700], { pageHeight: 700, budget: 2 }).overBudget)
  })

  test('an empty document is one page', ({ assert }) => {
    assert.equal(paginate([], { pageHeight: 700 }).pages, 1)
  })
})

test.group('Two-column challenge and solution', () => {
  test('a challenge/solution run shares one row: the taller column sets the height', ({
    assert,
  }) => {
    // h2, p | h2, p  -> challenge column 20+80, solution column 20+120
    const out = columnLayout(
      ['hero', 'challenge', 'challenge', 'solution', 'solution', null],
      [200, 20, 80, 20, 120, 50]
    )
    assert.deepEqual(out.heights, [200, 140, 0, 0, 0, 50])
    assert.deepEqual(out.glue, [false, false, true, true, true, false])
  })

  test('works when the solution comes first, and ignores a lone section', ({ assert }) => {
    const swapped = columnLayout(['solution', 'solution', 'challenge'], [20, 60, 90])
    assert.deepEqual(swapped.heights, [90, 0, 0])
    const lone = columnLayout(['challenge', 'challenge', null], [20, 60, 40])
    assert.deepEqual(lone.heights, [20, 60, 40])
    assert.deepEqual(lone.glue, [false, false, false])
  })

  test('a page never breaks inside the pair', ({ assert }) => {
    const heights = [600, 100, 0, 0, 0]
    const glue = [false, false, true, true, true]
    const result = paginate(heights, { pageHeight: 650, glue })
    // The pair does not fit under the 600px block, so the whole pair starts page 2.
    assert.deepEqual(result.pageOf, [0, 1, 1, 1, 1])
    assert.deepEqual(
      result.breaks.map((b) => b.before),
      [1]
    )
  })
})

test.group('Page usage for the status chip', () => {
  test('reports how full the last page is', ({ assert }) => {
    const result = paginate([700, 350], { pageHeight: 700 })
    assert.equal(result.lastFill, 0.5)
    assert.deepEqual(result.used, [700, 350])
  })

  test('excess is the content beyond the budgeted pages', ({ assert }) => {
    const result = paginate([700, 700, 300], { pageHeight: 700, budget: 2 })
    assert.equal(result.excess, 300)
    assert.equal(paginate([700, 700], { pageHeight: 700, budget: 2 }).excess, 0)
    assert.equal(paginate([700], { pageHeight: 700 }).excess, 0)
  })
})
