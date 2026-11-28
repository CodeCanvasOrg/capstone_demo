/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import WorkspaceTask from '#models/workspace_task'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import CanvasService from '#services/canvas/canvas_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { templateSelection } from '../../shared/brochure/designs.ts'
import { reset } from '../helpers/workspaces.ts'
import { PENDING_TITLE } from '#services/documents/creation_service'
import { coverTitle } from '#services/canvas/generation/canvas_pipeline'
import { installAiDesignModel } from '../helpers/ai_design.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

type G = Awaited<ReturnType<typeof portfolioGeneratable>>

/** What the New case study form posts: the brief, one prepared source and the layout choices. */
const create = (client: any, g: G, body: object) =>
  client
    .post(`/workspaces/${g.a.workspace.id}/documents`)
    .loginAs(g.a.user)
    .withCsrfToken()
    .redirects(0)
    .json({
      title: 'Cooling the city',
      description: 'Our brief',
      sourceMode: 'files',
      files: [{ id: g.sources[0].file.id }],
      templateId: 'brochure',
      ...body,
    })

const page = (client: any, g: G, path: string) =>
  client
    .get(`/workspaces/${g.a.workspace.id}${path}`)
    .loginAs(g.a.user)
    .header('x-inertia', 'true')
    .header('x-inertia-version', 'tenancy-test')

const created = () => Document.findByOrFail('title', 'Cooling the city')

