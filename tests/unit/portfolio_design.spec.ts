import { test } from '@japa/runner'
import {
  buildManifest,
  collectionBudget,
  composeContents,
  effectiveDesign,
  manifestHash,
  type CollectionEntry,
} from '../../shared/layout/collection.ts'
import {
  entryHighlights,
  parseDesign,
  planPages,
  reconcileDesign,
  rulesDesign,
  validateDesign,
  type PortfolioDesign,
} from '../../shared/layout/portfolio.ts'

const entry = (id: string, pages = 2, extra: Partial<CollectionEntry> = {}): CollectionEntry => ({
  entryId: id,
  revisionId: `${id}-r1`,
  title: `Entry ${id}`,
  category: 'Logistics',
  templateId: 'case_study_standard',
  templateVersion: 1,
  pages,
  evidenceKeys: [],
  ...extra,
})
const brand = { id: 'humblebee', version: 1 }
const kinds = (design: PortfolioDesign) => design.pages.map((page) => page.kind)

test.group('Portfolio rules (presets)', () => {
  test('brochure opens with a ribbon cover and only shows pages that have something to show', ({
    assert,
  }) => {
    const list = [entry('a'), entry('b')]
    assert.deepEqual(kinds(rulesDesign(list, {}, 'brochure')), [
      'cover',
      'contents',
      'entry',
      'entry',
      'contact',
    ])
    const withAbout = rulesDesign(list, { about: 'We build document AI.' }, 'brochure')
    assert.deepEqual(kinds(withAbout).slice(0, 3), ['cover', 'statement', 'contents'])
    assert.equal(withAbout.pages[0].kind === 'cover' && withAbout.pages[0].variant, 'ribbons')
  })

  test('brochure adds a highlights page only with two or more real figures', ({ assert }) => {
    const stat = (value: string, label: string) => ({
      value,
      label,
      qualifier: 'measured' as const,
    })
    const one = [entry('a', 2, { stats: [stat('40%', 'faster')] }), entry('b')]
    assert.notInclude(kinds(rulesDesign(one, {}, 'brochure')), 'highlights')
    const two = [
      entry('a', 2, { stats: [stat('40%', 'faster')] }),
      entry('b', 2, { stats: [stat('3x', 'throughput')] }),
    ]
    const design = rulesDesign(two, {}, 'brochure')
    const page = design.pages.find((p) => p.kind === 'highlights')
    assert.isDefined(page)
    assert.equal(page!.kind === 'highlights' && page!.items.length, 2)
  })

  test('highlights never repeat a figure and stop at three', ({ assert }) => {
    const s = (value: string) => ({ value, label: 'x' })
    const list = [
      entry('a', 2, { stats: [s('1%')] }),
      entry('b', 2, { stats: [s('1%')] }),
      entry('c', 2, { stats: [s('2%')] }),
      entry('d', 2, { stats: [s('3%')] }),
      entry('e', 2, { stats: [s('4%')] }),
    ]
    assert.deepEqual(
      entryHighlights(list).map((item) => item.value),
      ['1%', '2%', '3%']
    )
  })

  test('brochure opens each category with a section page when there are two or more', ({
    assert,
  }) => {
    const list = [
      entry('a', 2, { category: 'Logistics' }),
      entry('b', 2, { category: 'Finance' }),
      entry('c', 2, { category: 'Logistics' }),
    ]
    const design = rulesDesign(list, {}, 'brochure')
    assert.deepEqual(
      design.pages.filter((p) => p.kind === 'section').map((p) => p.kind === 'section' && p.title),
      ['Logistics', 'Finance']
    )
    // Entries follow their category, so contents numbers match what is printed.
    assert.deepEqual(
      design.pages.filter((p) => p.kind === 'entry').map((p) => p.kind === 'entry' && p.entryId),
      ['a', 'c', 'b']
    )
    const single = rulesDesign([entry('a'), entry('b')], {}, 'brochure')
    assert.notInclude(kinds(single), 'section')
  })

  test('compact keeps the given order and has no contents page', ({ assert }) => {
    const list = [
      entry('a', 1, { category: 'One' }),
      entry('b', 1, { category: 'Two' }),
      entry('c', 1, { category: 'One' }),
    ]
    const design = rulesDesign(list, { about: 'About' }, 'compact')
    assert.deepEqual(kinds(design), ['cover', 'entry', 'entry', 'entry', 'contact'])
    assert.deepEqual(
      design.pages.filter((p) => p.kind === 'entry').map((p) => p.kind === 'entry' && p.entryId),
      ['a', 'b', 'c']
    )
  })

  test('the same inputs always give the same design', ({ assert }) => {
    const list = [entry('a'), entry('b', 1, { category: 'Finance' })]
    assert.deepEqual(rulesDesign(list, { about: 'x' }), rulesDesign(list, { about: 'x' }))
  })
})

