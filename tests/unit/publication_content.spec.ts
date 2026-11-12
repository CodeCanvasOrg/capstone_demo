import { test } from '@japa/runner'
import ContentService from '#services/documents/content_service'
import PublicationContentService, {
  deterministicId,
} from '#services/documents/publication_content_service'
import { flattenText, type PublicationDocument } from '../../shared/publication/content.ts'

const IMG = '11111111-1111-4111-8111-111111111111'
const t = (text: string) => ({ type: 'text', text })
const cite = (chunk: string) => ({ type: 'sourceCitation', attrs: { sourceChunkId: chunk } })

// The phrase holds an astral emoji, so UTF-16 offsets matter.
const PHRASE = 'Up to 30% 🚀 faster'
const legacy = (): PublicationDocument => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [t('Acme case study')] },
    { type: 'paragraph', content: [t('How Acme sped up.'), cite('chunk-a')] },
    { type: 'heading', attrs: { level: 2 }, content: [t('Results')] },
    {
      type: 'paragraph',
      content: [t(`Throughput rose ${PHRASE} (estimated).`), { type: 'hardBreak' }, t('Next.')],
    },
    { type: 'image', attrs: { documentImageId: IMG, alt: 'Chart' } },
  ],
})

const service = new PublicationContentService()
const mapped = () => structuredClone(service.mapLegacy(legacy(), 'ns').document)
const meta = (doc: PublicationDocument) => doc.attrs!.publication as any

/** Mapped document with one estimated result anchored to the emoji phrase. */
function annotated() {
  const doc = mapped()
  const node = doc.content[3]
  const flat = flattenText(node)
  const from = flat.indexOf(PHRASE)
  const claimId = deterministicId('claim')
  meta(doc).claims = [
    {
      id: claimId,
      state: 'active',
      text: service.anchor(doc, node.attrs!.nodeId as string, 0, flat.indexOf('\n')),
      authorship: 'unknown',
      evidenceRefIds: [meta(doc).references[0].id],
    },
  ]
  meta(doc).results = [
    {
      id: deterministicId('result'),
      state: 'active',
      claimId,
      value: service.anchor(doc, node.attrs!.nodeId as string, from, from + PHRASE.length),
      qualifier: 'estimated',
      comparison: 'up_to',
      units: '%',
    },
  ]
  return { doc, node }
}

test.group('Publication validation', () => {
  test('a mapped document is valid and optional arrays stay absent', ({ assert }) => {
    const doc = mapped()
    assert.deepEqual(service.validate(doc), [])
    for (const key of ['claims', 'results', 'reviewerNotes']) assert.notProperty(meta(doc), key)
  })

  test('unknown fields, versions and reserved types give exact field paths', ({ assert }) => {
    const doc = mapped()
    meta(doc).schemaVersion = 2
    meta(doc).surprise = true
    const fields = service.validate(doc).map((e) => e.field)
    assert.include(fields, 'content.attrs.publication.schemaVersion')
    const reserved = mapped()
    meta(reserved).docType = 'news'
    assert.equal(service.validate(reserved)[0].field, 'content.attrs.publication.docType')
  })

  test('unknown qualifier is rejected with the allowed labels', ({ assert }) => {
    const { doc } = annotated()
    meta(doc).results[0].qualifier = 'verified'
    const [error] = service.validate(doc)
    assert.equal(error.field, 'content.attrs.publication.results.0.qualifier')
    assert.include(error.message, 'client_reported')
  })

  test('duplicate and dangling identities are rejected', ({ assert }) => {
    const dup = mapped()
    dup.content[3].attrs!.nodeId = dup.content[1].attrs!.nodeId
    assert.isNotEmpty(service.validate(dup))
    const dangling = mapped()
    meta(dangling).sections[0].nodeIds.push(deterministicId('missing'))
    assert.isTrue(service.validate(dangling).some((e) => e.field.includes('sections.0.nodeIds')))
  })

  test('figure assets must match the image block and, when given, the actor’s resources', ({
    assert,
  }) => {
    const doc = mapped()
    assert.deepEqual(service.validate(doc, { assets: new Set([IMG]) }), [])
    assert.equal(
      service.validate(doc, { assets: new Set() })[0].field,
      'content.attrs.publication.figures.0.asset'
    )
    meta(doc).figures[0].asset.id = 'other'
    assert.equal(service.validate(doc)[0].field, 'content.attrs.publication.figures.0.asset')
    const chunks = mapped()
    assert.equal(
      service.validate(chunks, { chunks: new Set() })[0].field,
      'content.attrs.publication.references.0.chunkId'
    )
  })

  test('anchors bind UTF-16 ranges to the selected words', ({ assert }) => {
    const { doc, node } = annotated()
    assert.equal(PHRASE.length, 19)
    const ref = meta(doc).results[0].value
    assert.equal(flattenText(node).slice(ref.from, ref.to), PHRASE)
    assert.include(flattenText(node), '\n')
    assert.notInclude(flattenText(mapped().content[1]), 'chunk-a')
    assert.deepEqual(service.validate(doc), [])
  })
})

