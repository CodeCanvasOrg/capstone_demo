import { test } from '@japa/runner'
import {
  ENTRY_LIMITS,
  entrySchema,
  entryToDocument,
  validateEntry,
} from '../../shared/layout/entry.ts'
import { brandedEntry } from '../fixtures/layout/branded_entry.ts'

const clone = () => structuredClone(brandedEntry)
const allowed = new Set(['chunk-a', 'chunk-b'])
const codes = (entry: ReturnType<typeof clone>) =>
  validateEntry(entrySchema.parse(entry)).map((problem) => problem.code)
const text = (node: any): string => node.text ?? (node.content ?? []).map(text).join('')

test.group('Branded entry schema (feedback §07)', () => {
  test('the mockup entry parses and has no validation problems', ({ assert }) => {
    assert.deepEqual(codes(clone()), [])
  })

  test('hero limits are 60 / 160 characters', ({ assert }) => {
    assert.equal(ENTRY_LIMITS.headline, 60)
    assert.equal(ENTRY_LIMITS.subhead, 160)
    const long = clone()
    long.hero.headline = 'x'.repeat(61)
    assert.isFalse(entrySchema.safeParse(long).success)
    const longSub = clone()
    longSub.hero.subhead = 'x'.repeat(161)
    assert.isFalse(entrySchema.safeParse(longSub).success)
  })

  test('evidence is one of measured, estimated, client_reported, design_target', ({ assert }) => {
    const bad = clone()
    ;(bad.results[0] as any).evidence = 'verified'
    assert.isFalse(entrySchema.safeParse(bad).success)
  })

  test('at most four results, three capabilities and five steps', ({ assert }) => {
    const many = clone()
    many.results = Array.from({ length: 5 }, () => many.results[0])
    assert.isFalse(entrySchema.safeParse(many).success)
    const caps = clone()
    caps.capabilities = Array.from({ length: 4 }, () => caps.capabilities[0])
    assert.isFalse(entrySchema.safeParse(caps).success)
    const steps = clone()
    steps.steps = Array.from({ length: 6 }, () => steps.steps[0])
    assert.isFalse(entrySchema.safeParse(steps).success)
  })

  test('the challenge is at most three sentences', ({ assert }) => {
    const entry = clone()
    entry.challenge.text = 'One. Two. Three. Four.'
    assert.include(codes(entry), 'too_many_sentences')
  })

  test('copy never talks about the source, the case study or the input', ({ assert }) => {
    for (const phrase of [
      'The source does not provide the client name.',
      'The case study does not report a baseline.',
      'This was not specified in the documents.',
    ]) {
      const entry = clone()
      entry.solution.text = phrase
      assert.include(codes(entry), 'copy_commentary', phrase)
    }
    const fine = clone()
    fine.solution.text = 'An open source toolkit runs on the data source the client already had.'
    assert.notInclude(codes(fine), 'copy_commentary')
  })

  test('copy never contains chunk or evidence identifiers', ({ assert }) => {
    const entry = clone()
    entry.hero.subhead = 'See case-study.pdf chunk 10 page 2 for details.'
    assert.include(codes(entry), 'copy_identifier')
    const uuid = clone()
    uuid.challenge.text = 'Evidence 3f2b8c1e-9d4a-4e6b-8a7c-5d1e2f3a4b5c shows this.'
    assert.include(codes(uuid), 'copy_identifier')
  })

  test('a result value carries the figure only; "up to" belongs in comparison', ({ assert }) => {
    const entry = clone()
    entry.results[0].value = 'Up to 90%'
    assert.include(codes(entry), 'qualifier_in_value')
  })

  test('a stat value is a figure, not a phrase; with no figure there is no result', ({
    assert,
  }) => {
    for (const value of ['Fewer pixels', '30-second', 'Faster', 'Stable']) {
      const entry = clone()
      entry.results[0].value = value
      assert.include(codes(entry), 'non_numeric_value', value)
    }
    const none = clone()
    none.results = []
    assert.notInclude(codes(none), 'non_numeric_value')
  })

  test('footnote ids must exist', ({ assert }) => {
    const entry = clone()
    entry.challenge.footnote_ids = [9]
    assert.include(codes(entry), 'unknown_footnote')
  })

  test('missing information is an empty field plus a reviewer note, not a sentence', ({
    assert,
  }) => {
    const entry = clone()
    entry.roadmap = ''
    entry.results = []
    entry.reviewer_notes = ['Roadmap and measured results are not in the material.']
    assert.deepEqual(codes(entry), [])
  })
})