test.group('Portfolio pages and numbering', () => {
  test('a manifest with no design is the classic arrangement, numbered as before', ({ assert }) => {
    const list = [entry('a', 2), entry('b', 1)]
    const manifest = buildManifest({ entries: list, wrapper: { about: 'x' }, brand })
    assert.isUndefined(manifest.design)
    assert.deepEqual(kinds(effectiveDesign(manifest, list)), [
      'cover',
      'statement',
      'contents',
      'entry',
      'entry',
      'contact',
    ])
    const plan = planPages(effectiveDesign(manifest, list), list)
    assert.equal(plan.wrapperPages, 4)
    assert.equal(plan.rows[0].page, 4)
  })

  test('section pages and key numbers move entry page numbers', ({ assert }) => {
    const list = [entry('a', 2, { category: 'Logistics' }), entry('b', 1, { category: 'Finance' })]
    const design = rulesDesign(list, {}, 'brochure')
    const plan = planPages(design, list)
    // cover 1, contents 2, section 3, a 4-5, section 6, b 7, contact 8
    assert.deepEqual(
      plan.rows.map((row) => [row.entryId, row.page]),
      [
        ['a', 4],
        ['b', 7],
      ]
    )
    assert.equal(plan.total, 8)
    assert.equal(plan.wrapperPages, 5)
  })

  test('contents grows onto more sheets and later pages shift with it', ({ assert }) => {
    const many = Array.from({ length: 20 }, (_, i) => entry(`m${i}`, 1))
    const cards = rulesDesign(many, {}, 'showcase')
    const plan = planPages(cards, many)
    assert.equal(plan.contentsPages, 3)
    assert.equal(plan.rows[0].page, 1 + plan.contentsPages + 1)
  })

  test('the budget follows the chosen design', ({ assert }) => {
    const list = Array.from({ length: 6 }, (_, i) => entry(`e${i}`, 2))
    const compact = buildManifest({
      entries: list,
      wrapper: {},
      brand,
      design: rulesDesign(list, {}, 'compact'),
    })
    const brochure = buildManifest({
      entries: list,
      wrapper: {},
      brand,
      design: rulesDesign(list, {}, 'brochure'),
    })
    assert.equal(collectionBudget(compact, {}).wrapperPages, 2)
    assert.isAbove(
      collectionBudget(brochure, {}).wrapperPages,
      collectionBudget(compact, {}).wrapperPages
    )
  })

  test('composeContents accepts a design', ({ assert }) => {
    const list = [entry('a', 2), entry('b', 1)]
    const contents = composeContents(list, { design: rulesDesign(list, {}, 'compact') })
    assert.deepEqual(
      contents.rows.map((r) => [r.entryId, r.page]),
      [
        ['a', 2],
        ['b', 4],
      ]
    )
  })

  test('the design is part of the approval hash', ({ assert }) => {
    const list = [entry('a'), entry('b')]
    const base = buildManifest({ entries: list, wrapper: {}, brand })
    const brochure = buildManifest({
      entries: list,
      wrapper: {},
      brand,
      design: rulesDesign(list, {}, 'brochure'),
    })
    const showcase = buildManifest({
      entries: list,
      wrapper: {},
      brand,
      design: rulesDesign(list, {}, 'showcase'),
    })
    assert.notEqual(manifestHash(base), manifestHash(brochure))
    assert.notEqual(manifestHash(brochure), manifestHash(showcase))
  })
})

