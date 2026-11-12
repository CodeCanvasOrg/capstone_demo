import { test } from '@japa/runner'
import PublicationContentService, {
  PublicationContentError,
  canonicalJson,
  sha256,
} from '#services/documents/publication_content_service'

const t = (text: string, marks?: unknown[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) })
const cite = (id: string) => ({
  type: 'sourceCitation',
  attrs: { sourceChunkId: id, fileName: 'a.pdf' },
})
const IMG = '11111111-1111-4111-8111-111111111111'

const legacy = () => ({
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [t('Title')] },
    { type: 'paragraph', content: [t('Summary.'), cite('a')] },
    { type: 'paragraph', content: [t('Preamble target of 5% [TODO check]')] },
    { type: 'heading', attrs: { level: 2 }, content: [t('Results')] },
    {
      type: 'paragraph',
      content: [t('Bold', [{ type: 'bold' }]), cite('a'), cite('b'), cite('a')],
    },
    { type: 'image', attrs: { documentImageId: IMG, alt: 'Chart', align: 'left' } },
    { type: 'image', attrs: { src: 'https://x.test/a.png' } },
    { type: 'heading', attrs: { level: 2 }, content: [t('Limits')] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [t('Quote')] }] },
  ],
})

const service = new PublicationContentService()
const stripIds = (value: any): any =>
  Array.isArray(value)
    ? value.map(stripIds)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([k]) => k !== 'nodeId')
            .map(([k, v]) => [k, stripIds(v)])
            .filter(([k, v]) => !(k === 'attrs' && !Object.keys(v as object).length))
        )
      : value

test.group('Legacy to publication v1 mapping', () => {
  test('content is preserved exactly; only identities and root metadata are added', ({
    assert,
  }) => {
    const original = legacy()
    const before = JSON.stringify(original)
    const out = service.mapLegacy(original, 'ns')
    assert.equal(JSON.stringify(original), before) // input untouched
    assert.isTrue(out.mapped)
    const { attrs, ...tree } = out.document as any
    const { attrs: ignored, ...legacyTree } = legacy() as any
    void ignored
    // Text, order, marks, images and citations are identical once identities are removed.
    assert.deepEqual(stripIds(tree), legacyTree)
    assert.isDefined(attrs.publication)
  })

  test('hero, sections, references and figures map deterministically', ({ assert }) => {
    const out = service.mapLegacy(legacy(), 'ns') as any
    const meta = out.document.attrs.publication
    const ids = out.document.content.map((n: any) => n.attrs.nodeId)
    assert.equal(meta.hero.title.nodeId, ids[0])
    assert.equal(meta.hero.summary.nodeId, ids[1])
    assert.deepEqual(
      meta.sections.map((s: any) => [s.type, s.heading?.nodeId, s.nodeIds.length]),
      [
        ['narrative', undefined, 1], // preamble
        ['narrative', ids[3], 3],
        ['narrative', ids[7], 1],
      ]
    )
    assert.deepEqual(
      meta.references.map((r: any) => r.chunkId),
      ['a', 'b']
    ) // repeated ref once
    assert.lengthOf(meta.figures, 1)
    assert.deepEqual(meta.figures[0].asset, { kind: 'document_image', id: IMG })
    // Same input and namespace replay to byte-identical output; another namespace differs.
    assert.equal(
      canonicalJson(service.mapLegacy(legacy(), 'ns').document),
      canonicalJson(out.document)
    )
    assert.notEqual(
      canonicalJson(service.mapLegacy(legacy(), 'other').document),
      canonicalJson(out.document)
    )
  })

  test('ambiguous semantics are reported, not invented or edited', ({ assert }) => {
    const out = service.mapLegacy(legacy(), 'ns')
    const codes = out.report.unresolved.map((u) => u.code)
    assert.includeMembers(codes, [
      'unstructured_qualifier',
      'internal_comment',
      'image_without_registered_asset',
    ])
    const meta = (out.document as any).attrs.publication
    assert.notProperty(meta, 'claims')
    assert.notProperty(meta, 'results')
    assert.include(JSON.stringify(out.document), '[TODO check]')
  })

  test('a draft without a title stays on the legacy path with a report', ({ assert }) => {
    const doc = { type: 'doc' as const, content: [{ type: 'paragraph', content: [t('No title')] }] }
    const out = service.mapLegacy(doc, 'ns')
    assert.isFalse(out.mapped)
    assert.equal(out.report.unresolved[0].code, 'missing_hero_title')
    assert.deepEqual(out.document, doc)
  })

  test('existing identities are kept; a copied node is rejected until given a new id', ({
    assert,
  }) => {
    const first = service.mapLegacy(legacy(), 'ns').document as any
    const again = service.mapLegacy(first, 'different') as any
    assert.equal(
      canonicalJson(again.document.content.map((n: any) => n.attrs.nodeId)),
      canonicalJson(first.content.map((n: any) => n.attrs.nodeId))
    )
    const pasted = structuredClone(first)
    pasted.content.push(structuredClone(pasted.content[2]))
    assert.isNotEmpty(service.validate(pasted))
  })
})

