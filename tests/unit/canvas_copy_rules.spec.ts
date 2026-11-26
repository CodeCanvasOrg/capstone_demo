import { test } from '@japa/runner'
import {
  brandVariants,
  chunkOverlap,
  dedupeChunks,
  dropEmpty,
  enforceBrandName,
  evidenceKind,
  footnoteMarker,
  footnotesFor,
  lengthRules,
  lengthTargets,
  numbersInProse,
  overBudget,
  slotChars,
  stripGapSentences,
  stripInlineCitations,
  titleRepeats,
  unmovedNumbers,
} from '../../shared/canvas/copy_rules.ts'
import { cleanCopy, copyProblems } from '#services/canvas/generation/copy_clean'
import type { AcademicPage } from '../../shared/canvas/academic/content.ts'

const page = (over: Partial<AcademicPage> = {}): AcademicPage => ({
  design: 'essay',
  title: 'Cooler streets',
  lead: { text: 'Trees cool streets.', chunks: ['a'] },
  sections: [],
  definitions: [],
  figures: [],
  callout: null,
  takeaway: null,
  summary: 's',
  reviewer_notes: [],
  ...over,
})

test.group('slot length targets', () => {
  test('lines times characters per line caps a slot', ({ assert }) => {
    assert.equal(slotChars({ name: 'h', maxChars: 100, maxLines: 2, charsPerLine: 20 }), 40)
    assert.equal(slotChars({ name: 'h', maxChars: 30 }), 30)
    assert.equal(slotChars({ name: 'h' }), 0)
  })

  test('targets sit inside the budget and slots without one are skipped', ({ assert }) => {
    const t = lengthTargets([{ name: 'headline', maxChars: 60 }, { name: 'free' }])
    assert.lengthOf(t, 1)
    assert.deepInclude(t[0], { name: 'headline', minChars: 36, targetChars: 51, maxChars: 60 })
    assert.include(lengthRules(t), 'headline: about 51 characters, at least 36, never more than 60')
  })

  test('overBudget names slots that run past their cap', ({ assert }) => {
    const t = lengthTargets([{ name: 'headline', maxChars: 10 }])
    assert.deepEqual(overBudget({ headline: 'x'.repeat(11) }, t), [
      { slot: 'headline', chars: 11, max: 10 },
    ])
    assert.deepEqual(overBudget({ headline: 'short' }, t), [])
  })
})

test.group('inline citations and footnotes', () => {
  const cases: [string, string][] = [
    ['Trees cool streets [chunk: abc123].', 'Trees cool streets.'],
    ['Trees cool streets (source: abc-1, abc-2).', 'Trees cool streets.'],
    ['Trees cool streets [3].', 'Trees cool streets.'],
    ['Trees cool streets [1, 2].', 'Trees cool streets.'],
    ['Trees cool streets¹².', 'Trees cool streets.'],
    ['See [3f2a9c10-1111-4222-8333-444455556666].', 'See.'],
  ]
  for (const [input, expected] of cases)
    test(`strips ${JSON.stringify(input)}`, ({ assert }) => {
      assert.equal(stripInlineCitations(input), expected)
    })

  test('plain brackets that are not citations stay', ({ assert }) => {
    assert.equal(stripInlineCitations('Use the [Pro] plan.'), 'Use the [Pro] plan.')
  })

  test('footnotes number chunks by first use and give a sources list', ({ assert }) => {
    const f = footnotesFor(['b', 'a', 'b'], (id) => `File ${id}`)
    assert.equal(f.numbers.get('b'), 1)
    assert.equal(f.numbers.get('a'), 2)
    assert.deepEqual(f.sources, [
      { n: 1, chunkId: 'b', title: 'File b' },
      { n: 2, chunkId: 'a', title: 'File a' },
    ])
    assert.equal(footnoteMarker(12), '¹²')
  })
})

test.group('gap sentences', () => {
  const gaps = [
    'The source does not provide pricing.',
    'The sources do not mention a launch date.',
    'No information is available on the team size.',
    'Pricing is not specified in the document.',
    'Information about warranty is not available.',
  ]
  for (const gap of gaps)
    test(`removes "${gap}"`, ({ assert }) => {
      const out = stripGapSentences(`Solar cuts bills. ${gap} It pays back fast.`)
      assert.equal(out.text, 'Solar cuts bills. It pays back fast.')
      assert.lengthOf(out.gaps, 1)
    })

  test('an insert-text placeholder is a gap', ({ assert }) => {
    const out = stripGapSentences('Solar cuts bills. [insert text here].')
    assert.equal(out.text, 'Solar cuts bills.')
  })

  test('ordinary sentences are kept', ({ assert }) => {
    const out = stripGapSentences('The document design is bold. Sources of heat vary.')
    assert.equal(out.text, 'The document design is bold. Sources of heat vary.')
    assert.deepEqual(out.gaps, [])
  })
})

