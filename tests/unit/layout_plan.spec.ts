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
    assert.deepEqual(types(plan), ['hero', 'results', 'text', 'text', 'text', 'figure', 'sources'])
    assert.equal(plan.template.id, 'case_study_standard')
    assert.equal(plan.brand.version, brand.version)
  })

  test('empty optional blocks collapse; nothing is fabricated to fill them', ({ assert }) => {
    const plan = planLayout(fx.sparse, standard, brand, {})
    assert.deepEqual(types(plan), ['hero', 'text'])
    assert.notInclude(types(plan), 'results')
    assert.notInclude(types(plan), 'figure')
    assert.notInclude(types(plan), 'cta')
    assert.notInclude(types(plan), 'sources')
  })

  test('no-image and no-metric variants keep every text section', ({ assert }) => {
    const noImage = planLayout(fx.noImage, standard, brand, {})
    assert.notInclude(types(noImage), 'figure')
    assert.equal(noImage.blocks.filter((b) => b.type === 'text').length, 3)
    assert.equal(noImage.variant, 'no-image')

    const noMetric = planLayout(fx.noMetric, standard, brand, {})
    assert.notInclude(types(noMetric), 'results')
    assert.equal(planLayout(fx.entry01, standard, brand, {}).variant, 'image')
  })

  test('imageMode "without" drops figures even when the content has them', ({ assert }) => {
    const plan = planLayout(fx.entry01, standard, brand, { imageMode: 'without' })
    assert.notInclude(types(plan), 'figure')
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

  test('the concise preset keeps selected capabilities but omits the standard-only roadmap', ({
    assert,
  }) => {
    const plan = planLayout(fx.entry01, concise, brand, {})
    assert.notInclude(types(plan), 'roadmap')
    assert.include(types(plan), 'sources')
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
