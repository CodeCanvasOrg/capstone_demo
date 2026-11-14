import { test } from '@japa/runner'
import {
  renumberFootnotes,
  reorderSections,
  validateFootnotes,
} from '../../shared/layout/footnotes.ts'
import type { ClientRenderData } from '../../shared/publication/client.ts'
import * as fx from '../fixtures/layout/entries.ts'

/** Reference numbers in reading order: summary first, then body. */
const refsIn = (data: ClientRenderData) =>
  [...JSON.stringify([data.summary ?? null, data.body]).matchAll(/"number":(\d+)/g)].map((m) =>
    Number(m[1])
  )

test.group('Footnotes (OUT-04)', () => {
  test('a valid entry has no dangling references and no uncited sources', ({ assert }) => {
    assert.isEmpty(validateFootnotes(fx.entry01))
  })

  test('detects dangling references and uncited sources', ({ assert }) => {
    const dangling = { ...fx.entry01, sources: fx.entry01.sources.slice(0, 2) }
    assert.deepInclude(validateFootnotes(dangling), { code: 'dangling_reference', number: 3 })
    const extra = {
      ...fx.entry01,
      sources: [...fx.entry01.sources, { number: 4, label: 'Unused' }],
    }
    assert.deepInclude(validateFootnotes(extra), { code: 'uncited_source', number: 4 })
  })

  test('numbers follow reading order and every reference still resolves after reordering', ({
    assert,
  }) => {
    const reordered = reorderSections(fx.entry01, [2, 0, 1])
    const out = renumberFootnotes(reordered)
    assert.isEmpty(validateFootnotes(out))
    // First cited source in reading order is now 1, and so on.
    assert.deepEqual([...new Set(refsIn(out))], [1, 2, 3])
    // Source identity (label + page) follows its claim, not its old number.
    const labelFor = (data: ClientRenderData, n: number) =>
      data.sources.find((s) => s.number === n)!.label
    const firstRef = refsIn(out)[0]
    const original = refsIn(reordered)[0]
    assert.equal(labelFor(out, firstRef), labelFor(reordered, original))
  })

  test('renumbering is deterministic and idempotent', ({ assert }) => {
    const once = renumberFootnotes(reorderSections(fx.entry01, [1, 2, 0]))
    assert.deepEqual(renumberFootnotes(once), once)
  })

  test('repeated citations of one source deduplicate to one footnote', ({ assert }) => {
    const out = renumberFootnotes({
      ...fx.entry01,
      sources: [...fx.entry01.sources, { number: 4, label: 'Customs brief', page: 2 }],
      body: [...fx.entry01.body, fx.p('Again.', 4)],
    })
    assert.lengthOf(out.sources, 3)
    assert.isEmpty(validateFootnotes(out))
  })

  test('different pages of one file stay separate footnotes', ({ assert }) => {
    const out = renumberFootnotes({
      ...fx.entry01,
      sources: [
        { number: 1, label: 'Customs brief', page: 2 },
        { number: 2, label: 'Customs brief', page: 9 },
        { number: 3, label: 'Delivery report', page: 7 },
      ],
    })
    assert.lengthOf(out.sources, 3)
  })

  test('missing URLs stay missing; no URL is invented for a source', ({ assert }) => {
    const out = renumberFootnotes(fx.entry01)
    for (const source of out.sources) assert.notProperty(source, 'url')
  })

  test('uncited sources are dropped from the displayed block, never silently renumbered into use', ({
    assert,
  }) => {
    const out = renumberFootnotes({
      ...fx.entry01,
      sources: [...fx.entry01.sources, { number: 4, label: 'Unused' }],
    })
    assert.lengthOf(out.sources, 3)
    assert.notInclude(
      out.sources.map((s) => s.label),
      'Unused'
    )
  })

  test('summary and results references are numbered before body references', ({ assert }) => {
    const out = renumberFootnotes(fx.entry01)
    // The summary cites the "Customs brief", which must therefore be footnote 1.
    assert.equal(out.sources[0].label, 'Customs brief')
  })

  test('collection assembly keeps each entry numbering independent and resolvable', ({
    assert,
  }) => {
    const a = renumberFootnotes(fx.entry01)
    const b = renumberFootnotes(reorderSections(fx.noImage, [1, 0, 2]))
    for (const entry of [a, b]) assert.isEmpty(validateFootnotes(entry))
    assert.equal(a.sources[0].number, 1)
    assert.equal(b.sources[0].number, 1)
  })
})
