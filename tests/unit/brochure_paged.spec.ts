import { test } from '@japa/runner'
import { toFlat, toPaged } from '../../shared/brochure/paged.ts'

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const flat = {
  type: 'doc',
  attrs: { publication: { schemaVersion: 1 } },
  content: [p('one'), { type: 'horizontalRule' }, p('two'), { type: 'horizontalRule' }, p('three')],
}

test.group('brochure paged editing', () => {
  test('a page break starts a new page and the metadata survives', ({ assert }) => {
    const paged = toPaged(flat)
    assert.lengthOf(paged.content!, 3)
    assert.deepEqual(paged.attrs, flat.attrs)
  })

  test('paging and flattening round-trips the stored form', ({ assert }) => {
    assert.deepEqual(toFlat(toPaged(flat)), flat)
  })

  test('an empty page keeps its break but adds no blank paragraph', ({ assert }) => {
    const paged = toPaged({ type: 'doc', content: [p('one'), { type: 'horizontalRule' }] })
    assert.lengthOf(paged.content!, 2)
    assert.deepEqual(toFlat(paged).content, [p('one'), { type: 'horizontalRule' }])
  })
})
