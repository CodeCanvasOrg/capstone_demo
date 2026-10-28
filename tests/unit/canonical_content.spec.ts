import { test } from '@japa/runner'
import CanonicalContentService from '#services/documents/canonical_content_service'
import { SYSTEM_TEMPLATES } from '../../shared/templates/catalog.ts'
import type { CanonicalContent } from '../../shared/templates/content.ts'
const service = new CanonicalContentService()
export function fixture(): CanonicalContent {
  return {
    schemaVersion: 1,
    title: 'Project',
    description: 'A project description.',
    language: 'en',
    stage: 'pilot',
    outcomeStatus: 'not_measured',
    sections: SYSTEM_TEMPLATES[0].sections
      .filter((s) => s.required || s.key === 'limitations')
      .map((s, i) => ({
        key: s.key,
        blocks: [
          {
            type: 'paragraph',
            id: `b${i}`,
            evidenceIds: [],
            text: `${s.key === 'outcomes' ? 'Outcomes are not measured. ' : ''}${'Grounded project narrative with explicit boundaries. '.repeat(24)}`,
          },
        ],
      })),
  }
}
const setup = {
  templateVersionId: '00000000-0000-4000-8000-000000000001',
  language: 'en',
  stage: 'pilot',
  imagePolicy: 'none',
  audience: 'internal',
  imageChunkIds: [],
  brandVersionId: null,
} as const
test.group('Canonical template contract', () => {
  test('rejects unknown fields, duplicate IDs and unsafe reference links', ({ assert }) => {
    const value = fixture()
    assert.throws(() => service.parse({ ...value, html: '<script>' }))
    value.sections[1].blocks[0].id = 'b0'
    assert.throws(() => service.parse(value))
    value.sections[1].blocks = [
      {
        id: 'x',
        type: 'reference_link',
        evidenceIds: [],
        label: 'unsafe',
        url: 'javascript:alert(1)',
      },
    ]
    assert.throws(() => service.parse(value))
  })
  for (const statement of [
    'Outcomes have not been measured.',
    'Results have not yet been measured.',
    'Results have not been evaluated.',
    'Outcomes are not measured.',
    'No measured outcomes are available.',
  ]) {
    test(`accepts the explicit unmeasured statement: ${statement}`, ({ assert }) => {
      const value = fixture()
      for (const section of value.sections)
        for (const block of section.blocks) if (block.type === 'paragraph') block.text = statement
      assert.isFalse(
        service
          .validate(value, SYSTEM_TEMPLATES[0], { ...setup, imageChunkIds: [] }, [])
          .some((issue) => issue.code === 'unmeasured_statement')
      )
    })
  }
  test('still requires an actual unmeasured statement', ({ assert }) => {
    const value = fixture()
    for (const section of value.sections)
      for (const block of section.blocks)
        if (block.type === 'paragraph')
          block.text = 'Outcomes were measured. They were not only measured but verified.'
    assert.isTrue(
      service
        .validate(value, SYSTEM_TEMPLATES[0], { ...setup, imageChunkIds: [] }, [])
        .some((issue) => issue.code === 'unmeasured_statement')
    )
  })

  test('claim approval binds exact text and evidence rather than just a block identity', ({
    assert,
  }) => {
    const value = fixture()
    const block = value.sections[0].blocks[0]
    const manifest: import('#services/documents/canonical_content_service').Manifest = []
    const before = service.claim(block, manifest)
    const reviews = [
      {
        claim_hash: before.claimHash,
        evidence_hash: before.evidenceHash,
        decision: 'user_assertion_accepted',
      },
    ]
    assert.isFalse(
      service
        .validate(value, SYSTEM_TEMPLATES[0], { ...setup, imageChunkIds: [] }, [], reviews)
        .some((i) => i.blockId === block.id && i.code === 'claim_unverified')
    )
    if (block.type === 'paragraph') block.text += ' Invented impact.'
    assert.isTrue(
      service
        .validate(value, SYSTEM_TEMPLATES[0], { ...setup, imageChunkIds: [] }, [], reviews)
        .some((i) => i.blockId === block.id && i.code === 'claim_unverified')
    )
  })
  test('requires limitations for unmeasured outcomes and catches missing and reordered sections', ({
    assert,
  }) => {
    const value = fixture()
    value.sections = value.sections.filter((s) => s.key !== 'limitations')
    value.sections.reverse()
    const issues = service.validate(value, SYSTEM_TEMPLATES[0], { ...setup, imageChunkIds: [] }, [])
    assert.isTrue(issues.some((i) => i.code === 'section_order'))
    assert.isTrue(
      issues.some((i) => i.code === 'missing_section' && i.sectionKey === 'limitations')
    )
  })
})
