import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import { canonicalJson, hashOf, sha256 } from '../../shared/layout/hash.ts'

test.group('Browser-safe hashing', () => {
  test('sha256 matches node:crypto across block boundaries and unicode', ({ assert }) => {
    for (const input of [
      '',
      'abc',
      'a'.repeat(55),
      'a'.repeat(56),
      'a'.repeat(63),
      'a'.repeat(64),
      'a'.repeat(65),
      'x'.repeat(1000),
      'Ünïcödé ✓ 日本語 🐝',
    ])
      assert.equal(
        sha256(input),
        createHash('sha256').update(input).digest('hex'),
        input.slice(0, 12)
      )
  })

  test('canonical JSON ignores key order and undefined values but not array order', ({
    assert,
  }) => {
    assert.equal(canonicalJson({ b: 1, a: [1, 2], c: undefined }), '{"a":[1,2],"b":1}')
    assert.equal(hashOf({ a: 1, b: 2 }), hashOf({ b: 2, a: 1 }))
    assert.notEqual(hashOf([1, 2]), hashOf([2, 1]))
  })
})
