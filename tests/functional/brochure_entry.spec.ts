/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { account, reset } from '../helpers/workspaces.ts'
import Document from '#models/document'
import WorkspaceTask from '#models/workspace_task'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import OpenRouterService from '#services/open_router_service'
import CreationService from '#services/documents/creation_service'
import OutlineTemplateService from '#services/documents/outline_template_service'
import DocumentExportService from '#services/exports/document_export_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import BundleService from '#services/layout/bundle_service'
import CollectionService from '#services/layout/collection_service'
import { documentFromPages } from '../../shared/brochure/content.ts'
import {
  DESIGN_IDS,
  templateSelection,
  type BrochureSelection,
  type DesignId,
} from '../../shared/brochure/designs.ts'
import { samples } from '../fixtures/brochure/pages.ts'

type Provider = OpenRouterService['generateBrochure']
const base = {
  title: 'Customs',
  description: 'Brief',
  sourceMode: 'input_only' as const,
  templateId: 'brochure' as const,
}

/** A stand-in for the model: writes the sample page for each design it is given or picks. */
const model =
  (pick: DesignId[] = ['cover', 'offer', 'contact']): Provider =>
  async (_t, _b, _c, _o, _g, selection) => {
    const designs = selection.pages.map((page, index) =>
      page === 'auto' ? (pick[index] ?? 'article') : page
    ) as DesignId[]
    const chosen = selection.pages.length === 1 && selection.pages[0] === 'auto' ? pick : designs
    return {
      document: documentFromPages(chosen.map((id) => samples[id])).document as never,
      designs: chosen,
      notes: [],
    }
  }

