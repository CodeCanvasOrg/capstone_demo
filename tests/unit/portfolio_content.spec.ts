import { test } from '@japa/runner'
import {
  citedChunks,
  coverOverBudget,
  entryFill,
  entryOverBudget,
  entryPageSchema,
  entrySlotBudgets,
  fitCover,
  fitEntry,
  planEntrySchema,
  portfolioPlanSchema,
  printedRows,
  sanitizeEntry,
  validateEntry,
  type EntryPage,
} from '../../shared/canvas/portfolio/content.ts'
import { lineCount } from '../../shared/canvas/portfolio/measure.ts'
import {
  PORTFOLIO_THRESHOLDS,
  isPortfolio,
  portfolioKind,
  portfolioProblems,
  portfolioReport,
} from '../../shared/canvas/portfolio/quality.ts'
import { composePortfolio } from '../../shared/canvas/portfolio/compose.ts'
import { SAMPLE } from '../../shared/canvas/portfolio/sample.ts'
import { ENTRY } from '../../shared/canvas/portfolio/tokens.ts'
import {
  ENTRIES_BY_DEPTH,
  ROWS_BY_DEPTH,
  entryCount,
} from '../../app/services/canvas/portfolio/portfolio_prompts.ts'
import { lengthTargets } from '../../shared/canvas/copy_rules.ts'

const entry = (): EntryPage => structuredClone(SAMPLE.entries[0].page)
const evidence = new Map(
  [...SAMPLE.sources.keys()].map((id) => [
    id,
    'Six staff interviews, 40 records and 4 of 5 participants. 3 sessions.',
  ])
)

test.group('portfolio content: schemas', () => {
  test('a plan names entries with one-line headings and a category, and at most eight', ({
    assert,
  }) => {
    const entryPlan = {
      title: 'A clearer path to support',
      category: 'Service design',
      purpose: 'Show the intake work.',
      questions: ['What changed?', 'How was it measured?'],
    }
    assert.isTrue(planEntrySchema.safeParse(entryPlan).success)
    assert.isFalse(planEntrySchema.safeParse({ ...entryPlan, questions: ['One?'] }).success)
    const plan = { title: 'T', thesis: 'x', audience: 'y', entries: [entryPlan] }
    assert.isTrue(portfolioPlanSchema.safeParse(plan).success)
    assert.isFalse(portfolioPlanSchema.safeParse({ ...plan, entries: [] }).success)
  })

  test('a row’s evidence kind is mapped from the words models use', ({ assert }) => {
    const parsed = entryPageSchema.parse({
      ...entry(),
      claims: [
        { claim: 'a', row: 1, kind: 'target' },
        { claim: 'b', row: 2, kind: 'Reported' },
        { claim: 'c', row: 3 },
      ],
    })
    assert.deepEqual(
      parsed.claims.map((c) => c.kind),
      ['design_target', 'client_reported', 'measured']
    )
  })

  test('the number of entries and rows follow the depth', ({ assert }) => {
    assert.deepEqual(entryCount('standard', 'auto'), ENTRIES_BY_DEPTH.standard)
    assert.deepEqual(entryCount('concise', 3), { min: 3, max: 3 })
    assert.deepEqual(ROWS_BY_DEPTH.detailed, { min: 8, max: 8 })
    assert.isTrue(
      Object.values(ROWS_BY_DEPTH).every((r) => r.min >= ENTRY.minRows && r.max <= ENTRY.maxRows)
    )
  })
})

