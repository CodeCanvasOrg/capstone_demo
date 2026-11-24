import { test } from '@japa/runner'
import { FIGURE_PLACEHOLDER, PLACEHOLDER } from '../../shared/brochure/content.ts'
import {
  academicPageSchema,
  bodyWords,
  canvasOptionsSchema,
  checkWordRange,
  clipWords,
  citedChunks,
  documentFromAcademicPages,
  figureSupported,
  modelSchema,
  parseLenient,
  planSchema,
  rangedWords,
  sanitizePage,
  validateAcademicPage,
} from '../../shared/canvas/academic/content.ts'
import {
  ACADEMIC_DESIGN_IDS,
  ACADEMIC_DESIGNS,
  PLANNABLE_DESIGN_IDS,
  designSlots,
  pageCapacity,
  wordRange,
} from '../../shared/canvas/academic/designs.ts'
import { walkNodes } from '../../shared/canvas/model.ts'
import { prose, samplePage } from '../fixtures/canvas/academic.ts'

const evidence = new Map([
  [
    'chunk-1',
    'Surface temperatures fell by 83% in the pilot districts. A further 12 sites were studied.',
  ],
  ['chunk-2', 'Planners review the results every summer.'],
])
const plan = {
  thesis: 'Combined heat programmes outperform single measures.',
  audience: 'Municipal planners',
  pages: [
    {
      design: 'essay',
      title: 'Why cities overheat',
      purpose: 'Establish the mechanism of urban heat.',
      questions: ['What causes urban heat islands?', 'Which surfaces store heat?'],
      keyTerms: ['albedo'],
      wantsImage: false,
    },
  ],
  coverageGaps: [],
}

test.group('canvas plan schema', () => {
  test('a valid plan parses and defaults are filled', ({ assert }) => {
    const parsed = planSchema.parse({
      ...plan,
      pages: [{ ...plan.pages[0], keyTerms: undefined, wantsImage: undefined }],
      coverageGaps: undefined,
    })
    assert.deepEqual(parsed.pages[0].keyTerms, [])
    assert.isFalse(parsed.pages[0].wantsImage)
    assert.deepEqual(parsed.coverageGaps, [])
  })

  test('pages need two to five questions and a plannable design', ({ assert }) => {
    const bad = (page: object) =>
      planSchema.safeParse({ ...plan, pages: [{ ...plan.pages[0], ...page }] })
    assert.isFalse(bad({ questions: ['Only one?'] }).success)
    assert.isFalse(
      bad({ questions: Array.from({ length: 6 }, (_, i) => `Question ${i}?`) }).success
    )
    // The title page, contents and references are the application's, never the model's.
    for (const design of ['title_page', 'contents', 'references'])
      assert.isFalse(bad({ design }).success, design)
    assert.isFalse(bad({ design: 'invented' }).success)
    assert.isFalse(planSchema.safeParse({ ...plan, pages: [] }).success)
  })

  test('options default to a standard academic report', ({ assert }) => {
    assert.deepEqual(canvasOptionsSchema.parse({}), {
      profile: 'academic',
      depth: 'standard',
      templateSet: 'academic_report',
      pages: 'auto',
      images: true,
    })
    assert.isFalse(canvasOptionsSchema.safeParse({ pages: 2 }).success)
    assert.isFalse(canvasOptionsSchema.safeParse({ pages: 17 }).success)
    assert.isTrue(canvasOptionsSchema.safeParse({ pages: 16 }).success)
  })
})

