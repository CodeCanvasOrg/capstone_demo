import { test } from '@japa/runner'
import { ANCHOR_CHARS, REUSE_PENALTY, anchor, fuse } from '#services/canvas/generation/page_queries'

test.group('page queries', () => {
  test('the brief anchor is truncated and collapsed', ({ assert }) => {
    const long = `${'word '.repeat(200)}END`
    const text = anchor('Title', long)
    assert.isAtMost(text.length, 'Title. '.length + ANCHOR_CHARS)
    assert.notInclude(text, 'END')
    assert.equal(anchor(null, '  a \n b  '), 'a b')
    assert.equal(anchor('Only title', ''), 'Only title')
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
