import { test } from '@japa/runner'
import ContentService from '#services/documents/content_service'
import PublicationContentService, {
  canonicalJson,
  sha256,
  textRef,
  type PublicationIdentity,
} from '#services/documents/publication_content_service'
import { flattenText } from '../../shared/publication/content.ts'

const NS = 'doc-1:v1'
const IMG = '11111111-1111-4111-8111-111111111111'
const text = (t: string, marks?: unknown[]) => ({
  type: 'text',
  text: t,
  ...(marks ? { marks } : {}),
})
const cite = (chunk: string) => ({
  type: 'sourceCitation',
  attrs: { sourceChunkId: chunk, fileName: 'case.pdf' },
})

// "Up to 30% 🚀 faster" has an astral emoji, so UTF-16 offsets matter.
const PHRASE = 'Up to 30% 🚀 faster'
const legacy = () => ({
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('Acme case study')] },
    { type: 'paragraph', content: [text('How Acme sped up.'), cite('chunk-a')] },
    { type: 'paragraph', content: [text('Preamble.')] },
    { type: 'heading', attrs: { level: 2 }, content: [text('Results')] },
    {
      type: 'paragraph',
      content: [
        text(`Throughput rose ${PHRASE} (estimated).`, [{ type: 'bold' }]),
        { type: 'hardBreak' },
        text('Next.'),
        cite('chunk-a'),
        cite('chunk-b'),
      ],
    },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('One')] }] }],
    },
    { type: 'image', attrs: { documentImageId: IMG, alt: 'Chart', width: '100%' } },
    { type: 'horizontalRule' },
  ],
})

const service = new PublicationContentService()
const mapped = () => {
  const out = service.mapLegacy(legacy(), NS)
  if (!out.mapped) throw new Error('expected mapping')
  return out.document as any
}
const withMeta = (change: (meta: any, doc: any) => void) => {
  const doc = mapped()
  change(doc.attrs.publication, doc)
  return doc
}

test.group('PublicationContentService validation', () => {
  test('a mapped legacy document is valid and optional arrays stay absent', ({ assert }) => {
    const doc = mapped()
    assert.deepEqual(service.validate(doc), [])
    assert.notProperty(doc.attrs.publication, 'claims')
    assert.notProperty(doc.attrs.publication, 'results')
    assert.notProperty(doc.attrs.publication, 'reviewerNotes')
  })

  test('unknown fields, version and bad types give exact field paths', ({ assert }) => {
    const doc = withMeta((m) => {
      m.schemaVersion = 2
      m.surprise = true
    })
    const fields = service.validate(doc).map((e) => e.field)
    assert.include(fields, 'content.attrs.publication.schemaVersion')
    assert.include(fields, 'content.attrs.publication')
  })

  test('reserved but disabled document types are field errors', ({ assert }) => {
    const [error] = service.validate(withMeta((m) => (m.docType = 'news')))
    assert.equal(error.field, 'content.attrs.publication.docType')
  })

  test('duplicate and dangling identities are rejected', ({ assert }) => {
    const dup = mapped()
    dup.content[2].attrs.nodeId = dup.content[1].attrs.nodeId
    assert.isTrue(service.validate(dup).some((e) => e.field === 'content.content.2.attrs.nodeId'))
    const dangling = withMeta((m) =>
      m.sections[0].nodeIds.push('22222222-2222-4222-8222-222222222222')
    )
    assert.isTrue(
      service
        .validate(dangling)
        .some((e) => e.field.startsWith('content.attrs.publication.sections.0.nodeIds'))
    )
  })

  test('figure asset must match the image block and hero must point at a heading', ({ assert }) => {
    const bad = withMeta((m) => (m.figures[0].asset.id = 'other'))
    assert.equal(service.validate(bad)[0].field, 'content.attrs.publication.figures.0.asset.id')
    const hero = withMeta((m, d) => (m.hero.title.nodeId = d.content[2].attrs.nodeId))
    assert.equal(service.validate(hero)[0].field, 'content.attrs.publication.hero.title.nodeId')
  })

  test('errors are capped', ({ assert }) => {
    const doc = withMeta((m) => {
      m.references = Array.from({ length: 5 }, () => ({ id: 'x', chunkId: 'c' }))
      m.sections = Array.from({ length: 60 }, () => ({ id: 'bad', type: 'nope', nodeIds: [] }))
    })
    assert.isAtMost(service.validate(doc).length, 50)
  })

  test('text ranges use UTF-16 offsets and bind the selected words', ({ assert }) => {
    const doc = mapped()
    const para = doc.content[4]
    const flat = flattenText(para)
    const from = flat.indexOf(PHRASE)
    assert.equal(PHRASE.length, 19) // emoji is two code units
    const ref = textRef(para, from, from + PHRASE.length)
    assert.equal(ref.textHash, sha256(PHRASE))
    assert.equal(flat.slice(from, from + PHRASE.length), PHRASE)
    assert.include(flat, '\n') // hard break is a newline; citations contribute nothing
    assert.notInclude(flat, 'case.pdf')
  })
})

const annotated = () => {
  const doc = mapped()
  const para = doc.content[4]
  const flat = flattenText(para)
  const from = flat.indexOf(PHRASE)
  const value = textRef(para, from, from + PHRASE.length)
  const claimId = '33333333-3333-4333-8333-333333333333'
  const meta = doc.attrs.publication
  meta.claims = [
    {
      id: claimId,
      state: 'active',
      text: textRef(para, 0, flat.indexOf('\n')),
      authorship: 'unknown',
      evidenceRefIds: [meta.references[0].id],
    },
  ]
  meta.results = [
    {
      id: '44444444-4444-4444-8444-444444444444',
      state: 'active',
      claimId,
      value,
      qualifier: 'estimated',
      comparison: 'up_to',
      units: '%',
    },
  ]
  return { doc, para, from }
}

