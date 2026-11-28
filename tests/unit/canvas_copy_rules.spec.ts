import { test } from '@japa/runner'
import {
  chunkOverlap,
  dedupeChunks,
  enforceBrandName,
  evidenceKind,
  lengthRules,
  lengthTargets,
  overBudget,
  sentences,
  slotChars,
  stripGapSentences,
  stripInlineCitations,
} from '../../shared/canvas/copy_rules.ts'

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

test.group('inline citations', () => {
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

test.group('brand name', () => {
  test('brand spellings collapse to one name', ({ assert }) => {
    assert.equal(
      enforceBrandName('Code Canvas and codecanvas and CODE-CANVAS ship.', 'CodeCanvas'),
      'CodeCanvas and CodeCanvas and CodeCanvas ship.'
    )
  })
})

test.group('stats and evidence kinds', () => {
  test('kind words map to the stored qualifiers', ({ assert }) => {
    assert.equal(evidenceKind('estimate'), 'estimated')
    assert.equal(evidenceKind('Design target'), 'design_target')
    assert.equal(evidenceKind('measured'), 'measured')
    assert.equal(evidenceKind('nonsense'), 'measured')
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

test.group('sentences and decimals', () => {
  test('a decimal point does not end a sentence, so no figure is cut in half', ({ assert }) => {
    assert.deepEqual(sentences('It rose 2.4x in 3.5 years. Then it held.'), [
      'It rose 2.4x in 3.5 years.',
      'Then it held.',
    ])
    assert.equal(
      stripGapSentences('Planners compared 12 districts against a reduction of 2.4x each summer.')
        .text,
      'Planners compared 12 districts against a reduction of 2.4x each summer.'
    )
  })
})
