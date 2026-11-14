import { test } from '@japa/runner'
import { planLayout } from '../../shared/layout/plan.ts'
import { getTemplate } from '../../shared/layout/templates.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import * as fx from '../fixtures/layout/entries.ts'

const brand = getBrandKit('humblebee')!
const standard = getTemplate('case_study_standard')!
const concise = getTemplate('case_study_concise')!
const types = (plan: ReturnType<typeof planLayout>) => plan.blocks.map((b) => b.type)

test.group('Layout plan (TPL-03/04)', () => {
  test('entry 01 yields hero, result row, sections, figure and sources in template order', ({
    assert,
  }) => {
    const plan = planLayout(fx.entry01, standard, brand, {})
    // Challenge and Solution pair into columns; the first image sits in the hero.
    assert.deepEqual(types(plan), ['hero', 'results', 'columns', 'text', 'sources'])
    const hero = plan.blocks[0] as any
    assert.equal(hero.kicker, 'CASE STUDY')
    assert.equal(hero.figure.alt, 'Customs dashboard')
    assert.equal(plan.template.id, 'case_study_standard')
    assert.equal(plan.brand.version, brand.version)
  })

  test('empty optional blocks collapse; nothing is fabricated to fill them', ({ assert }) => {
    const plan = planLayout(fx.sparse, standard, brand, {})
    assert.deepEqual(types(plan), ['hero', 'text'])
    assert.notInclude(types(plan), 'results')
    assert.isUndefined((plan.blocks[0] as any).figure)
    assert.notInclude(types(plan), 'cta')
    assert.notInclude(types(plan), 'sources')
  })

  test('no-image and no-metric variants keep every text section', ({ assert }) => {
    const noImage = planLayout(fx.noImage, standard, brand, {})
    assert.isUndefined((noImage.blocks[0] as any).figure)
    assert.deepEqual(types(noImage), ['hero', 'results', 'columns', 'text', 'sources'])
    assert.equal(noImage.variant, 'no-image')

    const noMetric = planLayout(fx.noMetric, standard, brand, {})
    assert.notInclude(types(noMetric), 'results')
    assert.equal(planLayout(fx.entry01, standard, brand, {}).variant, 'image')
  })

  test('imageMode "without" drops figures even when the content has them', ({ assert }) => {
    const plan = planLayout(fx.entry01, standard, brand, { imageMode: 'without' })
    assert.isUndefined((plan.blocks[0] as any).figure)
    assert.equal(plan.variant, 'no-image')
  })

  test('result row keeps every qualifier and unit with its value', ({ assert }) => {
    const plan = planLayout(fx.entry01, standard, brand, {})
    const row = plan.blocks.find((b) => b.type === 'results')!
    assert.deepEqual(
      (row as any).items.map((item: any) => [item.value, item.label]),
      [
        ['42%', 'Measured'],
        ['30%', 'Estimated'],
      ]
    )
    const upTo = (row as any).items[1]
    // "up to" survives as visible text beside the value.
    assert.equal(upTo.prefix, 'Up to')
    assert.include(upTo.context, 'pilot team')
  })

  test('estimated and design-target results can never be shown as measured', ({ assert }) => {
    const plan = planLayout({ ...fx.entry01, results: [fx.upTo, fx.target] }, standard, brand, {})
    const items = (plan.blocks.find((b) => b.type === 'results') as any).items
    assert.deepEqual(
      items.map((i: any) => i.label),
      ['Estimated', 'Design target']
    )
  })

  test('CTA appears only when the user supplied one', ({ assert }) => {
    assert.notInclude(types(planLayout(fx.entry01, standard, brand, {})), 'cta')
    const withCta = planLayout(fx.entry01, standard, brand, {
      cta: { label: 'Talk to us', href: 'https://example.com/contact' },
    })
    assert.include(types(withCta), 'cta')
    assert.equal(types(withCta).at(-1), 'sources')
  })

  test('the concise preset keeps sources and drops nothing the content has', ({ assert }) => {
    const plan = planLayout(fx.entry01, concise, brand, {})
    assert.include(types(plan), 'sources')
    assert.include(types(plan), 'columns')
  })

  test('the branded entry becomes hero, results, columns, steps, capability cards and roadmap', ({
    assert,
  }) => {
    const plan = planLayout(fx.brandedClient, concise, brand, {})
    assert.deepEqual(types(plan), [
      'hero',
      'results',
      'columns',
      'steps',
      'capabilities',
      'roadmap',
      'sources',
    ])
    const steps = plan.blocks.find((b) => b.type === 'steps') as any
    assert.deepEqual(
      steps.items.map((i: any) => [i.n, i.title]),
      [
        ['01', 'Upload'],
        ['02', 'Detect'],
        ['03', 'Extract'],
        ['04', 'Review and export'],
      ]
    )
    assert.equal(steps.items[0].text, 'Invoice, packing list or ID as image or PDF.')
    const caps = plan.blocks.find((b) => b.type === 'capabilities') as any
    assert.equal(caps.items.length, 3)
    assert.equal(caps.items[2].title, 'Runs on existing servers')
    const roadmap = plan.blocks.find((b) => b.type === 'roadmap') as any
    assert.include(roadmap.text, 'document classification')
  })

  test('the Key results section is not repeated as text when results are structured', ({
    assert,
  }) => {
    const data = {
      ...fx.brandedClient,
      body: [fx.h2('Key results'), fx.p('90% — less time'), ...fx.brandedClient.body],
    }
    const plan = planLayout(data, standard, brand, {})
    assert.notInclude(JSON.stringify(plan.blocks), 'Key results')
    // Without structured results the section is ordinary content and stays.
    const bare = planLayout({ ...data, results: undefined }, standard, brand, {})
    assert.include(JSON.stringify(bare.blocks), 'Key results')
  })

  test('results without a figure are not shown as stats and are flagged for review', ({
    assert,
  }) => {
    const data = {
      ...fx.brandedClient,
      results: [
        {
          value: 'Fewer pixels',
          qualifier: 'design_target' as const,
          units: 'frame area analyzed',
        },
        fx.measured,
      ],
    }
    const plan = planLayout(data, standard, brand, {})
    const items = (plan.blocks.find((b) => b.type === 'results') as any).items
    assert.deepEqual(
      items.map((i: any) => i.value),
      ['42%']
    )
    assert.include(
      plan.findings.map((f) => f.code),
      'non_numeric_result'
    )
    // With no usable figure at all, the band collapses.
    const none = planLayout({ ...data, results: [data.results[0]] }, standard, brand, {})
    assert.notInclude(types(none), 'results')
  })

  test('result notes become lettered footnote markers, not extra paragraphs', ({ assert }) => {
    const plan = planLayout(fx.brandedClient, standard, brand, {})
    const items = (plan.blocks.find((b) => b.type === 'results') as any).items
    assert.deepEqual(
      items.map((i: any) => i.marker),
      ['a', undefined, 'b']
    )
    const sources = plan.blocks.find((b) => b.type === 'sources') as any
    assert.deepEqual(
      sources.notes.map((n: any) => n.marker),
      ['a', 'b']
    )
    assert.include(sources.notes[0].text, 'no baseline')
  })

  test('list items with citations or formatting stay ordinary text rather than losing them', ({
    assert,
  }) => {
    const data = structuredClone(fx.brandedClient)
    ;(data.body[7] as any).content[0].content[0].content.push({ type: 'reference', number: 1 })
    const plan = planLayout(data, standard, brand, {})
    assert.notInclude(types(plan), 'capabilities')
    assert.include(JSON.stringify(plan.blocks), 'Data stays on-premise')
  })

  test('a CTA headline is optional and only shown when supplied', ({ assert }) => {
    const cta = planLayout(fx.entry01, standard, brand, {
      cta: {
        label: 'Talk to us',
        href: 'https://example.com/c',
        headline: 'Building this in-house?',
      },
    }).blocks.find((b) => b.type === 'cta') as any
    assert.equal(cta.headline, 'Building this in-house?')
  })

  test('sections are bound to stable ids so measurements can refer to them', ({ assert }) => {
    const plan = planLayout(fx.entry01, standard, brand, {})
    const ids = plan.blocks.map((b) => b.id)
    assert.lengthOf(new Set(ids), ids.length)
    assert.deepEqual(
      ids,
      planLayout(fx.entry01, standard, brand, {}).blocks.map((b) => b.id)
    )
  })

  test('the plan never carries reviewer notes or internal ids', ({ assert }) => {
    const plan = JSON.stringify(planLayout(fx.entry01, standard, brand, {}))
    assert.notMatch(plan, /reviewer|chunkId|nodeId|claimId/i)
  })

  test('rendering the same entry through both presets preserves claims and references', ({
    assert,
  }) => {
    const refs = (plan: ReturnType<typeof planLayout>) =>
      JSON.stringify(plan.blocks).match(/"number":\d+/g)?.length ?? 0
    const a = planLayout(fx.entry01, standard, brand, {})
    const b = planLayout(fx.entry01, concise, brand, {})
    assert.equal(refs(a), refs(b))
    const resultsOf = (plan: ReturnType<typeof planLayout>) =>
      (plan.blocks.find((x) => x.type === 'results') as any).items.map((i: any) => i.value)
    assert.deepEqual(resultsOf(a), resultsOf(b))
  })
})