test.group('empty fields and brand name', () => {
  test('dropEmpty removes nulls, blanks, n/a and empty containers', ({ assert }) => {
    assert.deepEqual(
      dropEmpty({
        a: 'x',
        b: '',
        c: null,
        d: 'N/A',
        e: [],
        f: { g: ' ' },
        h: [{ i: 'TBD' }, 'ok'],
      }),
      { a: 'x', h: ['ok'] }
    )
  })

  test('brand spellings collapse to one name', ({ assert }) => {
    assert.equal(
      enforceBrandName('Code Canvas and codecanvas and CODE-CANVAS ship.', 'CodeCanvas'),
      'CodeCanvas and CodeCanvas and CodeCanvas ship.'
    )
    assert.deepEqual(brandVariants('Code Canvas, CodeCanvas', 'CodeCanvas'), ['Code Canvas'])
    assert.deepEqual(brandVariants('CodeCanvas only', 'CodeCanvas'), [])
  })
})

test.group('repeated titles', () => {
  test('identical and three-word overlaps are repeats', ({ assert }) => {
    const r = titleRepeats([
      'Cut energy bills fast',
      'Why it works',
      'cut energy bills fast!',
      'How we cut energy bills',
    ])
    assert.deepEqual(
      r.map((x) => [x.a, x.b]),
      [
        [0, 2],
        [0, 3],
        [2, 3],
      ]
    )
  })

  test('distinct titles pass; short titles only repeat when identical', ({ assert }) => {
    assert.deepEqual(titleRepeats(['Cooler streets', 'Lower bills', 'Lower costs']), [])
    assert.lengthOf(titleRepeats(['Results', 'results']), 1)
  })
})

test.group('stats and evidence kinds', () => {
  test('kind words map to the stored qualifiers', ({ assert }) => {
    assert.equal(evidenceKind('estimate'), 'estimated')
    assert.equal(evidenceKind('Design target'), 'design_target')
    assert.equal(evidenceKind('measured'), 'measured')
    assert.equal(evidenceKind('nonsense'), 'measured')
  })

  test('numbers left in prose are found unless a stat holds them', ({ assert }) => {
    const text = 'Energy use fell 38% in 2 years. Cost dropped to $1,200 per unit.'
    assert.includeMembers(
      numbersInProse(text).map((n) => n.value),
      ['38%', '$1,200']
    )
    assert.deepEqual(unmovedNumbers(text, [{ value: '38%' }]), ['$1,200'])
    assert.deepEqual(unmovedNumbers('Founded in 2019.', []), [])
  })
})

test.group('chunk dedupe', () => {
  const text =
    'the roof absorbs heat all day and releases it slowly at night which warms nearby streets'
  test('a chunk used earlier or repeated is dropped and ids are kept', ({ assert }) => {
    const out = dedupeChunks(
      [
        { id: '1', content: text },
        { id: '2', content: `${text} again` },
        {
          id: '3',
          content: 'permeable paving lets rain soak into the ground instead of running off',
        },
        {
          id: '4',
          content: 'wind corridors move cool air through dense districts in summer evenings',
        },
      ],
      new Set(['4'])
    )
    assert.deepEqual(
      out.map((c) => c.id),
      ['1', '3']
    )
  })

  test('overlap is 1 for containment and 0 for unrelated text', ({ assert }) => {
    assert.equal(chunkOverlap(text, `intro ${text} outro`), 1)
    assert.equal(
      chunkOverlap(text, 'completely different words about something else entirely here'),
      0
    )
  })
})

test.group('copy cleaning of a page', () => {
  test('citations and gap sentences leave the text and go to notes', ({ assert }) => {
    const { page: out, gaps } = cleanCopy(
      page({
        lead: {
          text: 'Trees cool streets [chunk: a]. The source does not provide costs.',
          chunks: ['a'],
        },
        sections: [
          {
            heading: 'Why Code Canvas',
            paragraphs: [
              { text: 'No information is available on cost.', chunks: [] },
              { text: 'Shade lowers air temperature.', chunks: ['a'] },
            ],
            bullets: ['', 'Cheap to plant'],
          },
        ],
      }),
      'CodeCanvas'
    )
    assert.equal(out.lead?.text, 'Trees cool streets.')
    assert.equal(out.sections[0].heading, 'Why CodeCanvas')
    assert.lengthOf(out.sections[0].paragraphs, 1)
    assert.deepEqual(out.sections[0].bullets, ['Cheap to plant'])
    assert.lengthOf(gaps, 2)
  })

  test('a page whose only text was a gap loses the field', ({ assert }) => {
    const { page: out } = cleanCopy(
      page({
        lead: { text: 'The source does not provide this.', chunks: [] },
        takeaway: 'No data is available.',
      })
    )
    assert.isNull(out.lead)
    assert.isNull(out.takeaway)
  })

  test('repeated titles and numbers left in prose are problems', ({ assert }) => {
    const problems = copyProblems(
      page({
        title: 'Cut energy bills fast',
        lead: { text: 'Bills fell 38% and use fell 12% overall.', chunks: ['a'] },
        sections: [{ heading: 'How to cut energy bills', paragraphs: [], bullets: [] }],
      }),
      'data_findings'
    )
    assert.deepEqual(problems.map((p) => p.code).sort(), ['numbers_in_prose', 'repeated_title'])
  })
})
