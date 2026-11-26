import { test } from '@japa/runner'
import CanvasPlanner, { pageLimit } from '#services/canvas/generation/canvas_planner'
import type { CanvasPlan } from '../../shared/canvas/academic/content.ts'
import { canvasOptionsSchema } from '../../shared/canvas/academic/options.ts'
import type { AcademicDesignId } from '../../shared/canvas/academic/designs.ts'

const chunk = (words: number) =>
  ({
    id: 'c',
    chunkIndex: 0,
    content: Array.from({ length: words }, () => 'word').join(' '),
    fileName: 'f.pdf',
    fileUrl: null,
    mediaType: null,
  }) as never

const plan = (designs: AcademicDesignId[]): CanvasPlan => ({
  thesis: 'T',
  audience: 'A',
  pages: designs.map((design, i) => ({
    design,
    title: `Page ${i}`,
    purpose: 'P',
    questions: ['One?', 'Two?'],
    keyTerms: [],
    wantsImage: false,
  })),
  coverageGaps: [],
})
// The planner under test is the legacy academic one: its options name the retired set directly.
const options = {
  ...canvasOptionsSchema.parse({}),
  profile: 'academic' as const,
  templateSet: 'academic_report' as const,
}
const planner = new CanvasPlanner({} as never)

test.group('canvas planner', () => {
  test('the sources set how many pages they can fill: one for every 100 words, at least two', ({
    assert,
  }) => {
    assert.equal(pageLimit([chunk(60)]), 2)
    assert.equal(pageLimit([chunk(250)]), 2)
    assert.equal(pageLimit([chunk(600)]), 6)
    assert.equal(pageLimit([chunk(300), chunk(900)]), 12)
    assert.equal(pageLimit([]), 2)
  })

  test('a plan with too many pages for thin sources is cut, and still closes with a conclusion', ({
    assert,
  }) => {
    const long = plan([
      'essay',
      'two_column',
      'key_concepts',
      'data_findings',
      'case_box',
      'comparison',
      'conclusion',
    ])
    assert.lengthOf(planner.repair(long, options).pages, 7)
    const cut = planner.repair(long, options, 5)
    assert.lengthOf(cut.pages, 5)
    assert.equal(cut.pages.at(-1)!.design, 'conclusion')
    // The problem is named for the model too.
    assert.match(
      planner.problems(long, options, 5).join(' '),
      /Plan 4 to 5 content pages; the previous plan had 7/
    )
    assert.deepEqual(
      planner.problems(plan(['essay', 'two_column', 'data_findings', 'conclusion']), options, 5),
      []
    )
  })

  test('the limit never lifts a template set’s ceiling and never applies to a fixed page count', ({
    assert,
  }) => {
    const four = plan(['essay', 'two_column', 'data_findings', 'conclusion'])
    assert.lengthOf(planner.repair(four, options, 50).pages, 4)
    const fixed = { ...options, pages: 8 }
    const five = plan(['essay', 'two_column', 'data_findings', 'case_box', 'conclusion'])
    // Eight pages is five content pages, however little the sources say.
    assert.deepEqual(planner.problems(five, fixed, 2), [])
    assert.lengthOf(planner.repair(five, fixed, 2).pages, 5)
  })

  test('a too-thin plan for the thin limit is allowed down to two pages', ({ assert }) => {
    const two = plan(['essay', 'conclusion'])
    assert.deepEqual(planner.problems(two, options, 2), [])
  })
})
