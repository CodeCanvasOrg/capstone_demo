import { test } from '@japa/runner'
import { fitPlan, inspectPages } from '../../shared/layout/fit.ts'
import { planLayout } from '../../shared/layout/plan.ts'
import { getTemplate } from '../../shared/layout/templates.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import * as fx from '../fixtures/layout/entries.ts'

const brand = getBrandKit('humblebee')!
const standard = getTemplate('case_study_standard')!
const concise = getTemplate('case_study_concise')!
const plan = (data: typeof fx.entry01, template = standard, options = {}) =>
  planLayout(data, template, brand, options)

test.group('Page fitting (RND-02)', () => {
  test('sparse and entry-01 content fit their budgets without changes', ({ assert }) => {
    const a = fitPlan(plan(fx.sparse, concise), concise)
    assert.isTrue(a.fits)
    assert.equal(a.pages, 1)
    assert.isEmpty(a.steps)
    const b = fitPlan(plan(fx.entry01, standard), standard)
    assert.isTrue(b.fits)
    assert.isAtMost(b.pages, 2)
  })

  test('footnotes and the source block count toward the entry budget', ({ assert }) => {
    const few = fitPlan(plan(fx.entry01, concise), concise)
    const many = fitPlan(plan(fx.longSources, concise), concise)
    assert.isAbove(many.usedUnits, few.usedUnits)
  })

  test('fitting order: compact variant first, then suggest standard, never clip', ({ assert }) => {
    const dense = plan(fx.dense, concise)
    const result = fitPlan(dense, concise)
    assert.isFalse(result.fits)
    assert.equal(result.steps[0].kind, 'compact_variant')
    // The standard layout is suggested, not applied.
    const last = result.steps.at(-1)!
    assert.equal(last.kind, 'suggest_template')
    assert.equal(last.kind === 'suggest_template' && last.templateId, 'case_study_standard')
    assert.equal(result.plan.template.id, 'case_study_concise')
    // Content is untouched: no blocks removed, no text clipped.
    assert.deepEqual(
      result.plan.blocks.map((b) => b.id),
      dense.blocks.map((b) => b.id)
    )
    assert.include(
      result.findings.map((f) => f.code),
      'budget_exceeded'
    )
  })

  test('compact variant stays above the template minimum type size', ({ assert }) => {
    const result = fitPlan(plan(fx.dense, concise), concise)
    for (const block of result.plan.blocks) {
      assert.isAtLeast(block.fontPt, concise.blocks.find((b) => b.type === block.type)!.minFontPt)
    }
  })

  test('a compact variant is used only when it actually makes content fit', ({ assert }) => {
    // Slightly over the concise budget in normal type, within it when compact.
    // A measurement function (e.g. from a rendered page) replaces the estimate.
    const result = fitPlan(plan(fx.entry01, concise), concise, {
      measure: (p) => (p.density === 'compact' ? 0.95 : 1.04),
    })
    assert.isTrue(result.fits)
    assert.equal(result.plan.density, 'compact')
    assert.deepEqual(
      result.steps.map((s) => s.kind),
      ['compact_variant']
    )
  })

  test('exceeding the maximum budget is an unresolved finding, not a silent third page', ({
    assert,
  }) => {
    const result = fitPlan(plan(fx.overflowing, standard), standard)
    assert.isFalse(result.fits)
    const codes = result.findings.map((f) => f.code)
    assert.include(codes, 'budget_exceeded')
    assert.include(codes, 'fit_unresolved')
    assert.isUndefined(result.steps.find((s) => s.kind === 'suggest_template'))
    assert.isAbove(result.pages, standard.pageBudget)
  })

  test('fitting never removes citations or qualifiers', ({ assert }) => {
    const before = JSON.stringify(plan(fx.dense, concise).blocks)
    const after = JSON.stringify(fitPlan(plan(fx.dense, concise), concise).plan.blocks)
    for (const needle of ['"number":1', '"number":2', '"number":3', 'Estimated', 'Measured']) {
      assert.equal(before.includes(needle), after.includes(needle), needle)
    }
  })

  test('long titles are flagged against the headline limit as a starting limit', ({ assert }) => {
    const result = fitPlan(plan(fx.longTitle, standard), standard)
    assert.include(
      result.findings.map((f) => f.code),
      'headline_long'
    )
    assert.equal(result.findings.find((f) => f.code === 'headline_long')!.severity, 'warning')
  })
})

test.group('Measured page inspection (RND-02)', () => {
  const page = (words: number, extra = {}) => ({ words, figures: 0, kind: 'entry', ...extra })

  test('reports an over-budget page count', ({ assert }) => {
    const found = inspectPages([page(400), page(400), page(400)], { budget: 2 })
    assert.equal(found[0].code, 'page_budget_exceeded')
  })

  test('near-empty pages (<120 words, no figure) are review candidates', ({ assert }) => {
    const found = inspectPages([page(400), page(40)], { budget: 2 })
    assert.deepEqual(
      found.map((f) => [f.code, f.page]),
      [['near_empty_page', 2]]
    )
  })

  test('figures, covers, dividers, contact pages and news blocks are exempt', ({ assert }) => {
    const found = inspectPages(
      [
        page(10, { kind: 'cover' }),
        page(10, { kind: 'divider' }),
        page(10, { kind: 'contact' }),
        page(10, { kind: 'news' }),
        page(60, { figures: 1 }),
      ],
      {}
    )
    assert.isEmpty(found)
  })

  test('detached headings (a heading ending a page) and clipped text are reported', ({
    assert,
  }) => {
    const found = inspectPages(
      [page(300, { endsWithHeading: true }), page(300, { clippedBlocks: ['b3'] })],
      {}
    )
    assert.sameMembers(
      found.map((f) => f.code),
      ['detached_heading', 'clipped_text']
    )
    assert.equal(found.find((f) => f.code === 'clipped_text')!.blockIds![0], 'b3')
  })

  test('a draft or final export is blocked by severe findings only', ({ assert }) => {
    const severe = inspectPages([page(300, { clippedBlocks: ['b1'] })], {})
    assert.isTrue(severe.some((f) => f.severity === 'error'))
    const info = inspectPages([page(400), page(40)], { budget: 2 })
    assert.isTrue(info.every((f) => f.severity === 'warning'))
  })
})