test.group('Results, staleness and derivation', () => {
  test('derive keeps the original phrase and qualifier, and absent context absent', ({
    assert,
  }) => {
    const { doc } = annotated()
    assert.deepEqual(service.validate(doc), [])
    const view = service.derive(doc, 'v1')
    const [result] = view.results
    assert.equal(result.value, PHRASE)
    assert.equal(result.qualifier, 'estimated')
    assert.equal(result.comparison, 'up_to')
    assert.notProperty(result, 'period')
    assert.notProperty(result, 'baseline')
    assert.equal(view.diagnostics[0].code, 'result_context_missing')
  })

  test('measured result without evidence is flagged, never relabeled', ({ assert }) => {
    const { doc } = annotated()
    doc.attrs.publication.claims[0].evidenceRefIds = []
    doc.attrs.publication.results[0].qualifier = 'measured'
    const view = service.derive(doc, 'v1')
    assert.equal(view.results[0].qualifier, 'measured')
    assert.include(
      view.diagnostics.map((d) => d.code),
      'result_missing_evidence'
    )
  })

  test('unknown qualifier is a field error with a clear message', ({ assert }) => {
    const { doc } = annotated()
    doc.attrs.publication.results[0].qualifier = 'verified'
    const [error] = service.validate(doc)
    assert.equal(error.field, 'content.attrs.publication.results.0.qualifier')
    assert.include(error.message, 'measured, estimated, client_reported, design_target')
  })

  test('editing annotated words makes them needs_review without touching prose', ({ assert }) => {
    const { doc, para } = annotated()
    para.content[0].text = 'Throughput rose substantially (estimated).'
    assert.isNotEmpty(service.validate(doc)) // explicit stale data is not silently accepted
    const next = service.reconcile(doc)
    const meta = next.attrs!.publication as any
    assert.equal(meta.results[0].state, 'needs_review')
    assert.equal(meta.results[0].reason, 'text_changed')
    assert.equal(meta.claims[0].state, 'needs_review')
    assert.deepEqual(service.validate(next), [])
    assert.equal(flattenText(para), flattenText(next.content[4] as any))
    const view = service.derive(next, 'v2')
    assert.lengthOf(view.results, 0) // stale rows are not structured results
    assert.include(
      view.diagnostics.map((d) => d.code),
      'needs_review'
    )
  })

  test('removed blocks demote annotations and are pruned from sections', ({ assert }) => {
    const { doc } = annotated()
    const removed = doc.content.splice(4, 1)[0]
    const next = service.reconcile(doc) as any
    assert.equal(next.attrs.publication.results[0].reason, 'node_removed')
    assert.notInclude(
      next.attrs.publication.sections.flatMap((s: any) => s.nodeIds),
      removed.attrs.nodeId
    )
    assert.deepEqual(service.validate(next), [])
  })

  test('reviewer notes never appear in rendered blocks and stay in the private envelope', ({
    assert,
  }) => {
    const base = annotated().doc
    const identity: PublicationIdentity = {
      versionId: 'v1',
      contentHash: sha256(canonicalJson(base)),
    }
    const edited = service.applyEdits({ document: base, versionId: 'v1' }, identity, [
      { op: 'put_note', message: 'OUT02_PRIVATE_NOTE' },
    ])
    const view = service.derive(edited, 'v2')
    assert.equal(view.reviewerNotes[0].message, 'OUT02_PRIVATE_NOTE')
    assert.notInclude(
      JSON.stringify([view.hero, view.sections, view.results, view.figures]),
      'OUT02_PRIVATE_NOTE'
    )
  })
})

test.group('ContentService survival', () => {
  test('normalize keeps node ids and annotations', ({ assert }) => {
    const doc = annotated().doc
    const out = new ContentService().normalize(JSON.parse(JSON.stringify(doc))) as any
    assert.deepEqual(out.attrs.publication, doc.attrs.publication)
    assert.equal(out.content[0].attrs.nodeId, doc.content[0].attrs.nodeId)
    assert.equal(out.content[6].attrs.nodeId, doc.content[6].attrs.nodeId)
  })

  test('normalize rejects invalid metadata with field errors and reconciles stale edits', ({
    assert,
  }) => {
    const bad = annotated().doc
    bad.attrs.publication.results[0].claimId = '55555555-5555-4555-8555-555555555555'
    try {
      new ContentService().normalize(JSON.parse(JSON.stringify(bad)))
      assert.fail('expected rejection')
    } catch (error) {
      assert.equal((error as any).code, 'E_PUBLICATION_CONTENT')
      assert.equal((error as any).messages[0].field, 'content.attrs.publication.results.0.claimId')
    }
    const edited = annotated().doc
    edited.content[4].content[0].text = 'Changed words.'
    const out = new ContentService().normalize(JSON.parse(JSON.stringify(edited))) as any
    assert.equal(out.attrs.publication.results[0].state, 'needs_review')
  })

  test('documents without annotations are unaffected', ({ assert }) => {
    const out = new ContentService().normalize(legacy() as any) as any
    assert.notProperty(out, 'attrs')
  })
})