test.group('Typed reverse edits', () => {
  const base = () => {
    const document = service.mapLegacy(legacy(), 'ns').document as any
    return {
      document,
      versionId: 'v1',
      identity: { versionId: 'v1', contentHash: sha256(canonicalJson(document)) },
    }
  }

  test('no-op edits return the same authoritative content', ({ assert }) => {
    const b = base()
    assert.equal(canonicalJson(service.applyEdits(b, b.identity, [])), canonicalJson(b.document))
  })

  test('title edit changes only the target text and keeps marks and identity', ({ assert }) => {
    const b = base()
    const next = service.applyEdits(b, b.identity, [
      { op: 'replace_text', target: 'hero.title', text: 'New title' },
    ]) as any
    assert.equal(next.content[0].content[0].text, 'New title')
    assert.equal(next.content[0].attrs.nodeId, b.document.content[0].attrs.nodeId)
    assert.deepEqual(stripIds(next.content.slice(1)), stripIds(b.document.content.slice(1)))
    assert.deepEqual(next.attrs.publication.hero, b.document.attrs.publication.hero)
  })

  test('stale identity or missing base is rejected with 409', ({ assert }) => {
    const b = base()
    for (const identity of [
      { ...b.identity, versionId: 'v0' },
      { ...b.identity, contentHash: sha256('other') },
      undefined as any,
    ])
      assert.throws(() => service.applyEdits(b, identity, []), /changed/)
    try {
      service.applyEdits(b, { ...b.identity, versionId: 'v0' }, [])
    } catch (error) {
      assert.equal((error as any).status, 409)
    }
  })

  test('invalid patches fail with exact fields and nothing is partially applied', ({ assert }) => {
    const b = base()
    const before = canonicalJson(b.document)
    try {
      service.applyEdits(b, b.identity, [
        { op: 'replace_text', target: 'hero.title', text: 'Fine' },
        { op: 'set_result', resultId: 'nope', qualifier: 'verified' },
        { op: 'remove_note', id: 'nope' },
      ])
      assert.fail('expected rejection')
    } catch (error) {
      assert.instanceOf(error, PublicationContentError)
      assert.deepEqual(
        (error as PublicationContentError).messages.map((m) => m.field),
        ['patches.1.resultId', 'patches.2.id']
      )
    }
    assert.equal(canonicalJson(b.document), before)
  })

  test('notes can be added and removed through the same adapter', ({ assert }) => {
    const b = base()
    const added = service.applyEdits(b, b.identity, [
      { op: 'put_note', message: 'Check figure 1' },
    ]) as any
    assert.equal(added.attrs.publication.reviewerNotes[0].message, 'Check figure 1')
    const id = added.attrs.publication.reviewerNotes[0].id
    const identity = { versionId: 'v2', contentHash: sha256(canonicalJson(added)) }
    const removed = service.applyEdits({ document: added, versionId: 'v2' }, identity, [
      { op: 'remove_note', id },
    ]) as any
    assert.notProperty(removed.attrs.publication, 'reviewerNotes')
  })
})