test.group('canvas page schema and sanitising', () => {
  test('every sample page satisfies the page schema', ({ assert }) => {
    for (const design of ACADEMIC_DESIGN_IDS) {
      const parsed = academicPageSchema.safeParse(samplePage(design))
      assert.isTrue(
        parsed.success,
        `${design} ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 2))}`
      )
    }
  })

  test('null, missing and empty optional fields mean the same', ({ assert }) => {
    const page = academicPageSchema.parse({
      design: 'essay',
      title: 'T',
      lead: null,
      callout: null,
      takeaway: null,
      summary: 'S',
    })
    assert.deepEqual(page.sections, [])
    assert.deepEqual(page.definitions, [])
    assert.isNull(page.lead)
  })

  test('unknown chunk ids are stripped everywhere, known ones kept', ({ assert }) => {
    const page = samplePage('essay', { chunks: ['chunk-1', 'made-up'] })
    page.callout!.chunks = ['made-up']
    const { page: clean, dropped } = sanitizePage(page, new Set(['chunk-1']))
    assert.isTrue(dropped)
    assert.deepEqual(citedChunks(clean), ['chunk-1'])
    assert.deepEqual(clean.callout!.chunks, [])
    // The original is not changed.
    assert.include(citedChunks(page), 'made-up')
    assert.isFalse(sanitizePage(clean, new Set(['chunk-1'])).dropped)
  })

  test('the flat document keeps every paragraph and drops invented citations', ({ assert }) => {
    const page = samplePage('essay', { chunks: ['chunk-1', 'made-up'] })
    const { document, dropped } = documentFromAcademicPages([page], {
      allowedChunkIds: new Set(['chunk-1']),
    })
    assert.isTrue(dropped)
    const ids: string[] = []
    walkNodes(document.content, (node: any) => {
      if (node.type === 'sourceCitation') ids.push(node.attrs.sourceChunkId)
    })
    assert.isAbove(ids.length, 0)
    assert.notInclude(ids, 'made-up')
    assert.equal((document.content[0].attrs as { level: number }).level, 1)
    const two = documentFromAcademicPages([page, page]).document.content
    assert.equal(two.filter((b) => b.type === 'horizontalRule').length, 1)
  })
})

