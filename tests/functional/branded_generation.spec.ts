/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import env from '#start/env'
import { account, reset } from '../helpers/workspaces.ts'
import Document from '#models/document'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import OpenRouterService from '#services/open_router_service'
import CreationService from '#services/documents/creation_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import { entrySchema, entryToDocument } from '../../shared/layout/entry.ts'
import { brandedEntry } from '../fixtures/layout/branded_entry.ts'

const result = () =>
  entryToDocument(entrySchema.parse(brandedEntry), { allowedChunkIds: new Set() })

test.group('Branded generation pipeline', (group) => {
  group.each.setup(reset)
  const original = OpenRouterService.prototype.generateBrandedEntry
  group.each.teardown(() => {
    OpenRouterService.prototype.generateBrandedEntry = original
    env.set('GENERATION_FORMAT', 'legacy')
  })

  test('the branded template routes generation to the structured entry call', async ({
    assert,
  }) => {
    const a = await account()
    let calls = 0
    OpenRouterService.prototype.generateBrandedEntry = async (_t, _b, _c, _o, guard) => {
      await guard?.()
      calls++
      return result() as never
    }
    const doc = await new CreationService().document(
      a.context,
      {
        title: 'Customs',
        description: 'Brief',
        sourceMode: 'input_only',
        templateId: 'case_study',
      },
      []
    )
    await new TaskDispatchService().dispatch()
    await doc.refresh()
    assert.equal(calls, 1)
    assert.equal(doc.generationStatus, 'ready')
    const [version] = await doc.related('documentVersions').query()
    assert.equal((version.content as any).content[0].content[0].text, brandedEntry.hero.headline)
  })

  test('results keep their evidence label and units in publication metadata', async ({
    assert,
  }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrandedEntry = async () => result() as never
    const doc = await new CreationService().document(
      a.context,
      {
        title: 'Customs',
        description: 'Brief',
        sourceMode: 'input_only',
        templateId: 'case_study',
      },
      []
    )
    await new TaskDispatchService().dispatch()
    await doc.refresh()
    const content: any = (await doc.related('documentVersions').query())[0].content
    const meta = content.attrs.publication
    assert.deepEqual(
      meta.results.map((r: any) => [r.qualifier, r.comparison, r.units]),
      [
        ['estimated', 'up_to', 'less time spent processing documents'],
        ['client_reported', undefined, 'reduction in transcription errors'],
        ['design_target', undefined, 'declarants supported by the MVP architecture'],
      ]
    )
    assert.include(meta.results[0].methodology, 'Estimates reported')
    assert.lengthOf(meta.claims, 3)
    assert.isTrue(meta.claims.every((c: any) => c.authorship === 'ai'))
  })

  test('reviewer notes are stored privately and never reach the client payload', async ({
    assert,
  }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrandedEntry = async () => result() as never
    const doc = await new CreationService().document(
      a.context,
      {
        title: 'Customs',
        description: 'Brief',
        sourceMode: 'input_only',
        templateId: 'case_study',
      },
      []
    )
    await new TaskDispatchService().dispatch()
    await doc.refresh()
    const content: any = (await doc.related('documentVersions').query())[0].content
    const notes = content.attrs.publication.reviewerNotes.map((n: any) => n.message)
    assert.include(notes.join(' '), 'Client name and deployment dates')
    const projection = new PublicationProjectionService().project(content)
    assert.notInclude(JSON.stringify(projection.client), 'Client name')
    assert.deepEqual(
      projection.client.results!.map((r) => r.qualifier),
      ['estimated', 'client_reported', 'design_target']
    )
    // Stat values are the anchored figures, not whole sentences.
    assert.deepEqual(
      projection.client.results!.map((r) => r.value),
      ['90%', '97%', '1,000']
    )
  })

  test('new documents default to the branded template unless GENERATION_FORMAT=legacy', async ({
    assert,
  }) => {
    const a = await account()
    env.set('GENERATION_FORMAT', 'branded')
    const branded = await new CreationService().document(
      a.context,
      { title: 'Default branded', description: 'Brief', sourceMode: 'input_only' },
      []
    )
    assert.equal((await Document.findOrFail(branded.id)).templateSetup.outline.id, 'case_study')
    env.set('GENERATION_FORMAT', 'legacy')
    const legacy = await new CreationService().document(
      a.context,
      { title: 'Default legacy', description: 'Brief', sourceMode: 'input_only' },
      []
    )
    assert.equal((await Document.findOrFail(legacy.id)).templateSetup.outline.id, 'portfolio')
  })

  test('an explicit template choice always wins over the default', async ({ assert }) => {
    const a = await account()
    env.set('GENERATION_FORMAT', 'branded')
    const doc = await new CreationService().document(
      a.context,
      {
        title: 'Technical',
        description: 'Brief',
        sourceMode: 'input_only',
        templateId: 'technical',
      },
      []
    )
    assert.equal((await Document.findOrFail(doc.id)).templateSetup.outline.id, 'technical')
  })
})
