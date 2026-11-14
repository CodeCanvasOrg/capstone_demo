/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { account, reset } from '../helpers/workspaces.ts'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import DocumentService from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import CollectionService from '#services/layout/collection_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'

const body = (title: string) => ({
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'A short summary.' }] },
  ],
})

async function entry(a: Awaited<ReturnType<typeof account>>, title: string) {
  const doc = await new DocumentService().create(a.context, { title, sourceMode: 'input_only' }, [])
  await new DocumentService().update(a.context, doc.id, {
    title,
    projectInformation: Object.fromEntries(INFORMATION_FIELDS.map((k) => [k, 'x'])),
    metadataRevision: 0,
  })
  const version = await new VersionService().save(a.context, doc.id, {
    content: body(title),
    baseVersionId: null,
    mutationId: randomUUID(),
  })
  return { doc, version }
}

test.group('Portfolio collections (PRT-01, PRT-02, PRT-04)', (group) => {
  group.each.setup(reset)
  const service = new CollectionService()
  const wrapper = {
    about: 'HumbleBee AI builds document AI.',
    contact: { email: 'hi@example.com' },
  }

  test('create pins each entry revision, template and brand version in a hashed manifest', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const collection = await service.create(a.context, {
      name: 'Selected work',
      entryIds: [two.doc.id, one.doc.id],
      wrapper,
    })
    assert.deepEqual(
      collection.manifest.entries.map((e: any) => [e.entryId, e.revisionId]),
      [
        [two.doc.id, two.version.id],
        [one.doc.id, one.version.id],
      ]
    )
    assert.match(collection.manifestHash, /^[0-9a-f]{64}$/)
    assert.equal(collection.manifest.brand.version, 1)
    assert.equal(collection.status, 'draft')
  })

  test('inaccessible or unknown entry ids reject the whole request', async ({ assert }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const mine = await entry(a, 'Mine')
    const theirs = await entry(b, 'Theirs')
    await assert.rejects(() =>
      service.create(a.context, { name: 'Leak', entryIds: [mine.doc.id, theirs.doc.id], wrapper })
    )
    await assert.rejects(() =>
      service.create(a.context, { name: 'Ghost', entryIds: [randomUUID()], wrapper })
    )
    assert.lengthOf(await service.list(a.context), 0)
  })

  test('an empty selection is rejected, not exported as an empty PDF', async ({ assert }) => {
    const a = await account()
    await assert.rejects(
      () => service.create(a.context, { name: 'Empty', entryIds: [], wrapper }),
      /select at least one/i
    )
  })

  test('budget shows wrapper pages, entry pages and the target arithmetic', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    await new LayoutSelectionService().save(a.context, one.doc.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    const two = await entry(a, 'Two')
    const collection = await service.create(a.context, {
      name: 'Budget',
      entryIds: [one.doc.id, two.doc.id],
      wrapper,
    })
    const budget = await service.budget(a.context, collection.id, { target: 6 })
    assert.equal(budget.entryPages, 3)
    assert.equal(budget.wrapperPages, 4)
    assert.equal(budget.total, 7)
    assert.isTrue(budget.over)
  })

  test('reordering and deselecting produce a new manifest hash and update contents', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const collection = await service.create(a.context, {
      name: 'C',
      entryIds: [one.doc.id, two.doc.id],
      wrapper,
    })
    const reordered = await service.update(a.context, collection.id, {
      entryIds: [two.doc.id, one.doc.id],
      baseHash: collection.manifestHash,
    })
    assert.notEqual(reordered.manifestHash, collection.manifestHash)
    const contents = await service.contents(a.context, collection.id)
    assert.deepEqual(
      contents.rows.map((r) => r.entryId),
      [two.doc.id, one.doc.id]
    )
    const reduced = await service.update(a.context, collection.id, {
      entryIds: [two.doc.id],
      baseHash: reordered.manifestHash,
    })
    assert.deepEqual(
      (await service.contents(a.context, collection.id)).rows.map((r) => r.entryId),
      [two.doc.id]
    )
    assert.notEqual(reduced.manifestHash, reordered.manifestHash)
  })

  test('updates with a stale hash conflict instead of overwriting', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'C',
      entryIds: [one.doc.id],
      wrapper,
    })
    await service.update(a.context, collection.id, {
      name: 'Renamed',
      baseHash: collection.manifestHash,
    })
    await assert.rejects(
      () =>
        service.update(a.context, collection.id, {
          name: 'Again',
          baseHash: collection.manifestHash,
        }),
      /changed|conflict/i
    )
  })

  test('collection approval is bound to the manifest hash; an edited entry makes it stale', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'C',
      entryIds: [one.doc.id],
      wrapper,
    })
    const approved = await service.approve(a.context, collection.id, collection.manifestHash)
    assert.equal(approved.status, 'approved')
    assert.equal((await service.state(a.context, collection.id)).approval, 'current')

    // A new saved revision of a pinned entry does not silently change the approved manifest,
    // but it is surfaced: the collection is stale until re-pinned and re-approved.
    await new VersionService().save(a.context, one.doc.id, {
      content: body('One, edited'),
      baseVersionId: one.version.id,
      mutationId: randomUUID(),
    })
    const state = await service.state(a.context, collection.id)
    assert.equal(state.approval, 'stale')
    assert.deepEqual(state.staleEntries, [one.doc.id])
    await assert.rejects(
      () => service.assertPublishable(a.context, collection.id),
      /stale|changed/i
    )
  })

  test('wrapper copy changes invalidate collection approval', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'C',
      entryIds: [one.doc.id],
      wrapper,
    })
    const approved = await service.approve(a.context, collection.id, collection.manifestHash)
    const changed = await service.update(a.context, collection.id, {
      wrapper: { ...wrapper, about: 'New about copy' },
      baseHash: approved.manifestHash,
    })
    assert.equal(changed.status, 'draft')
    assert.equal((await service.state(a.context, collection.id)).approval, 'none')
  })

  test('another workspace cannot read, approve or change a collection', async ({ assert }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'C',
      entryIds: [one.doc.id],
      wrapper,
    })
    await assert.rejects(() => service.budget(b.context, collection.id, {}))
    await assert.rejects(() => service.approve(b.context, collection.id, collection.manifestHash))
    await assert.rejects(() =>
      service.update(b.context, collection.id, { name: 'X', baseHash: collection.manifestHash })
    )
    assert.lengthOf(await service.list(b.context), 0)
    const rows = await db.from('portfolio_collections').count('* as n').first()
    assert.equal(Number(rows!.n), 1)
  })

  test('a revoked member cannot publish an approved collection', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'C',
      entryIds: [one.doc.id],
      wrapper,
    })
    await service.approve(a.context, collection.id, collection.manifestHash)
    await service.assertPublishable(a.context, collection.id)
    await db
      .from('workspace_memberships')
      .where({ id: a.context.membershipId })
      .update({ revoked_at: new Date() })
    await assert.rejects(() => service.assertPublishable(a.context, collection.id))
  })
})