test.group('New case study: the portfolio layout', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installPortfolioModel> | undefined
  group.each.teardown(() => {
    model?.restore()
    model = undefined
    flagsOff()
  })

  test('"Use a template" creates a canvas-mode case study, lands on the canvas and generates the portfolio', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable(1)
    const canvas = { templateSet: 'portfolio', entries: 2, depth: 'detailed', images: false }
    const response = await create(client, g, {
      canvas,
      brochure: templateSelection('overview'),
    })
    response.assertStatus(302)
    const doc = await created()
    response.assertHeader('location', `/workspaces/${g.a.workspace.id}/documents/${doc.id}/canvas`)

    // Canvas mode, the options as sent, and no brochure pages pinned.
    const layout = await new LayoutSelectionService().peek(g.a.workspace.id, doc.id)
    assert.equal(await new CanvasService().mode(g.a.workspace.id, doc.id), 'canvas')
    assert.deepEqual(layout.options.canvas, { profile: 'informative', pages: 'auto', ...canvas })
    assert.isUndefined(layout.options.brochure)

    // The first generation is a canvas run with those options.
    const task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
    assert.equal(task.payload.target, 'canvas')
    assert.deepInclude(task.payload.canvas as object, canvas)
    const run = await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail()
    assert.equal(run.status, 'queued')
    assert.equal(run.depth, 'detailed')

    // The canvas page shows the run before there are any pages.
    const before = await page(client, g, `/documents/${doc.id}/canvas`)
    before.assertStatus(200)
    assert.equal(before.body().props.state.mode, 'canvas')
    assert.isNull(before.body().props.state.project)
    assert.equal(before.body().props.generation.run.status, 'queued')

    await new TaskDispatchService().dispatch()
    await doc.refresh()
    assert.equal(doc.generationStatus, 'ready')
    assert.isNotNull(doc.currentVersionId)
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    assert.equal(await CanvasGenerationRun.findOrFail(run.id).then((r) => r.status), 'ready')
    const after = await page(client, g, `/documents/${doc.id}/canvas`)
    assert.isNotNull(after.body().props.state.project)
    assert.equal(after.body().props.state.baseVersionId, doc.currentVersionId)
    assert.isDefined(saved.project)
    // A cover, two entries and their sources pages: what the options asked for.
    const pages = await CanvasGenerationPage.query().where('runId', run.id).orderBy('pageIndex')
    assert.deepEqual(
      pages.map((p) => p.designId),
      ['cover', 'entry', 'sources', 'entry', 'sources']
    )
  }).timeout(30_000)

  test('"Let AI choose" stores the AI options, lands on the canvas and saves an AI-designed canvas', async ({
    client,
    assert,
  }) => {
    const design = installAiDesignModel()
    const g = await portfolioGeneratable(1)
    const canvas = { templateSet: 'ai_design', entries: 3, depth: 'concise', images: true }
    const response = await create(client, g, { canvas })
    response.assertStatus(302)
    const doc = await created()
    response.assertHeader('location', `/workspaces/${g.a.workspace.id}/documents/${doc.id}/canvas`)
    const layout = await new LayoutSelectionService().peek(g.a.workspace.id, doc.id)
    assert.equal(await new CanvasService().mode(g.a.workspace.id, doc.id), 'canvas')
    assert.deepInclude(layout.options.canvas as object, canvas)
    assert.isUndefined(layout.options.brochure)
    const task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
    assert.equal(task.payload.target, 'canvas')
    assert.deepInclude(task.payload.canvas as object, canvas)
    assert.equal(
      await CanvasGenerationRun.query()
        .where('documentId', doc.id)
        .firstOrFail()
        .then((r) => r.status),
      'queued'
    )

    // With ai_design in the options schema, the canvas page opens on the queued run.
    const before = await page(client, g, `/documents/${doc.id}/canvas`)
    before.assertStatus(200)
    assert.equal(before.body().props.generation.run.status, 'queued')

    try {
      await new TaskDispatchService().dispatch()
    } finally {
      design.restore()
    }
    await doc.refresh()
    assert.equal(doc.generationStatus, 'ready')
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    assert.equal(saved.templateKey, 'ai_design')
  }).timeout(30_000)

  test('a case study created without a title is named after its generated cover', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 1 })
    const g = await portfolioGeneratable(1)
    const canvas = { templateSet: 'portfolio', entries: 1, depth: 'standard', images: false }
    const response = await create(client, g, { title: '', canvas })
    response.assertStatus(302)
    const doc = await Document.query().orderBy('createdAt', 'desc').firstOrFail()
    assert.equal(doc.title, PENDING_TITLE)
    assert.isTrue(doc.templateSetup?.generateTitle)

    await new TaskDispatchService().dispatch()
    await doc.refresh()
    assert.equal(doc.generationStatus, 'ready')
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    const expected = coverTitle(saved.project)
    assert.isString(expected)
    assert.equal(doc.title, expected)
    assert.notEqual(doc.title, PENDING_TITLE)
    assert.isUndefined(doc.templateSetup?.generateTitle)
    // The placeholder never reached the cover.
    assert.notInclude(JSON.stringify(saved.project), PENDING_TITLE)
  }).timeout(30_000)

  test('canvas options the portfolio does not offer are rejected, and nothing is created', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable(1)
    for (const canvas of [
      { templateSet: 'portfolio', entries: 9 },
      { templateSet: 'portfolio', depth: 'huge' },
      { templateSet: 7 },
    ])
      (await create(client, g, { canvas }).header('accept', 'application/json')).assertStatus(422)
    assert.equal((await Document.query().where('title', 'Cooling the city')).length, 0)
  })

  test('with canvas generation off, a template choice keeps the brochure behaviour', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable(1)
    flagsOff()
    const selection = templateSelection('overview')!
    const response = await create(client, g, {
      canvas: { templateSet: 'portfolio', entries: 'auto', depth: 'standard', images: true },
      brochure: selection,
    })
    response.assertStatus(302)
    const doc = await created()
    response.assertHeader('location', `/workspaces/${g.a.workspace.id}/documents/${doc.id}/edit`)
    const layout = await new LayoutSelectionService().peek(g.a.workspace.id, doc.id)
    assert.equal(await new CanvasService().mode(g.a.workspace.id, doc.id), 'flow')
    assert.deepEqual(layout.options.brochure, selection)
    assert.isUndefined(layout.options.canvas)
    const task = await WorkspaceTask.findOrFail(doc.generationTaskId!)
    assert.isUndefined(task.payload.target)
    assert.equal((await CanvasGenerationRun.query().where('documentId', doc.id)).length, 0)
  })

  test('with canvas generation off, "Let AI choose" has the model choose the brochure pages', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable(1)
    flagsOff()
    const response = await create(client, g, {
      canvas: { templateSet: 'ai_design', entries: 'auto', depth: 'standard', images: true },
    })
    response.assertStatus(302)
    const doc = await created()
    const layout = await new LayoutSelectionService().peek(g.a.workspace.id, doc.id)
    assert.deepEqual(layout.options.brochure, { source: 'ai', pages: ['auto'] })
    assert.isUndefined(layout.options.canvas)
  })

  test('a plain text document is unaffected: no template, no canvas', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable(1)
    const response = await create(client, g, { templateId: null })
    response.assertStatus(302)
    const doc = await created()
    response.assertHeader('location', `/workspaces/${g.a.workspace.id}/documents/${doc.id}/edit`)
    assert.equal(await new CanvasService().mode(g.a.workspace.id, doc.id), 'flow')
    assert.equal((await CanvasGenerationRun.query().where('documentId', doc.id)).length, 0)
  })

  test('the form gets the generation flag, and the thumbnails come from workspace routes', async ({
    client,
    assert,
  }) => {
    const g = await portfolioGeneratable(1)
    const on = await page(client, g, '/documents/create')
    assert.isTrue(on.body().props.canvasGeneration)
    const list = await page(client, g, '/canvas-templates').header('accept', 'application/json')
    list.assertStatus(200)
    assert.isArray(list.body().data)
    flagsOff()
    const off = await page(client, g, '/documents/create')
    assert.isFalse(off.body().props.canvasGeneration)
    ;(await page(client, g, '/canvas-templates').header('accept', 'application/json')).assertStatus(
      404
    )
  })
})
