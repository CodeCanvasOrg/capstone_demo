import { test } from '@japa/runner'
import {
  approvalState,
  bundleHash,
  canExport,
  type ReviewBundle,
} from '../../shared/layout/bundle.ts'

const bundle = (extra: Partial<ReviewBundle> = {}): ReviewBundle => ({
  contentHash: 'c'.repeat(64),
  versionId: 'v1',
  template: { id: 'case_study_standard', version: 1 },
  brand: { id: 'humblebee', version: 1 },
  options: { imageMode: 'auto', cta: { label: 'Talk', href: 'https://example.com' } },
  assetIds: ['img-b', 'img-a'],
  rendererVersion: 'render-1',
  ...extra,
})

test.group('Review bundle (APR-01, EDT-02)', () => {
  test('hash is stable across key order and asset order', ({ assert }) => {
    const a = bundleHash(bundle())
    const b = bundleHash(
      bundle({
        options: { cta: { href: 'https://example.com', label: 'Talk' }, imageMode: 'auto' },
        assetIds: ['img-a', 'img-b'],
      })
    )
    assert.equal(a, b)
    assert.match(a, /^[0-9a-f]{64}$/)
  })

  test('content, template, brand, option, asset and renderer changes each change the hash', ({
    assert,
  }) => {
    const base = bundleHash(bundle())
    const variants: Partial<ReviewBundle>[] = [
      { contentHash: 'd'.repeat(64) },
      { template: { id: 'case_study_concise', version: 1 } },
      { template: { id: 'case_study_standard', version: 2 } },
      { brand: { id: 'humblebee', version: 2 } },
      { options: { imageMode: 'without' } },
      { assetIds: ['img-a'] },
      { rendererVersion: 'render-2' },
      { definitions: { template: 'a', brand: 'b' } },
    ]
    for (const change of variants)
      assert.notEqual(bundleHash(bundle(change)), base, JSON.stringify(change))
  })

  test('approval is current only when the bundle hash still matches', ({ assert }) => {
    const approved = { bundleHash: bundleHash(bundle()), approvedById: 7 }
    assert.equal(approvalState(approved, bundle()), 'current')
    assert.equal(approvalState(approved, bundle({ rendererVersion: 'render-2' })), 'stale')
    assert.equal(approvalState(undefined, bundle()), 'none')
  })

  test('selecting another layout or brand never keeps a stale approval', ({ assert }) => {
    const approved = { bundleHash: bundleHash(bundle()), approvedById: 7 }
    assert.equal(
      approvalState(approved, bundle({ brand: { id: 'humblebee', version: 2 } })),
      'stale'
    )
    assert.equal(
      approvalState(approved, bundle({ template: { id: 'case_study_concise', version: 1 } })),
      'stale'
    )
  })

  test('final export requires a current approval and no blocking findings', ({ assert }) => {
    const approved = { bundleHash: bundleHash(bundle()), approvedById: 7 }
    assert.deepEqual(canExport(approved, bundle(), []), { ok: true })
    assert.deepEqual(canExport(undefined, bundle(), []), { ok: false, reason: 'not_approved' })
    assert.deepEqual(canExport(approved, bundle({ assetIds: [] }), []), {
      ok: false,
      reason: 'stale_approval',
    })
    for (const code of [
      'schema_invalid',
      'unresolved_claim',
      'broken_citation',
      'overflow',
      'missing_asset',
    ]) {
      assert.deepEqual(canExport(approved, bundle(), [{ code, severity: 'error' }]), {
        ok: false,
        reason: 'blocking_findings',
        codes: [code],
      })
    }
  })

  test('approval cannot bypass severe findings; informational warnings do not block', ({
    assert,
  }) => {
    const approved = { bundleHash: bundleHash(bundle()), approvedById: 7 }
    assert.isTrue(
      canExport(approved, bundle(), [{ code: 'near_empty_page', severity: 'warning' }]).ok
    )
  })

  test('the hash never needs provider keys or reviewer notes', ({ assert }) => {
    const input = JSON.stringify(bundle())
    assert.notMatch(input, /apiKey|reviewerNotes|secret/i)
  })
})
