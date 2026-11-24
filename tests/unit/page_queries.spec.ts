import { test } from '@japa/runner'
import {
  ANCHOR_CHARS,
  REUSE_PENALTY,
  anchor,
  asSectionQueries,
  fuse,
  pageQueries,
} from '#services/canvas/generation/page_queries'
import type { PagePlan } from '../../shared/canvas/academic/content.ts'

const page = (title: string, questions: string[]): PagePlan => ({
  design: 'essay',
  title,
  purpose: `Establish ${title}.`,
  questions,
  keyTerms: [],
  wantsImage: false,
})

test.group('page queries', () => {
  test('a page queries its subject first, then each research question', ({ assert }) => {
    const [q] = pageQueries(
      [page('Heat islands', ['What is albedo?', ' Why trees? '])],
      'Cooling',
      'A brief.'
    )
    assert.lengthOf(q.queries, 3)
    assert.include(q.queries[0], 'Heat islands')
    assert.include(q.queries[0], 'Establish Heat islands.')
    assert.deepEqual(q.queries.slice(1), ['What is albedo?', 'Why trees?'])
    assert.equal(q.label, 'Heat islands')
  })

  test('each page has its own key and queries', ({ assert }) => {
    const queries = pageQueries(
      [page('A', ['a1?', 'a2?']), page('B', ['b1?', 'b2?'])],
      'T',
      'brief'
    )
    assert.deepEqual(
      queries.map((q) => q.key),
      ['0', '1']
    )
    assert.notDeepEqual(queries[0].queries, queries[1].queries)
  })

  test('the brief anchor is truncated and collapsed', ({ assert }) => {
    const long = `${'word '.repeat(200)}END`
    const text = anchor('Title', long)
    assert.isAtMost(text.length, 'Title. '.length + ANCHOR_CHARS)
    assert.notInclude(text, 'END')
    assert.equal(anchor(null, '  a \n b  '), 'a b')
    assert.equal(anchor('Only title', ''), 'Only title')
    const [q] = pageQueries([page('P', ['q1?', 'q2?'])], 'T', long)
    assert.notInclude(q.queries[0], 'END')
  })

  test('section queries join a page for the brochure-style views', ({ assert }) => {
    const [s] = asSectionQueries(pageQueries([page('P', ['q1?', 'q2?'])], 'T', 'b'))
    assert.equal(s.key, '0')
    assert.include(s.query, 'q2?')
  })
})

test.group('fusing retrieval results', () => {
  const ids = (list: { id: string }[]) => list.map((r) => r.id)

  test('a chunk near the top of several lists beats one that tops a single list', ({ assert }) => {
    const fused = fuse([
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [{ id: 'c' }, { id: 'b' }],
      [{ id: 'b' }],
    ])
    assert.equal(ids(fused)[0], 'b')
  })

  test('the page subject counts for a little more than a question', ({ assert }) => {
    const fused = fuse([[{ id: 'subject' }], [{ id: 'question' }]])
    assert.deepEqual(ids(fused), ['subject', 'question'])
  })

  test('a chunk an earlier page used is down-ranked by half', ({ assert }) => {
    const lists = [[{ id: 'a' }, { id: 'b' }]]
    assert.deepEqual(ids(fuse(lists)), ['a', 'b'])
    const used = fuse(lists, new Set(['a']))
    assert.deepEqual(ids(used), ['b', 'a'])
    const plain = fuse(lists)
    assert.closeTo(used.find((r) => r.id === 'a')!.score, plain[0].score * REUSE_PENALTY, 1e-12)
    assert.equal(used.find((r) => r.id === 'b')!.score, plain[1].score)
  })

  test('a heavily used chunk can still win when nothing else matches', ({ assert }) => {
    assert.deepEqual(ids(fuse([[{ id: 'only' }]], new Set(['only']))), ['only'])
  })

  test('ties break by id, so the order is stable', ({ assert }) => {
    assert.deepEqual(ids(fuse([[], [{ id: 'b' }], [{ id: 'a' }]])), ['a', 'b'])
    assert.deepEqual(ids(fuse([])), [])
  })
})
