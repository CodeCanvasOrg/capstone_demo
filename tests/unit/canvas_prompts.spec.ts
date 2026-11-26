import { test } from '@japa/runner'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  ABSTRACT_RULES,
  ACADEMIC_ADDENDUM,
  INFORMATIVE_ADDENDUM,
  SHARED_RULES,
  TEMPLATE_DESIGNS,
  condenseCorrective,
  contentPageCount,
  designGuide,
  expandCorrective,
  plannerSystem,
  problemCorrective,
  writerSystem,
} from '#services/canvas/generation/canvas_prompts'
import {
  ACADEMIC_DESIGN_IDS,
  PLANNABLE_DESIGN_IDS,
  wordRange,
} from '../../shared/canvas/academic/designs.ts'

const DIR = new URL('../fixtures/canvas/prompts/', import.meta.url)
/** Prompts are snapshotted: any edit shows up in review. UPDATE_SNAPSHOTS=1 rewrites them. */
function snapshot(name: string, value: string) {
  const file = new URL(`${name}.txt`, DIR)
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(file)) {
    mkdirSync(DIR, { recursive: true })
    writeFileSync(file, `${value}\n`)
  }
  return { actual: `${value}\n`, expected: readFileSync(file, 'utf8') }
}

test.group('canvas prompts', () => {
  const cases: [string, string][] = [
    ['shared_rules', SHARED_RULES],
    ['academic_addendum', ACADEMIC_ADDENDUM],
    ['informative_addendum', INFORMATIVE_ADDENDUM],
    ['abstract_rules', ABSTRACT_RULES],
    [
      'planner_academic_standard_auto',
      plannerSystem({
        profile: 'academic',
        depth: 'standard',
        templateSet: 'academic_report',
        pages: 'auto',
      }),
    ],
    [
      'planner_brief_concise_five',
      plannerSystem({
        profile: 'informative',
        depth: 'concise',
        templateSet: 'research_brief',
        pages: 5,
      }),
    ],
    [
      'writer_academic_essay',
      writerSystem({ profile: 'academic', depth: 'standard', design: 'essay' }),
    ],
    [
      'writer_informative_figure_detailed',
      writerSystem({ profile: 'informative', depth: 'detailed', design: 'figure_text' }),
    ],
    ['expand', expandCorrective(0.52, 140)],
    ['condense', condenseCorrective(0.18, 270)],
    [
      'problems',
      problemCorrective([
        { code: 'uncited', field: 'sections[0].paragraphs[1]' },
        { code: 'invented_figure', field: 'figures[0]', detail: '97%' },
      ]),
    ],
  ]
  for (const [name, text] of cases)
    test(`the ${name} prompt has not changed`, ({ assert }) => {
      const { actual, expected } = snapshot(name, text)
      assert.equal(actual, expected)
    })

  test('the shared rules carry the evidence and structure rules the plan requires', ({
    assert,
  }) => {
    for (const phrase of [
      'Support every factual paragraph',
      'Never create ids',
      'Never invent figures',
      '70 to 180 words',
      'upper half of the range',
    ])
      assert.include(SHARED_RULES, phrase)
    assert.notInclude(SHARED_RULES, '[insert text here]')
  })

  test('the design guide is generated from the table, so it cannot drift', ({ assert }) => {
    for (const id of PLANNABLE_DESIGN_IDS)
      for (const depth of ['concise', 'standard', 'detailed'] as const) {
        const range = wordRange(id, depth)
        assert.include(designGuide(id, depth), `Words: ${range.min} to ${range.max}`)
      }
    for (const id of ACADEMIC_DESIGN_IDS) assert.include(designGuide(id), `- ${id} (`)
  })

  test('the planner is offered only the designs its template set allows', ({ assert }) => {
    const brief = plannerSystem({
      profile: 'academic',
      depth: 'standard',
      templateSet: 'research_brief',
      pages: 'auto',
    })
    assert.include(brief, '- figure_text (')
    assert.notInclude(brief, '- two_column (')
    for (const id of ['title_page', 'contents', 'references'])
      assert.notInclude(
        plannerSystem({
          profile: 'academic',
          depth: 'standard',
          templateSet: 'academic_report',
          pages: 'auto',
        }),
        `- ${id} (`
      )
    assert.includeMembers(
      [...TEMPLATE_DESIGNS.research_brief],
      ['figure_text', 'data_findings', 'conclusion']
    )
  })

  test('the number of content pages follows the request and the depth', ({ assert }) => {
    assert.deepEqual(contentPageCount('academic_report', 'standard', 'auto'), { min: 4, max: 8 })
    assert.deepEqual(contentPageCount('academic_report', 'detailed', 'auto'), { min: 6, max: 10 })
    assert.deepEqual(contentPageCount('research_brief', 'standard', 'auto'), { min: 2, max: 4 })
    // Six pages or more add a contents page: 8 pages is title, contents, 5 content, references.
    assert.deepEqual(contentPageCount('academic_report', 'standard', 8), { min: 5, max: 5 })
    assert.deepEqual(contentPageCount('academic_report', 'standard', 5), { min: 3, max: 3 })
    assert.deepEqual(contentPageCount('academic_report', 'standard', 3), { min: 1, max: 1 })
  })

  test('the writer is told the design and its register', ({ assert }) => {
    const academic = writerSystem({ profile: 'academic', depth: 'standard', design: 'essay' })
    assert.include(academic, 'formal academic prose')
    assert.include(academic, '"design" is exactly essay')
    assert.notInclude(academic, 'informed non-specialist')
    assert.include(
      writerSystem({ profile: 'informative', depth: 'standard', design: 'essay' }),
      'informed non-specialist'
    )
  })

  test('the correctives carry their numbers', ({ assert }) => {
    assert.include(expandCorrective(0.5, 120), 'fills 50% of its layout')
    assert.include(expandCorrective(0.5, 120), 'Add 120 words')
    assert.include(condenseCorrective(0.2, 300), 'exceeds its layout by 20%')
    assert.include(condenseCorrective(0.2, 300), 'Reduce to 300 words')
  })
})