test.group('Entry to editable document', () => {
  const build = (entry = clone()) =>
    entryToDocument(entrySchema.parse(entry), { allowedChunkIds: allowed })

  test('creates ordinary TipTap blocks in the fixed section order', ({ assert }) => {
    const { document } = build()
    const shape = document.content.map((node: any) =>
      node.type === 'heading' ? `h${node.attrs.level}:${text(node)}` : node.type
    )
    assert.deepEqual(shape, [
      'h1:Automating customs documentation with local AI',
      'paragraph',
      'h2:Key results',
      'paragraph',
      'paragraph',
      'paragraph',
      'h2:The challenge',
      'paragraph',
      'h2:The solution',
      'paragraph',
      'h2:How it works',
      'orderedList',
      'h2:Key capabilities',
      'bulletList',
      'h2:Roadmap',
      'paragraph',
    ])
  })

  test('empty sections are omitted entirely', ({ assert }) => {
    const entry = clone()
    entry.results = []
    entry.roadmap = ''
    entry.steps = []
    const { document } = build(entry)
    const headings = document.content.filter((n: any) => n.type === 'heading').map(text)
    assert.notIncludeMembers(headings, ['Key results'])
    assert.notInclude(headings, 'Roadmap')
    assert.notInclude(headings, 'How it works')
  })

  test('result paragraphs read "value — label" and the sidecar anchors the value', ({ assert }) => {
    const { document, sidecar } = build()
    const first = sidecar.results[0]
    const node: any = document.content[first.index]
    assert.equal(text(node), '90% — less time spent processing documents')
    assert.equal(first.valueLength, '90%'.length)
    assert.equal(first.qualifier, 'estimated')
    assert.equal(first.comparison, 'up_to')
    assert.equal(first.units, 'less time spent processing documents')
    assert.include(first.methodology, 'Estimates reported')
  })

  test('footnote chunks become source citations after the text', ({ assert }) => {
    const { document } = build()
    const challenge: any =
      document.content[document.content.findIndex((n: any) => text(n) === 'The challenge') + 1]
    const last = challenge.content.at(-1)
    assert.equal(last.type, 'sourceCitation')
    assert.equal(last.attrs.sourceChunkId, 'chunk-a')
  })

  test('chunk ids that were never supplied are dropped and noted privately', ({ assert }) => {
    const entry = clone()
    entry.footnotes[0].chunks = ['chunk-a', 'invented-id']
    const { document, sidecar } = build(entry)
    assert.notInclude(JSON.stringify(document), 'invented-id')
    assert.isTrue(sidecar.notes.some((note) => /unavailable source/i.test(note)))
  })

  test('reviewer notes live in the sidecar only, never in the document', ({ assert }) => {
    const { document, sidecar } = build()
    assert.include(sidecar.notes.join(' '), 'Client name')
    assert.notInclude(JSON.stringify(document), 'Client name')
  })

  test('a non-case-study type is kept as a case study with a private note', ({ assert }) => {
    const entry = clone()
    entry.doc_type = 'research'
    const { sidecar } = build(entry)
    assert.isTrue(sidecar.notes.some((note) => /research/i.test(note) && /no template/i.test(note)))
  })

  test('steps and capabilities are editable list items "Title — text"', ({ assert }) => {
    const { document } = build()
    const list: any = document.content.find((n: any) => n.type === 'orderedList')
    assert.equal(list.content.length, 4)
    assert.equal(text(list.content[0]), 'Upload — Invoice, packing list or ID as image or PDF.')
  })
})
