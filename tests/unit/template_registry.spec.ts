import { test } from '@japa/runner'
import {
  checkCompatibility,
  getTemplate,
  listTemplates,
  resolveOptions,
} from '../../shared/layout/templates.ts'

test.group('Template registry (TPL-02)', () => {
  test('lists the two P0 case-study presets with page budgets', ({ assert }) => {
    const list = listTemplates({ docType: 'case_study' })
    assert.sameMembers(
      list.map((x) => x.id),
      ['case_study_concise', 'case_study_standard']
    )
    assert.equal(getTemplate('case_study_concise')!.pageBudget, 1)
    assert.equal(getTemplate('case_study_standard')!.pageBudget, 2)
  })

  test('published versions are immutable and old versions stay resolvable', ({ assert }) => {
    const template = getTemplate('case_study_standard', 1)!
    assert.isTrue(Object.isFrozen(template))
    assert.isTrue(Object.isFrozen(template.blocks))
    assert.throws(() => {
      ;(template as { pageBudget: number }).pageBudget = 9
    })
    assert.isUndefined(getTemplate('case_study_standard', 999))
  })

  test('no template exists for product, research or news until implemented', ({ assert }) => {
    for (const docType of ['product', 'research', 'news'] as const) {
      assert.deepEqual(listTemplates({ docType }), [])
      const result = checkCompatibility('case_study_standard', docType, {})
      assert.isFalse(result.ok)
      // Unsupported types must never silently fall back to the case-study layout.
      assert.equal(result.errors[0].code, 'unsupported_doc_type')
    }
  })

  test('unknown or forged template ids are rejected before rendering', ({ assert }) => {
    const result = checkCompatibility('../../etc/passwd', 'case_study', {})
    assert.isFalse(result.ok)
    assert.equal(result.errors[0].code, 'unknown_template')
  })

  test('disabled templates are not listed and cannot be selected', ({ assert }) => {
    const result = checkCompatibility(
      'case_study_standard',
      'case_study',
      {},
      { disabled: ['case_study_standard'] }
    )
    assert.isFalse(result.ok)
    assert.equal(result.errors[0].code, 'template_disabled')
    assert.notInclude(
      listTemplates({ docType: 'case_study', disabled: ['case_study_standard'] }).map((x) => x.id),
      'case_study_standard'
    )
  })

  test('options are validated against the template and defaults are filled', ({ assert }) => {
    const template = getTemplate('case_study_concise')!
    const ok = resolveOptions(template, {})
    assert.deepInclude(ok.options, { imageMode: 'auto' })
    assert.isEmpty(ok.errors)

    const bad = resolveOptions(template, { imageMode: 'sideways', surprise: true })
    assert.sameMembers(
      bad.errors.map((e) => e.code),
      ['invalid_option_value', 'unknown_option']
    )
  })

  test('CTA must be explicit text with a safe link; it is never invented', ({ assert }) => {
    const template = getTemplate('case_study_standard')!
    assert.isUndefined(resolveOptions(template, {}).options.cta)
    const unsafe = resolveOptions(template, {
      cta: { label: 'Talk to us', href: 'javascript:alert(1)' },
    })
    assert.equal(unsafe.errors[0].code, 'invalid_option_value')
    const safe = resolveOptions(template, {
      cta: { label: 'Talk to us', href: 'https://example.com/contact' },
    })
    assert.isEmpty(safe.errors)
  })

  test('each block declares empty behaviour, minimum type size and page-break rules', ({
    assert,
  }) => {
    for (const template of listTemplates({ docType: 'case_study' })) {
      for (const block of template.blocks) {
        assert.oneOf(block.onEmpty, ['collapse', 'required'])
        assert.isAtLeast(block.minFontPt, 8)
        assert.isArray(block.keepWith)
      }
      // Sources count toward the entry budget.
      assert.isTrue(template.blocks.some((b) => b.type === 'sources'))
    }
  })
})