test.group('canvas page validation', () => {
  test('a cited page with supported figures passes', ({ assert }) => {
    const page = samplePage('data_findings')
    page.figures = [
      {
        value: '83%',
        label: 'drop in surface temperature',
        qualifier: 'measured',
        chunks: ['chunk-1'],
      },
      { value: '12', label: 'sites studied', qualifier: 'measured', chunks: ['chunk-1'] },
    ]
    assert.deepEqual(validateAcademicPage(page, { design: 'data_findings', evidence }), [])
  })

  test('uncited paragraphs are rejected when there are sources, and allowed without', ({
    assert,
  }) => {
    const page = samplePage('essay', { uncited: true })
    const codes = validateAcademicPage(page, { design: 'essay', evidence }).map((p) => p.code)
    assert.include(codes, 'uncited')
    assert.deepEqual(validateAcademicPage(page, { design: 'essay', evidence: new Map() }), [])
    // A placeholder is an honest gap, not an uncited claim.
    page.sections.forEach((s) => s.paragraphs.forEach((p) => (p.text = PLACEHOLDER)))
    page.definitions.forEach((d) => (d.definition = PLACEHOLDER))
    assert.notInclude(
      validateAcademicPage(page, { design: 'essay', evidence }).map((p) => p.code),
      'uncited'
    )
  })

  test('an invented figure is rejected, a placeholder is not', ({ assert }) => {
    const page = samplePage('data_findings')
    page.figures = [
      { value: '97%', label: 'invented', qualifier: 'measured', chunks: ['chunk-1'] },
      { value: FIGURE_PLACEHOLDER, label: 'gap', qualifier: 'measured', chunks: [] },
    ]
    const problems = validateAcademicPage(page, { design: 'data_findings', evidence })
    assert.deepEqual(
      problems.filter((p) => p.code === 'invented_figure').map((p) => p.field),
      ['figures[0]']
    )
  })

  test('figures are matched by number, not by substring', ({ assert }) => {
    assert.isTrue(figureSupported('83%', ['fell by 83% overall']))
    assert.isTrue(figureSupported('1,200', ['about 1200 homes']))
    assert.isFalse(figureSupported('8', ['fell by 83%']))
    assert.isFalse(figureSupported('83%', []))
    assert.isTrue(figureSupported('twelve', ['Twelve sites']))
    assert.isTrue(figureSupported(FIGURE_PLACEHOLDER, []))
  })

  test('structure is checked against the design', ({ assert }) => {
    const codes = (
      design: Parameters<typeof samplePage>[0],
      edit: (p: ReturnType<typeof samplePage>) => void
    ) => {
      const page = samplePage(design)
      edit(page)
      return validateAcademicPage(page, { design, evidence: new Map() }).map(
        (p) => `${p.code}:${p.field}`
      )
    }
    assert.include(
      codes('data_findings', (p) => (p.figures = p.figures.slice(0, 1))),
      'missing:figures'
    )
    assert.include(
      codes('key_concepts', (p) => (p.definitions = p.definitions.slice(0, 2))),
      'missing:definitions'
    )
    assert.include(
      codes('essay', (p) => (p.sections = [])),
      'missing:sections'
    )
    assert.include(
      codes('essay', (p) => (p.figures = samplePage('data_findings').figures)),
      'extra:figures'
    )
    assert.include(
      codes('essay', (p) => (p.lead = null)),
      'missing:lead'
    )
    assert.include(
      codes('essay', (p) => (p.design = 'two_column')),
      'wrong_design:design'
    )
  })

  test('the word range check applies per depth', ({ assert }) => {
    const concise = wordRange('essay', 'concise')
    const standard = wordRange('essay', 'standard')
    const detailed = wordRange('essay', 'detailed')
    assert.isBelow(concise.max, standard.max + 1)
    assert.isAtMost(standard.max, detailed.max)
    // A page sized for the middle of standard is too long for concise and too short for detailed.
    const page = samplePage('essay')
    page.sections = [
      {
        heading: 'One',
        paragraphs: [
          { text: prose(Math.round((standard.min + standard.max) / 2) - 1), chunks: [] },
        ],
        bullets: [],
      },
    ]
    assert.equal(rangedWords('essay', page), bodyWords(page))
    assert.deepEqual(checkWordRange('essay', page, 'standard'), [])
    assert.equal(checkWordRange('essay', page, 'concise')[0]?.code, 'too_long')
    assert.equal(checkWordRange('essay', page, 'detailed')[0]?.code, 'too_short')
    // Pages the application writes have no range.
    assert.deepEqual(checkWordRange('references', page, 'standard'), [])
  })
})

test.group('academic designs table', () => {
  test('every plannable design has a range, a capacity and slots; fixed ones do not flow text', ({
    assert,
  }) => {
    for (const id of PLANNABLE_DESIGN_IDS) {
      const range = wordRange(id, 'standard')
      assert.isAbove(range.min, 0, id)
      assert.isAtLeast(range.max, range.min, id)
      assert.isAtMost(range.max, pageCapacity(id), id)
      assert.deepEqual(Object.keys(designSlots(id).words), ['concise', 'standard', 'detailed'])
    }
    assert.equal(pageCapacity('contents'), 0)
    assert.equal(pageCapacity('references'), 0)
  })

  test('depth only widens the room used, never beyond the measured capacity', ({ assert }) => {
    for (const id of PLANNABLE_DESIGN_IDS) {
      const [c, s, d] = (['concise', 'standard', 'detailed'] as const).map((x) => wordRange(id, x))
      assert.isAtMost(c.max, s.max, id)
      assert.isAtMost(s.max, d.max, id)
      assert.isAtMost(d.max, d.capacity, id)
    }
  })

  test('figure, side-figure and case designs declare their image slot', ({ assert }) => {
    assert.equal(ACADEMIC_DESIGNS.figure_text.images[0].aspect, 'landscape')
    assert.equal(ACADEMIC_DESIGNS.side_figure.images[0].aspect, 'portrait')
    assert.isTrue(ACADEMIC_DESIGNS.case_box.images[0].optional)
    assert.isFalse(ACADEMIC_DESIGNS.figure_text.images[0].optional)
    assert.lengthOf(ACADEMIC_DESIGNS.essay.images, 0)
  })
})