test.group('Portfolio validation', () => {
  const list = [entry('a'), entry('b')]
  const base = (): PortfolioDesign => rulesDesign(list, { about: 'About' }, 'showcase')

  test('a rules design is valid', ({ assert }) => {
    assert.deepEqual(validateDesign(base(), list, { about: 'About' }), [])
  })

  test('every entry appears exactly once', ({ assert }) => {
    const design = base()
    const missing = { ...design, pages: design.pages.filter((p) => p.id !== 'entry-b') }
    assert.include(
      validateDesign(missing, list, {}).map((f) => f.code),
      'entry_missing'
    )
    const twice = {
      ...design,
      pages: [...design.pages, { id: 'again', kind: 'entry' as const, entryId: 'a' }],
    }
    assert.include(
      validateDesign(twice, list, {}).map((f) => f.code),
      'entry_repeated'
    )
    const stranger = {
      ...design,
      pages: [...design.pages, { id: 'x', kind: 'entry' as const, entryId: 'zzz' }],
    }
    assert.include(
      validateDesign(stranger, list, {}).map((f) => f.code),
      'unknown_entry'
    )
  })

  test('cover comes first, contact comes last, and neither repeats', ({ assert }) => {
    const design = base()
    const [cover, ...rest] = design.pages
    const moved = { ...design, pages: [...rest, cover] }
    assert.include(
      validateDesign(moved, list, { about: 'About' }).map((f) => f.code),
      'cover_first'
    )
    const contact = design.pages.at(-1)!
    const early = { ...design, pages: [contact, ...design.pages.slice(0, -1)] }
    assert.include(
      validateDesign(early, list, { about: 'About' }).map((f) => f.code),
      'contact_last'
    )
    const twice = {
      ...design,
      pages: [design.pages[0], { ...design.pages[0], id: 'cover-2' }, ...design.pages.slice(1)],
    }
    assert.include(
      validateDesign(twice, list, { about: 'About' }).map((f) => f.code),
      'too_many'
    )
  })

  test('an introduction page needs text from the page or the company introduction', ({
    assert,
  }) => {
    const design: PortfolioDesign = {
      source: 'custom',
      pages: [
        { id: 's', kind: 'statement', variant: 'plain' },
        { id: 'entry-a', kind: 'entry', entryId: 'a' },
        { id: 'entry-b', kind: 'entry', entryId: 'b' },
      ],
    }
    assert.include(
      validateDesign(design, list, {}).map((f) => f.code),
      'statement_empty'
    )
    assert.notInclude(
      validateDesign(design, list, { about: 'Text' }).map((f) => f.code),
      'statement_empty'
    )
  })
})

test.group('Portfolio parsing (untrusted input)', () => {
  const good = {
    source: 'custom',
    pages: [
      { id: 'cover', kind: 'cover', variant: 'ribbons', subtitle: ' 2026 selection ' },
      {
        id: 'h',
        kind: 'highlights',
        variant: 'numbers',
        items: [{ value: '40%', label: 'faster' }],
      },
      { id: 'entry-a', kind: 'entry', entryId: 'a' },
    ],
  }

  test('accepts a well-formed design and trims text', ({ assert }) => {
    const result = parseDesign(good)
    assert.isTrue(result.ok)
    if (result.ok)
      assert.equal((result.design.pages[0] as { subtitle?: string }).subtitle, '2026 selection')
  })

  test('rejects unknown keys, kinds, variants and sources instead of storing them', ({
    assert,
  }) => {
    const bad = (mutate: (copy: any) => void) => {
      const copy = structuredClone(good) as any
      mutate(copy)
      return parseDesign(copy).ok
    }
    assert.isFalse(bad((d) => (d.extra = 1)))
    assert.isFalse(bad((d) => (d.source = 'hacker')))
    assert.isFalse(bad((d) => (d.pages[0].kind = 'script')))
    assert.isFalse(bad((d) => (d.pages[0].variant = 'neon')))
    assert.isFalse(bad((d) => (d.pages[0].onclick = 'x')))
    assert.isFalse(bad((d) => (d.pages[1].items = [])))
    assert.isFalse(bad((d) => (d.pages[1].items[0].value = 'x'.repeat(40))))
    assert.isFalse(bad((d) => (d.pages = [])))
    assert.isFalse(bad((d) => (d.pages = Array.from({ length: 200 }, () => d.pages[2]))))
  })

  test('a non-object is rejected', ({ assert }) => {
    for (const value of [null, 'x', 4, [], undefined]) assert.isFalse(parseDesign(value).ok)
  })
})

test.group('Portfolio reconcile', () => {
  test('a preset design is rebuilt when entries or the introduction change', ({ assert }) => {
    const first = [entry('a'), entry('b')]
    const design = rulesDesign(first, {}, 'showcase')
    const next = reconcileDesign(design, [entry('a'), entry('b'), entry('c')], { about: 'Hi' })
    assert.include(kinds(next), 'statement')
    assert.equal(next.pages.filter((p) => p.kind === 'entry').length, 3)
    assert.equal(next.preset, 'showcase')
  })

  test('a custom design keeps the reviewer pages, drops removed entries and adds new ones before contact', ({
    assert,
  }) => {
    const design: PortfolioDesign = {
      source: 'custom',
      pages: [
        { id: 'cover', kind: 'cover', variant: 'panel' },
        { id: 'entry-b', kind: 'entry', entryId: 'b' },
        { id: 'sec', kind: 'section', variant: 'plain', title: 'Mine' },
        { id: 'entry-a', kind: 'entry', entryId: 'a' },
        { id: 'contact', kind: 'contact', variant: 'light' },
      ],
    }
    const next = reconcileDesign(design, [entry('a'), entry('c')], {})
    assert.deepEqual(
      next.pages.map((p) => p.id),
      ['cover', 'sec', 'entry-a', 'entry-c', 'contact']
    )
    assert.equal(next.source, 'custom')
  })
})