test.group('portfolio content: budgets and fitting', () => {
  test('the design’s own entry is within every budget', ({ assert }) => {
    assert.deepEqual(entryOverBudget(entry()), [])
    assert.deepEqual(coverOverBudget({ ...SAMPLE.cover }), [])
  })

  test('an over-long intro, row or title is named with its lines and limit', ({ assert }) => {
    const page = entry()
    page.intro = 'A long sentence about a project that goes on and on and on. '.repeat(8)
    page.rows[3].body =
      'Map the journey, simplify intake and test the triage flow, then test it again with the staff.'
    page.title = 'An entry heading that is far too long to stay on a single line of the page'
    const issues = entryOverBudget(page)
    assert.sameMembers(
      issues.map((i) => i.field),
      ['title', 'intro', 'rows[3].body']
    )
    assert.equal(issues.find((i) => i.field === 'rows[3].body')!.max, 1)
  })

  test('a footnote mark takes room: a row that fills its last line with one is over', ({
    assert,
  }) => {
    const page = entry()
    const words =
      'a service team handled requests across email and shared spreadsheets and follow-up'
    const row = { ...page.rows[0], body: words, chunks: ['sample-r01'] }
    const plain = lineCount(words, ENTRY.rowsW, 'rowBody')
    const marked = lineCount(`${words}0`, ENTRY.rowsW, 'rowBody')
    assert.isAtLeast(marked, plain)
    assert.isArray(entryOverBudget({ ...page, rows: [row, ...page.rows.slice(1)] }))
  })

  test('fitting cuts over-long text at a sentence, drops empty rows and says what it did', ({
    assert,
  }) => {
    const page = entry()
    page.rows[0].body =
      'Short first sentence. A second sentence that adds a great deal more detail than the lines of this row can ever hold at this size, and then it carries on and on with still more detail about the work, the people and the places involved in it, well past any budget.'
    page.rows[1].body = ''
    page.intro = 'Fine intro.'
    const fitted = fitEntry(page)
    assert.deepEqual(entryOverBudget(fitted.page), [])
    assert.lengthOf(fitted.page.rows, 7)
    assert.isTrue(fitted.page.rows[0].body.startsWith('Short first sentence.'))
    assert.match(fitted.notes.join(' '), /Row 1 was shortened to fit its space/)
    // Claims that pointed at a dropped or uncited row are removed with it.
    assert.isTrue(fitted.page.claims.every((c) => fitted.page.rows[c.row - 1]?.chunks.length))
  })

  test('the cover is fitted too', ({ assert }) => {
    const out = fitCover({
      eyebrow: 'Selected project portfolio that is far too long for one line of the cover',
      title: 'Designing the next chapter of public services',
      subtitle: 'Research, prototypes and practical outcomes. '.repeat(10),
    })
    assert.deepEqual(coverOverBudget(out.cover), [])
    assert.isAbove(out.notes.length, 0)
  })

  test('fill is lines used over lines budgeted', ({ assert }) => {
    assert.approximately(entryFill(entry()), 1, 0.2)
    assert.equal(entryFill({ rows: [] }), 0)
    const thin = entry()
    thin.rows = thin.rows.slice(0, 3).map((r) => ({ ...r, body: 'Short.' }))
    assert.isBelow(entryFill(thin), 0.5)
  })

  test('the prompt’s slot budgets come from the template’s lines and widths', ({ assert }) => {
    const targets = lengthTargets(entrySlotBudgets(8))
    const names = targets.map((t) => t.name)
    assert.include(names, 'intro')
    assert.include(names, 'rows[3].body (constraint included)')
    const intro = targets.find((t) => t.name === 'intro')!
    const oneLine = targets.find((t) => t.name === 'rows[3].body (constraint included)')!
    const threeLines = targets.find((t) => t.name === 'rows[2].body (constraint included)')!
    assert.isAbove(intro.maxChars, 200)
    assert.isBelow(oneLine.maxChars, threeLines.maxChars)
    assert.approximately(threeLines.maxChars / oneLine.maxChars, 3, 0.2)
  })
})

test.group('portfolio content: citations and validation', () => {
  test('cited chunks are listed in reading order without repeats', ({ assert }) => {
    assert.deepEqual(citedChunks(entry()), [
      'sample-r01',
      'sample-r06',
      'sample-p01',
      'sample-p08',
      'sample-t01',
      'sample-t05',
      'sample-a01',
      'sample-a04',
    ])
  })

  test('chunk ids the application never supplied are dropped, never turned into citations', ({
    assert,
  }) => {
    const { page, dropped } = sanitizeEntry(entry(), new Set(['sample-r01']))
    assert.isTrue(dropped)
    assert.deepEqual(citedChunks(page), ['sample-r01'])
    assert.deepEqual(
      page.sourceNotes.map((n) => n.chunk),
      ['sample-r01']
    )
  })

  test('rows with facts need a source, and numbers must be in the cited chunks', ({ assert }) => {
    const page = entry()
    page.rows[0].chunks = []
    page.rows[1].body = 'Seven interviews and 41 records were reviewed.'
    const found = validateEntry(page, evidence)
    assert.deepInclude(found, { code: 'uncited', field: 'rows[0]' })
    assert.isTrue(found.some((p) => p.code === 'unsupported_number' && p.field === 'rows[1]'))
    assert.deepEqual(validateEntry(page, new Map()), [])
    assert.deepInclude(validateEntry({ ...page, rows: page.rows.slice(0, 2) }, new Map()), {
      code: 'too_few_rows',
      field: 'rows',
      detail: 'need at least 3',
    })
  })

  test('a row with only a constraint still prints; an empty one does not', ({ assert }) => {
    const rows = printedRows([
      { label: 'A', body: '', constraint: 'Limit.', chunks: [] },
      { label: 'B', body: '  ', chunks: [] },
      { label: '', body: 'No label', chunks: [] },
    ])
    assert.lengthOf(rows, 1)
  })
})

test.group('portfolio quality', () => {
  test('sheets are recognised by the slots they carry, and entries are measured by their rows', ({
    assert,
  }) => {
    const canvas = composePortfolio(SAMPLE)
    assert.isTrue(isPortfolio(canvas))
    assert.deepEqual(canvas.sheets.map(portfolioKind), ['cover', 'entry', 'sources'])
    const report = portfolioReport(canvas)
    assert.deepEqual(
      report.pages.map((p) => p.portfolio),
      ['cover', 'entry', 'sources']
    )
    const entryPage = report.pages[1]
    assert.equal(entryPage.rows, 8)
    assert.equal(entryPage.citations, 6)
    assert.isAbove(entryPage.fill!, 0.7)
    assert.deepEqual(portfolioProblems(entryPage), [])
    assert.deepEqual(portfolioProblems(report.pages[0]), [])
  })

  test('an entry with few rows, thin text or no sources is reported', ({ assert }) => {
    const thin = entry()
    thin.rows = thin.rows.slice(0, 2).map((r) => ({ ...r, body: 'Short.', chunks: [] }))
    const canvas = composePortfolio({ ...SAMPLE, entries: [{ page: thin }] })
    const [, page] = portfolioReport(canvas).pages
    const codes = portfolioProblems(page, PORTFOLIO_THRESHOLDS).map((p) => p.code)
    assert.sameMembers(codes, ['rows', 'fill', 'citations'])
  })
})