test.group('Brochure entries', (group) => {
  group.each.setup(reset)
  const original = OpenRouterService.prototype.generateBrochure
  group.each.teardown(() => {
    OpenRouterService.prototype.generateBrochure = original
  })

  test('the brochure is a template like any other', async ({ assert }) => {
    const a = await account()
    const list = await new OutlineTemplateService().list(a.context)
    const brochure = list.find((template) => template.id === 'brochure')
    assert.isDefined(brochure)
    assert.equal(brochure!.definition.format, 'brochure_entry')
    assert.include(brochure!.definition.instructions, 'Never invent')
  })

  test('a full template pins its page designs, and the model writes exactly those pages', async ({
    assert,
  }) => {
    const a = await account()
    let received: BrochureSelection | undefined
    OpenRouterService.prototype.generateBrochure = async (...args: Parameters<Provider>) => {
      received = args[5]
      return model()(...args)
    }
    const selection = templateSelection('overview')!
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: selection },
      []
    )
    const layout = await new LayoutSelectionService().peek(a.context.workspaceId, doc.id)
    assert.deepEqual(layout.options.brochure, selection)

    await new TaskDispatchService().dispatch()
    assert.deepEqual(received, selection)
    await doc.refresh()
    assert.equal(doc.generationStatus, 'ready')
  })

  test('with no selection the model chooses every page, and its choice is saved as the model’s', async ({
    assert,
  }) => {
    const a = await account()
    let received: BrochureSelection | undefined
    OpenRouterService.prototype.generateBrochure = async (...args: Parameters<Provider>) => {
      received = args[5]
      return model(['cover', 'proof', 'glance', 'contact'])(...args)
    }
    const doc = await new CreationService().document(a.context, base, [])
    const pinned = await new LayoutSelectionService().peek(a.context.workspaceId, doc.id)
    assert.deepEqual(pinned.options.brochure, { source: 'ai', pages: ['auto'] })

    await new TaskDispatchService().dispatch()
    assert.deepEqual(received, { source: 'ai', pages: ['auto'] })
    const saved = await new LayoutSelectionService().peek(a.context.workspaceId, doc.id)
    assert.deepEqual(saved.options.brochure, {
      source: 'ai',
      pages: ['cover', 'proof', 'glance', 'contact'],
    })
  })

  test('a regeneration keeps the designs the model chose instead of choosing again', async ({
    assert,
  }) => {
    const a = await account()
    const seen: BrochureSelection[] = []
    OpenRouterService.prototype.generateBrochure = async (...args: Parameters<Provider>) => {
      seen.push(args[5])
      return model(['cover', 'offer', 'contact'])(...args)
    }
    const doc = await new CreationService().document(a.context, base, [])
    await new TaskDispatchService().dispatch()
    const { GenerationService } = {
      GenerationService: (await import('#services/documents/generation_service')).default,
    }
    await new GenerationService().request(
      a.context,
      doc.id,
      randomUUID(),
      (await doc.refresh(), doc.currentVersionId)
    )
    await new TaskDispatchService().dispatch()
    assert.lengthOf(seen, 2)
    assert.deepEqual(seen[1].pages, ['cover', 'offer', 'contact'])
  })

  test('a page left to the model is resolved while the author’s designs stay fixed', async ({
    assert,
  }) => {
    const a = await account()
    let received: BrochureSelection | undefined
    OpenRouterService.prototype.generateBrochure = async (...args: Parameters<Provider>) => {
      received = args[5]
      return model(['cover', 'insight', 'contact'])(...args)
    }
    const selection: BrochureSelection = { source: 'custom', pages: ['cover', 'auto', 'contact'] }
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: selection },
      []
    )
    await new TaskDispatchService().dispatch()
    assert.deepEqual(received, selection)
    const saved = await new LayoutSelectionService().peek(a.context.workspaceId, doc.id)
    assert.deepEqual(saved.options.brochure?.pages, ['cover', 'insight', 'contact'])
    assert.equal(saved.options.brochure?.source, 'custom')
  })

  test('the designs are pinned in the generation request', async ({ assert }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrochure = model()
    const selection = templateSelection('brief')!
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: selection },
      []
    )
    const task = await WorkspaceTask.query()
      .where({ documentId: doc.id, kind: 'generate' })
      .firstOrFail()
    assert.deepEqual((task.payload as { layoutBrochure?: unknown }).layoutBrochure, selection)
  })

  test('an invalid selection is refused and nothing is created', async ({ assert }) => {
    const a = await account()
    const count = async () =>
      (await Document.query().where('workspaceId', a.context.workspaceId)).length
    const before = await count()
    for (const brochure of [
      { source: 'custom', pages: [] },
      { source: 'custom', pages: ['script'] },
      { source: 'nope', pages: ['cover'] },
      { source: 'custom', pages: ['cover'], extra: true },
    ])
      await assert.rejects(() =>
        new CreationService().document(a.context, { ...base, brochure }, [])
      )
    assert.equal(await count(), before)
  })

  test('the saved brochure is drawn by the brochure renderer, one sheet per page design', async ({
    assert,
  }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrochure = model()
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: { source: 'custom', pages: ['cover', 'offer', 'contact'] } },
      []
    )
    await new TaskDispatchService().dispatch()
    const html = (await new DocumentExportService().preview(a.context, doc.id, 'html')) as string
    for (const id of ['cover', 'offer', 'contact']) assert.include(html, `sheet ${id}`)
    assert.equal((html.match(/class="sheet /g) ?? []).length, 3)
    assert.include(html, 'PREVIEW')
    const final = (await new DocumentExportService().preview(a.context, doc.id, 'html', {
      final: true,
    })) as string
    assert.notInclude(final, 'NOT APPROVED')
  })

  test('changing a page’s design changes how it is drawn, not what it says', async ({ assert }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrochure = model()
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: { source: 'custom', pages: ['cover', 'offer', 'contact'] } },
      []
    )
    await new TaskDispatchService().dispatch()
    const layouts = new LayoutSelectionService()
    const exporter = new DocumentExportService()
    const before = (await exporter.preview(a.context, doc.id, 'html')) as string
    const current = await layouts.peek(a.context.workspaceId, doc.id)
    await layouts.save(a.context, doc.id, {
      templateId: current.templateId,
      options: {
        imageMode: 'auto',
        brochure: { source: 'custom', pages: ['cover', 'columns', 'contact'] },
      },
      baseRevision: current.revision,
    })
    const after = (await exporter.preview(a.context, doc.id, 'html')) as string
    assert.include(before, 'sheet offer')
    assert.include(after, 'sheet columns')
    assert.notInclude(after, 'sheet offer')
    assert.include(after, 'What we offer')
  })

  test('a change of designs withdraws approval, because it is part of the approval bundle', async ({
    assert,
  }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrochure = model()
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: templateSelection('brief')! },
      []
    )
    await new TaskDispatchService().dispatch()
    await doc.refresh()
    const bundles = new BundleService()
    const before = await bundles.current(doc)
    assert.equal(before!.bundle.rendererVersion, 'brochure-1')
    const layouts = new LayoutSelectionService()
    const current = await layouts.peek(a.context.workspaceId, doc.id)
    await layouts.save(a.context, doc.id, {
      templateId: current.templateId,
      options: {
        imageMode: 'auto',
        brochure: { source: 'custom', pages: ['cover', 'insight', 'contact'] },
      },
      baseRevision: current.revision,
    })
    assert.notEqual((await bundles.current(doc))!.hash, before!.hash)
  })

  test('the report counts the sheets and warns when text is longer than a design holds', async ({
    assert,
  }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrochure = model()
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: { source: 'custom', pages: ['cover', 'offer', 'contact'] } },
      []
    )
    await new TaskDispatchService().dispatch()
    const report = await new DocumentExportService().layoutReport(a.context, doc.id)
    assert.equal(report?.pages, 3)
    assert.equal(report?.pageBudget, 3)
    assert.isTrue(report?.fits)
    assert.deepEqual(report?.findings, [])
  })

  test('a collection counts a brochure by its page designs', async ({ assert }) => {
    const a = await account()
    OpenRouterService.prototype.generateBrochure = model()
    const doc = await new CreationService().document(
      a.context,
      { ...base, brochure: templateSelection('overview')! },
      []
    )
    await new TaskDispatchService().dispatch()
    const collection = await new CollectionService().create(a.context, {
      name: 'C',
      entryIds: [doc.id],
      wrapper: {},
    })
    assert.equal(collection.manifest.entries[0].pages, 5)
  })

  test('every full template is a valid selection the model can be given', ({ assert }) => {
    for (const id of ['brochure', 'overview', 'capabilities', 'brief'])
      assert.isTrue(
        templateSelection(id)!.pages.every((page) => DESIGN_IDS.includes(page as DesignId))
      )
  })
})
