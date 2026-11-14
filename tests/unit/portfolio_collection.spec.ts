import { test } from '@japa/runner'
import {
  buildManifest,
  collectionBudget,
  composeContents,
  companyStatistics,
  manifestHash,
  selectEntries,
  suggestDuplicates,
  type CollectionEntry,
} from '../../shared/layout/collection.ts'

const entry = (
  id: string,
  pages: number,
  extra: Partial<CollectionEntry> = {}
): CollectionEntry => ({
  entryId: id,
  revisionId: `${id}-r1`,
  title: `Entry ${id}`,
  category: 'Logistics',
  templateId: pages === 1 ? 'case_study_concise' : 'case_study_standard',
  templateVersion: 1,
  pages,
  evidenceKeys: [`ev-${id}`],
  ...extra,
})
const entries = (n: number, pages = 2) =>
  Array.from({ length: n }, (_, i) => entry(`e${i + 1}`, pages))
const wrapper = {
  about: 'HumbleBee AI builds document AI.',
  contact: { email: 'hello@example.com' },
}

test.group('Collection manifest (PRT-01)', () => {
  test('manifest pins revisions, order, grouping, template and brand versions', ({ assert }) => {
    const m = buildManifest({
      entries: entries(2),
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    assert.deepEqual(
      m.entries.map((e) => [e.entryId, e.revisionId, e.templateVersion]),
      [
        ['e1', 'e1-r1', 1],
        ['e2', 'e2-r1', 1],
      ]
    )
    assert.equal(m.brand.version, 1)
    assert.equal(m.version, 1)
  })

  test('manifest hash changes with order, revision, wrapper copy and brand; not key order', ({
    assert,
  }) => {
    const base = buildManifest({
      entries: entries(3),
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    const h = manifestHash(base)
    assert.match(h, /^[0-9a-f]{64}$/)
    const swapped = buildManifest({
      entries: [entries(3)[1], entries(3)[0], entries(3)[2]],
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    assert.notEqual(manifestHash(swapped), h)
    const revised = buildManifest({
      entries: [{ ...entries(3)[0], revisionId: 'e1-r2' }, ...entries(3).slice(1)],
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    assert.notEqual(manifestHash(revised), h)
    assert.notEqual(
      manifestHash(
        buildManifest({
          entries: entries(3),
          wrapper: { ...wrapper, about: 'New' },
          brand: { id: 'humblebee', version: 1 },
        })
      ),
      h
    )
    assert.notEqual(
      manifestHash(
        buildManifest({ entries: entries(3), wrapper, brand: { id: 'humblebee', version: 2 } })
      ),
      h
    )
    const reordered = {
      brand: base.brand,
      wrapper: base.wrapper,
      entries: base.entries,
      version: base.version,
    }
    assert.equal(manifestHash(reordered as never), h)
  })
})

test.group('Collection budget (PRT-02)', () => {
  test('shows the arithmetic: wrapper + entries against the target', ({ assert }) => {
    const m = buildManifest({
      entries: entries(10, 2),
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    const budget = collectionBudget(m, { target: 20 })
    // cover + about + contents + back cover = 4 wrapper pages.
    assert.equal(budget.wrapperPages, 4)
    assert.equal(budget.entryPages, 20)
    assert.equal(budget.total, 24)
    assert.isTrue(budget.over)
    assert.equal(budget.overBy, 4)
  })

  test('over-budget collections suggest fewer entries or concise presets', ({ assert }) => {
    const m = buildManifest({
      entries: entries(10, 2),
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    const budget = collectionBudget(m, { target: 20 })
    const kinds = budget.suggestions.map((s) => s.kind)
    assert.includeMembers(kinds, ['use_concise', 'remove_entries'])
    const concise = budget.suggestions.find((s) => s.kind === 'use_concise')!
    // Ten concise entries + wrapper = 14 pages, which fits.
    assert.equal(concise.resultingTotal, 14)
    assert.equal(budget.suggestions.find((s) => s.kind === 'remove_entries')!.count, 2)
  })

  test('selected-work target of 6-10 entries in 12-20 pages is reachable', ({ assert }) => {
    const m = buildManifest({
      entries: entries(8, 2),
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    const budget = collectionBudget(m, { target: 20 })
    assert.equal(budget.total, 20)
    assert.isFalse(budget.over)
  })

  test('contents pages grow with entry count and are included in the total', ({ assert }) => {
    const m = buildManifest({
      entries: entries(60, 1),
      wrapper,
      brand: { id: 'humblebee', version: 1 },
    })
    assert.isAbove(collectionBudget(m, {}).contentsPages, 1)
  })

  test('empty selection is a clear error, not an empty PDF', ({ assert }) => {
    const m = buildManifest({ entries: [], wrapper, brand: { id: 'humblebee', version: 1 } })
    assert.equal(collectionBudget(m, {}).error, 'empty_selection')
  })
})

test.group('Contents (PRT-01)', () => {
  test('page numbers come from actual composed page counts, grouped by category', ({ assert }) => {
    const list = [
      entry('a', 2, { category: 'Logistics' }),
      entry('b', 1, { category: 'Finance' }),
      entry('c', 2, { category: 'Logistics' }),
    ]
    const contents = composeContents(list)
    assert.isTrue(contents.converged)
    // Cover (1), about (2), contents (3), entries start on page 4.
    assert.deepEqual(
      contents.rows.map((r) => [r.entryId, r.page]),
      [
        ['a', 4],
        ['c', 6],
        ['b', 8],
      ]
    )
    assert.deepEqual(
      contents.groups.map((g) => g.category),
      ['Logistics', 'Finance']
    )
  })

  test('a change in entry length updates later page numbers', ({ assert }) => {
    const before = composeContents([entry('a', 1), entry('b', 1)])
    const after = composeContents([entry('a', 2), entry('b', 1)])
    assert.equal(before.rows[1].page, before.rows[0].page + 1)
    assert.equal(after.rows[1].page, after.rows[0].page + 2)
  })

  test('contents pagination converges when the contents itself needs more pages', ({ assert }) => {
    const many = Array.from({ length: 70 }, (_, i) => entry(`m${i}`, 1))
    const contents = composeContents(many)
    assert.isTrue(contents.converged)
    assert.isAbove(contents.contentsPages, 1)
    assert.equal(contents.rows[0].page, 3 + contents.contentsPages)
  })

  test('non-convergence is reported, never silently ignored', ({ assert }) => {
    const contents = composeContents(entries(3), { maxPasses: 0 })
    assert.isFalse(contents.converged)
  })

  test('deselected entries are omitted from output and contents', ({ assert }) => {
    const list = entries(3)
    const selected = selectEntries(list, { include: ['e1', 'e3'] })
    assert.deepEqual(
      selected.entries.map((e) => e.entryId),
      ['e1', 'e3']
    )
    assert.deepEqual(
      composeContents(selected.entries).rows.map((r) => r.entryId),
      ['e1', 'e3']
    )
  })
})

test.group('Selection and statistics (PRT-01/02)', () => {
  test('filter by category, reorder, and reject inaccessible ids', ({ assert }) => {
    const list = [
      entry('a', 2, { category: 'Logistics' }),
      entry('b', 2, { category: 'Finance' }),
      entry('c', 2),
    ]
    assert.deepEqual(
      selectEntries(list, { category: 'Logistics' }).entries.map((e) => e.entryId),
      ['a', 'c']
    )
    assert.deepEqual(
      selectEntries(list, { include: ['c', 'a'], order: ['c', 'a'] }).entries.map((e) => e.entryId),
      ['c', 'a']
    )
    const forged = selectEntries(list, { include: ['a', 'zzz'] })
    assert.deepEqual(forged.rejected, ['zzz'])
    assert.deepEqual(
      forged.entries.map((e) => e.entryId),
      ['a']
    )
  })

  test('company statistics count deduplicated evidence, not entries as delivered projects', ({
    assert,
  }) => {
    const list = [
      entry('a', 2, { evidenceKeys: ['ev-1', 'ev-2'] }),
      entry('b', 2, { evidenceKeys: ['ev-2', 'ev-3'] }),
      entry('c', 2, { evidenceKeys: [] }),
    ]
    const stats = companyStatistics(list)
    assert.equal(stats.entries, 3)
    assert.equal(stats.evidenceBackedSources, 3)
    assert.notProperty(stats, 'deliveredProjects')
  })

  test('duplicate suggestions carry a reason and never merge automatically', ({ assert }) => {
    const list = [
      entry('a', 2, { title: 'Customs clearance for CarrierCo', evidenceKeys: ['ev-1', 'ev-2'] }),
      entry('b', 2, { title: 'Customs Clearance — CarrierCo', evidenceKeys: ['ev-1', 'ev-2'] }),
      entry('c', 2, { title: 'Customs clearance for PortCo', evidenceKeys: ['ev-9'] }),
    ]
    const found = suggestDuplicates(list)
    assert.lengthOf(found, 1)
    assert.deepEqual(found[0].entryIds, ['a', 'b'])
    assert.isNotEmpty(found[0].reason)
    assert.deepEqual(found[0].choices, ['keep', 'group', 'exclude'])
    assert.lengthOf(list, 3)
  })
})