test.group('client copy rules in the writer prompt', () => {
  const rules: [string, RegExp][] = [
    ['no inline citation markers', /Never write chunk ids, bracketed numbers/],
    ['footnote markers come from ids', /superscript footnote markers and a sources list/],
    ['gaps go to reviewer notes', /put every gap in reviewer_notes/],
    ['no gap sentences', /The source does not provide/],
    ['empty fields are dropped', /Drop empty fields/],
    ['short headlines that sell', /Headlines are short and sell/],
    ['no repeated phrases in titles', /three or more words/],
    [
      'numbers go to figures with a qualifier',
      /measured .*estimated .*client_reported .*design_target/,
    ],
    ['one brand spelling', /one spelling of the brand/],
  ]
  for (const [name, pattern] of rules)
    test(name, ({ assert }) => {
      assert.match(SHARED_RULES, pattern)
      assert.match(
        writerSystem({ profile: 'academic', depth: 'standard', design: 'essay' }),
        pattern
      )
    })

  test('slot budgets become length targets', ({ assert }) => {
    const text = writerSystem({
      profile: 'informative',
      depth: 'standard',
      design: 'essay',
      slots: [{ name: 'headline', maxChars: 40 }],
    })
    assert.include(text, 'headline: about 34 characters, at least 24, never more than 40')
    assert.notInclude(
      writerSystem({ profile: 'informative', depth: 'standard', design: 'essay' }),
      'Length per slot'
    )
  })

  test('the retry names copy problems', ({ assert }) => {
    assert.include(
      problemCorrective([{ code: 'repeated_title', field: 'title', detail: 'x' }]),
      'repeated_title'
    )
    assert.include(problemCorrective([]), 'move numbers into figures')
  })
})
