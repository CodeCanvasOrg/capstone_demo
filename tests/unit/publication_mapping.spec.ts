import { test } from '@japa/runner'
import PublicationContentService from '#services/documents/publication_content_service'
import { legacyCaseStudy } from '../fixtures/publication/legacy_case_study.ts'

const service = new PublicationContentService()
const stripIds = (value: any): any =>
  Array.isArray(value)
    ? value.map(stripIds)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== 'nodeId')
            .map(([key, item]) => [key, stripIds(item)])
            .filter(([key, item]) => !(key === 'attrs' && !Object.keys(item as object).length))
        )
      : value

test.group('Legacy to publication v1 mapping', () => {
  test('content is preserved exactly; only identities and root metadata are added', ({
    assert,
  }) => {
    const original = structuredClone(legacyCaseStudy)
    const before = JSON.stringify(original)
    const { document, report } = service.mapLegacy(original, 'ns')
    assert.equal(JSON.stringify(original), before)
    assert.isTrue(report.mapped)
    const { attrs, ...tree } = document as any
    assert.deepEqual(stripIds(tree), stripIds(legacyCaseStudy))
    assert.isDefined(attrs.publication)
  })

  test('replays are byte-identical and namespaces are independent', ({ assert }) => {
    const first = service.mapLegacy(structuredClone(legacyCaseStudy), 'ns').document
    const again = service.mapLegacy(structuredClone(legacyCaseStudy), 'ns').document
    const other = service.mapLegacy(structuredClone(legacyCaseStudy), 'other').document
    assert.equal(service.contentHash(first), service.contentHash(again))
    assert.notEqual(service.contentHash(first), service.contentHash(other))
  })

  test('an already mapped document is reported and left alone', ({ assert }) => {
    const first = service.mapLegacy(structuredClone(legacyCaseStudy), 'ns').document
    const second = service.mapLegacy(first, 'other')
    assert.isFalse(second.report.mapped)
    assert.equal(second.document, first)
  })

  test('a draft without a title is reported, not given a fabricated one', ({ assert }) => {
    const doc = {
      type: 'doc' as const,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'No title' }] }],
    }
    const { document, report } = service.mapLegacy(doc, 'ns')
    assert.isFalse(report.mapped)
    assert.deepEqual(document, doc)
    assert.equal(report.unresolved[0].code, 'missing_title')
  })

  test('semantics prose does not establish are reported, never invented', ({ assert }) => {
    const { document, report } = service.mapLegacy(structuredClone(legacyCaseStudy), 'ns')
    const codes = report.unresolved.map((item) => item.code)
    assert.includeMembers(codes, ['authorship_unknown', 'results_not_annotated'])
    const publication = document.attrs!.publication as any
    assert.notProperty(publication, 'claims')
    assert.notProperty(publication, 'results')
  })
})