test.group('Reconciliation and derivation', () => {
  test('derive keeps the original phrase and qualifier; absent context stays absent', ({
    assert,
  }) => {
    const { doc } = annotated()
    const view = service.derive(doc, 'v1')
    assert.equal(view.hero.title.text, 'Acme case study')
    assert.deepEqual(view.results, [
      {
        id: meta(doc).results[0].id,
        claimId: meta(doc).results[0].claimId,
        value: PHRASE,
        qualifier: 'estimated',
        comparison: 'up_to',
        units: '%',
      },
    ])
  })

  test('measured results without evidence or context are flagged, never relabeled', ({
    assert,
  }) => {
    const { doc } = annotated()
    meta(doc).claims[0].evidenceRefIds = []
    meta(doc).results[0].qualifier = 'measured'
    const view = service.derive(doc, 'v1')
    assert.equal(view.results[0].qualifier, 'measured')
    assert.includeMembers(
      view.diagnostics.map((d) => d.code),
      ['measured_without_evidence', 'measured_without_context']
    )
  })

  test('edited words become needs_review; prose stays and stale rows are not structured', ({
    assert,
  }) => {
    const { doc, node } = annotated()
    node.content![0].text = 'Rewritten words.'
    assert.isNotEmpty(service.validate(doc)) // stale data is never accepted as active
    const accepted = service.accept(doc)
    assert.equal(meta(accepted).results[0].state, 'needs_review')
    assert.equal(meta(accepted).results[0].reason, 'text_changed')
    assert.equal(meta(accepted).claims[0].state, 'needs_review')
    assert.equal(accepted.content[3].content![0].text, 'Rewritten words.')
    assert.lengthOf(service.derive(accepted, 'v2').results, 0)
    assert.equal(service.needsReview(accepted), 2)
  })

  test('removed blocks demote annotations and prune section references', ({ assert }) => {
    const { doc } = annotated()
    const removed = doc.content.splice(3, 1)[0]
    const accepted = service.accept(doc)
    assert.equal(meta(accepted).claims[0].reason, 'node_removed')
    assert.equal(meta(accepted).results[0].state, 'needs_review')
    assert.notInclude(
      meta(accepted).sections.flatMap((s: any) => s.nodeIds),
      (removed as any).attrs.nodeId
    )
  })
})

