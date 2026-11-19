/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { account, reset } from '../helpers/workspaces.ts'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import DocumentService from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import CollectionService from '#services/layout/collection_service'
import { entryStats } from '#services/layout/entry_stats'
import type { PortfolioDesign } from '../../shared/layout/portfolio.ts'

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
  await new VersionService().save(a.context, doc.id, {
    content: body(title),
    baseVersionId: null,
    mutationId: randomUUID(),
  })
  return doc
}

const kinds = (design?: PortfolioDesign) => design?.pages.map((page) => page.kind)

test.group('Portfolio design on a collection', (group) => {
  group.each.setup(reset)
  const service = new CollectionService()
  const wrapper = { about: 'HumbleBee AI builds document AI.' }

  test('a collection made without a design stays classic and has no design in its manifest', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'Classic',
      entryIds: [one.id],
      wrapper,
    })
    assert.isUndefined(collection.manifest.design)
    const plan = await service.pagePlan(a.context, collection.id)
    assert.deepEqual(
      plan.pages.map((page) => page.kind),
      ['cover', 'statement', 'contents', 'entry', 'contact']
    )
    assert.equal(plan.design.source, 'rules')
    assert.deepEqual(plan.findings, [])
  })

  test('choosing a preset stores the design the rules produce', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const collection = await service.create(a.context, {
      name: 'Brochure',
      entryIds: [one.id, two.id],
      wrapper,
      preset: 'brochure',
    })
    const design = collection.manifest.design
    assert.equal(design?.source, 'preset')
    assert.equal(design?.preset, 'brochure')
    assert.deepEqual(kinds(design), ['cover', 'statement', 'contents', 'entry', 'entry', 'contact'])
  })

  test('a custom design is stored, validated and changes the approval hash', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const base = await service.create(a.context, {
      name: 'Custom',
      entryIds: [one.id, two.id],
      wrapper,
      preset: 'compact',
    })
    const design: PortfolioDesign = {
      source: 'custom',
      pages: [
        { id: 'cover', kind: 'cover', variant: 'ribbons', subtitle: 'Selected 2026' },
        { id: 'sec', kind: 'section', variant: 'bold', title: 'Highlights' },
        { id: `entry-${two.id}`, kind: 'entry', entryId: two.id },
        { id: `entry-${one.id}`, kind: 'entry', entryId: one.id },
        { id: 'contact', kind: 'contact', variant: 'dark', text: 'Talk to us' },
      ],
    }
    const next = await service.update(a.context, base.id, { design, baseHash: base.manifestHash })
    assert.notEqual(next.manifestHash, base.manifestHash)
    assert.equal(next.manifest.design?.source, 'custom')
    assert.deepEqual(
      next.manifest.design?.pages.flatMap((p) => (p.kind === 'entry' ? [p.entryId] : [])),
      [two.id, one.id]
    )
  })

  test('a design that leaves out or invents a case study is rejected', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const missing: PortfolioDesign = {
      source: 'custom',
      pages: [
        { id: 'cover', kind: 'cover', variant: 'plain' },
        { id: `entry-${one.id}`, kind: 'entry', entryId: one.id },
      ],
    }
    await assert.rejects(
      () =>
        service.create(a.context, {
          name: 'Missing',
          entryIds: [one.id, two.id],
          wrapper,
          design: missing,
        }),
      /has no page/i
    )
    const invented = {
      source: 'custom',
      pages: [{ id: 'entry-x', kind: 'entry', entryId: randomUUID() }],
    }
    await assert.rejects(() =>
      service.create(a.context, { name: 'Ghost', entryIds: [one.id], wrapper, design: invented })
    )
    assert.lengthOf(await service.list(a.context), 0)
  })

  test('unknown fields, kinds and variants never reach the stored manifest', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    for (const design of [
      { source: 'custom', pages: [{ id: 'x', kind: 'script', entryId: one.id }] },
      {
        source: 'custom',
        extra: true,
        pages: [{ id: `entry-${one.id}`, kind: 'entry', entryId: one.id }],
      },
      {
        source: 'custom',
        pages: [
          { id: 'cover', kind: 'cover', variant: 'neon' },
          { id: `entry-${one.id}`, kind: 'entry', entryId: one.id },
        ],
      },
    ])
      await assert.rejects(() =>
        service.create(a.context, { name: 'Bad', entryIds: [one.id], wrapper, design })
      )
    assert.lengthOf(await service.list(a.context), 0)
  })

  test('a preset-sourced design is rebuilt from the rules, so pages cannot be smuggled in', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'Smuggle',
      entryIds: [one.id],
      wrapper: {},
      design: {
        source: 'preset',
        preset: 'compact',
        pages: [
          { id: 'cover', kind: 'cover', variant: 'ribbons', subtitle: 'Not from the rules' },
          { id: `entry-${one.id}`, kind: 'entry', entryId: one.id },
          { id: 'contact', kind: 'contact', variant: 'dark' },
        ],
      },
    })
    const cover = collection.manifest.design!.pages[0]
    assert.equal(cover.kind === 'cover' && cover.variant, 'plain')
    assert.isUndefined((cover as { subtitle?: string }).subtitle)
  })

  test('changing the design withdraws a collection approval', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'Approve',
      entryIds: [one.id],
      wrapper,
      preset: 'showcase',
    })
    const approved = await service.approve(a.context, collection.id, collection.manifestHash)
    assert.equal((await service.state(a.context, approved.id)).approval, 'current')
    const changed = await service.update(a.context, approved.id, {
      preset: 'compact',
      baseHash: approved.manifestHash,
    })
    assert.equal(changed.status, 'draft')
    assert.equal((await service.state(a.context, changed.id)).approval, 'none')
  })

  test('adding and removing case studies keeps a preset design in step', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const collection = await service.create(a.context, {
      name: 'Grow',
      entryIds: [one.id],
      wrapper,
      preset: 'showcase',
    })
    const grown = await service.update(a.context, collection.id, {
      entryIds: [one.id, two.id],
      baseHash: collection.manifestHash,
    })
    assert.equal(grown.manifest.design!.pages.filter((p) => p.kind === 'entry').length, 2)
    const shrunk = await service.update(a.context, collection.id, {
      entryIds: [two.id],
      baseHash: grown.manifestHash,
    })
    assert.deepEqual(
      shrunk.manifest.design!.pages.flatMap((p) => (p.kind === 'entry' ? [p.entryId] : [])),
      [two.id]
    )
  })

  test('removing the introduction text is refused while a custom design still shows it', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const collection = await service.create(a.context, {
      name: 'Intro',
      entryIds: [one.id],
      wrapper,
      design: {
        source: 'custom',
        pages: [
          { id: 'statement', kind: 'statement', variant: 'plain' },
          { id: `entry-${one.id}`, kind: 'entry', entryId: one.id },
        ],
      },
    })
    await assert.rejects(
      () =>
        service.update(a.context, collection.id, {
          wrapper: {},
          baseHash: collection.manifestHash,
        }),
      /introduction page has no text/i
    )
  })

  test('arranging returns a proposal and saves nothing', async ({ assert }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const collection = await service.create(a.context, {
      name: 'Propose',
      entryIds: [one.id, two.id],
      wrapper,
      preset: 'compact',
    })
    const proposal = await service.arrange(a.context, collection.id, {
      ask: async () => ({
        rationale: 'Short and direct.',
        pages: [
          { kind: 'cover', variant: 'ribbons' },
          { kind: 'entry', entryId: two.id },
          { kind: 'entry', entryId: one.id },
          { kind: 'contact', variant: 'dark' },
        ],
      }),
    })
    assert.equal(proposal.source, 'ai')
    assert.equal(proposal.notes, 'Short and direct.')
    assert.deepEqual(
      proposal.pages.map((page) => page.kind),
      ['cover', 'entry', 'entry', 'contact']
    )
    const after = await service.get(a.context, collection.id)
    assert.equal(after.manifestHash, collection.manifestHash)
    assert.equal(after.manifest.design?.preset, 'compact')
  })

  test('a proposal can be applied through the same update path as a hand-made design', async ({
    assert,
  }) => {
    const a = await account()
    const one = await entry(a, 'One')
    const two = await entry(a, 'Two')
    const collection = await service.create(a.context, {
      name: 'Apply',
      entryIds: [one.id, two.id],
      wrapper,
      preset: 'showcase',
    })
    const proposal = await service.arrange(a.context, collection.id, {
      ask: async () => ({
        rationale: 'x',
        pages: [
          { kind: 'cover' },
          { kind: 'entry', entryId: two.id },
          { kind: 'entry', entryId: one.id },
          { kind: 'contact' },
        ],
      }),
    })
    const applied = await service.update(a.context, collection.id, {
      design: proposal.design,
      baseHash: collection.manifestHash,
    })
    assert.equal(applied.manifest.design?.source, 'ai')
    assert.equal((await service.contents(a.context, collection.id)).rows[0].entryId, two.id)
  })

  test('entry figures are empty for content without results, never invented', async ({
    assert,
  }) => {
    assert.deepEqual(entryStats(body('Plain')), [])
    assert.deepEqual(entryStats(null), [])
    assert.deepEqual(entryStats({ type: 'doc', content: [{ type: 'nonsense' }] }), [])
  })
})