test.group('lenient parsing of model output', () => {
  test('a paragraph written as a bare string is a paragraph with no citation', ({ assert }) => {
    const page = {
      ...samplePage('essay'),
      lead: 'A lead written as a plain string.',
      sections: [{ heading: 'H', paragraphs: ['A bare paragraph.'], bullets: [] }],
    }
    const parsed = academicPageSchema.safeParse(page)
    assert.isTrue(parsed.success)
    if (!parsed.success) return
    assert.deepEqual(parsed.data.lead, { text: 'A lead written as a plain string.', chunks: [] })
    assert.deepEqual(parsed.data.sections[0].paragraphs[0], {
      text: 'A bare paragraph.',
      chunks: [],
    })
  })

  test('the schema shown to a model keeps its shape and leaves the length limits to the cut', ({
    assert,
  }) => {
    const shown = JSON.stringify(modelSchema(planSchema))
    assert.notInclude(shown, 'maxLength')
    assert.notInclude(shown, 'maxItems')
    assert.include(shown, 'thesis')
    const page = JSON.stringify(modelSchema(academicPageSchema))
    // A paragraph is shown as an object, though a bare string is accepted.
    assert.include(page, '"chunks"')
    assert.include(page, '"sections"')
  })

  test('a string only a little too long is cut at a word, not refused', ({ assert }) => {
    const long = `${'Combined programmes outperform single measures. '.repeat(12)}end`
    const parsed = parseLenient(planSchema, { ...plan, thesis: long })
    assert.isTrue(parsed.success)
    if (!parsed.success) return
    assert.isAtMost(parsed.data.thesis.length, 400)
    // Cut between words: what was kept is the start of the original, and a space follows it.
    assert.isTrue(long.startsWith(parsed.data.thesis))
    assert.match(long.slice(parsed.data.thesis.length), /^[\s,;:]/)
    // The original is not changed.
    assert.isAbove(long.length, 400)
  })

  test('lists are cut to their limit, wherever they are', ({ assert }) => {
    const pages = Array.from({ length: 17 }, () => ({
      ...plan.pages[0],
      questions: Array.from({ length: 9 }, (_, i) => `Question ${i}?`),
    }))
    const parsed = parseLenient(planSchema, { ...plan, pages })
    assert.isTrue(parsed.success)
    if (!parsed.success) return
    assert.lengthOf(parsed.data.pages, 14)
    assert.lengthOf(parsed.data.pages[0].questions, 5)
  })

  test('a value cut to a short limit still passes the page schema', ({ assert }) => {
    const page = {
      ...samplePage('data_findings'),
      figures: [
        { value: 'about eighty-three percent', label: 'x', qualifier: 'measured', chunks: [] },
        { value: '12', label: 'y', qualifier: 'measured', chunks: [] },
      ],
    }
    const parsed = parseLenient(academicPageSchema, page)
    assert.isTrue(parsed.success)
    if (parsed.success) assert.isAtMost(parsed.data.figures[0].value.length, 12)
  })

  test('anything else wrong is still an error, with its path', ({ assert }) => {
    const parsed = parseLenient(planSchema, {
      ...plan,
      pages: [{ ...plan.pages[0], design: 'invented' }],
    })
    assert.isFalse(parsed.success)
    if (!parsed.success) assert.deepEqual(parsed.error.issues[0].path, ['pages', 0, 'design'])
    // Too long and wrong together is not repaired: the model is asked again.
    const mixed = parseLenient(planSchema, { ...plan, thesis: 'x'.repeat(500), audience: '' })
    assert.isFalse(mixed.success)
  })

  test('clipping prefers a word boundary and trims trailing punctuation', ({ assert }) => {
    assert.equal(clipWords('one two three, four', 14), 'one two three')
    assert.equal(clipWords('short', 14), 'short')
    assert.equal(clipWords('supercalifragilistic', 8), 'supercal')
  })
})