test.group('Typed edits', () => {
  const identityOf = (doc: PublicationDocument) => ({
    sourceVersionId: 'v1',
    contentHash: service.contentHash(doc),
  })

  test('no-op edits return the same content', ({ assert }) => {
    const { doc } = annotated()
    assert.deepEqual(service.applyEdits(doc, identityOf(doc), []), doc)
  })

  test('title edit changes only the title text and keeps identity and citations', ({ assert }) => {
    const doc = mapped()
    const next = service.applyEdits(doc, identityOf(doc), [
      { type: 'replaceText', target: 'hero.title', text: 'New title' },
    ])
    assert.equal(next.content[0].content![0].text, 'New title')
    assert.equal(next.content[0].attrs!.nodeId, doc.content[0].attrs!.nodeId)
    assert.deepEqual(next.content.slice(1), doc.content.slice(1))
  })

  test('stale or missing identity is a 409', ({ assert }) => {
    const doc = mapped()
    for (const identity of [{ sourceVersionId: 'v1', contentHash: 'stale' }, undefined as any])
      try {
        service.applyEdits(doc, identity, [])
        assert.fail('expected rejection')
      } catch (error) {
        assert.equal((error as any).status, 409)
      }
  })

  test('invalid patches are 422 with exact fields and change nothing', ({ assert }) => {
    const doc = mapped()
    const before = JSON.stringify(doc)
    try {
      service.applyEdits(doc, identityOf(doc), [
        { type: 'replaceText', target: 'hero.title', text: 'Fine' },
        { type: 'setResultContext', resultId: 'nope', units: '%' },
      ])
      assert.fail('expected rejection')
    } catch (error) {
      assert.equal((error as any).code, 'E_PUBLICATION_CONTENT')
      assert.deepEqual(
        (error as any).messages.map((m: any) => m.field),
        ['patches.1.resultId']
      )
    }
    assert.equal(JSON.stringify(doc), before)
  })

  test('result qualifier edits are validated and notes stay private', ({ assert }) => {
    const { doc } = annotated()
    const bad = [
      {
        type: 'setResultContext' as const,
        resultId: meta(doc).results[0].id,
        qualifier: 'verified' as any,
      },
    ]
    assert.throws(() => service.applyEdits(doc, identityOf(doc), bad))
    const next = service.applyEdits(doc, identityOf(doc), [
      {
        type: 'setResultContext',
        resultId: meta(doc).results[0].id,
        qualifier: 'client_reported',
        period: 'Q3 2025',
      },
      { type: 'upsertNote', message: 'OUT02_PRIVATE_NOTE' },
    ])
    const view = service.derive(next, 'v2')
    assert.equal(view.results[0].qualifier, 'client_reported')
    assert.equal(view.results[0].period, 'Q3 2025')
    assert.equal(view.reviewerNotes[0].message, 'OUT02_PRIVATE_NOTE')
    assert.notInclude(
      JSON.stringify([view.hero, view.sections, view.results]),
      'OUT02_PRIVATE_NOTE'
    )
    const id = view.reviewerNotes[0].id
    const removed = service.applyEdits(next, identityOf(next), [{ type: 'removeNote', id }])
    assert.notProperty(meta(removed), 'reviewerNotes')
  })
})

test.group('ContentService survival', () => {
  test('normalize keeps block identities and annotations', ({ assert }) => {
    const { doc } = annotated()
    const out = new ContentService().normalize(JSON.parse(JSON.stringify(doc))) as any
    assert.deepEqual(out.attrs.publication, doc.attrs!.publication)
    assert.equal(out.content[0].attrs.nodeId, doc.content[0].attrs!.nodeId)
    assert.equal(out.content[4].attrs.nodeId, doc.content[4].attrs!.nodeId)
  })

  test('invalid metadata is a 422; stale edits reconcile; plain documents are untouched', ({
    assert,
  }) => {
    const bad = annotated().doc
    meta(bad).results[0].claimId = deterministicId('other')
    try {
      new ContentService().normalize(JSON.parse(JSON.stringify(bad)))
      assert.fail('expected rejection')
    } catch (error) {
      assert.equal((error as any).code, 'E_PUBLICATION_CONTENT')
    }
    const edited = annotated().doc
    edited.content[3].content![0].text = 'Changed.'
    const out = new ContentService().normalize(JSON.parse(JSON.stringify(edited))) as any
    assert.equal(out.attrs.publication.results[0].state, 'needs_review')
    assert.notProperty(new ContentService().normalize(legacy() as any) as any, 'attrs')
  })
})
