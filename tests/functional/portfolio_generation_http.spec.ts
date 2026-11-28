/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import WorkspaceTask from '#models/workspace_task'
import CanvasService from '#services/canvas/canvas_service'
import RetrievalService from '#services/documents/retrieval_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { hashOf } from '../../shared/layout/hash.ts'
import { account, reset } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

type G = Awaited<ReturnType<typeof portfolioGeneratable>>
const base = (g: G) => `/workspaces/${g.a.workspace.id}/documents/${g.a.document.id}/canvas`
const post = (client: any, g: G, path: string, body: object, user = g.a.user) =>
  client
    .post(`${base(g)}${path}`)
    .json(body)
    .header('accept', 'application/json')
    .withCsrfToken()
    .loginAs(user)
const status = (client: any, g: G) =>
  client
    .get(`${base(g)}/generation`)
    .header('accept', 'application/json')
    .loginAs(g.a.user)

async function generated(client: any, g: G, options: object = {}) {
  const res = await post(client, g, '/generate', {
    mutationId: randomUUID(),
    baseVersionId: g.baseVersionId,
    options,
  })
  res.assertStatus(202)
  await new TaskDispatchService().dispatch()
  return Document.findOrFail(g.a.document.id)
}
const canvasOf = (versionId: string) =>
  DocumentCanvas.query().where('versionId', versionId).firstOrFail()

test.group('Portfolio generation: HTTP', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installPortfolioModel>
  group.each.teardown(() => {
    model?.restore()
    flagsOff()
  })

  test('POST generate answers 202 with a task and a queued run, and the document is processing', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    const res = await post(client, g, '/generate', {
      mutationId: randomUUID(),
      baseVersionId: g.baseVersionId,
      options: { depth: 'detailed', entries: 3, images: false, templateSet: 'research_brief' },
    })
    res.assertStatus(202)
    const { taskId, runId } = res.body().data
    const task = await WorkspaceTask.findOrFail(taskId)
    assert.equal(task.payload.target, 'canvas')
    // A retired set in the request means the portfolio.
    assert.deepInclude(task.payload.canvas as object, {
      depth: 'detailed',
      entries: 3,
      images: false,
      templateSet: 'portfolio',
    })
    const run = await CanvasGenerationRun.findOrFail(runId)
    assert.equal(run.status, 'queued')
    assert.equal(run.templateSet, 'portfolio')
    assert.equal((await Document.findOrFail(g.a.document.id)).generationStatus, 'processing')
  })

  test('the body options default and are validated', async ({ client, assert }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    const none = await post(client, g, '/generate', {
      mutationId: randomUUID(),
      baseVersionId: g.baseVersionId,
    })
    none.assertStatus(202)
    const run = await CanvasGenerationRun.findOrFail(none.body().data.runId)
    assert.deepInclude(
      { profile: run.profile, depth: run.depth, templateSet: run.templateSet },
      { profile: 'informative', depth: 'standard', templateSet: 'portfolio' }
    )
    for (const options of [
      { depth: 'huge' },
      { entries: 0 },
      { entries: 7 },
      { templateSet: 'poster' },
      { images: 'yes' },
    ]) {
      const bad = await post(client, g, '/generate', {
        mutationId: randomUUID(),
        baseVersionId: g.baseVersionId,
        options,
      })
      bad.assertStatus(422)
    }
    ;(await post(client, g, '/generate', { baseVersionId: g.baseVersionId })).assertStatus(422)
  })

  test('a stale base version and a second active run answer 409', async ({ client, assert }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    ;(
      await post(client, g, '/generate', { mutationId: randomUUID(), baseVersionId: randomUUID() })
    ).assertStatus(409)
    ;(
      await post(client, g, '/generate', {
        mutationId: randomUUID(),
        baseVersionId: g.baseVersionId,
      })
    ).assertStatus(202)
    ;(
      await post(client, g, '/generate', {
        mutationId: randomUUID(),
        baseVersionId: g.baseVersionId,
      })
    ).assertStatus(409)
    assert.equal((await CanvasGenerationRun.query().where('documentId', g.a.document.id)).length, 1)
  })

  test('with either flag off, the routes are 404; another workspace learns nothing', async ({
    client,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    const codes = async () => [
      (
        await post(client, g, '/generate', {
          mutationId: randomUUID(),
          baseVersionId: g.baseVersionId,
        })
      ).status(),
      (await status(client, g)).status(),
    ]
    env.set('CANVAS_GENERATION', undefined as never)
    for (const code of await codes()) if (code !== 404) throw new Error(`expected 404, got ${code}`)
    env.set('CANVAS_GENERATION', 'on')
    const other = await account('bob@example.test')
    ;(
      await post(
        client,
        g,
        '/generate',
        { mutationId: randomUUID(), baseVersionId: g.baseVersionId },
        other.user
      )
    ).assertStatus(404)
  })

  test('GET generation reports the run, its plan and every page with its design', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2, gaps: ['Cost data is not in the sources.'] })
    const g = await portfolioGeneratable()
    const empty = await status(client, g)
    empty.assertStatus(200)
    assert.isNull(empty.body().data)
    await generated(client, g)
    const run = (await status(client, g)).body().data
    assert.equal(run.status, 'ready')
    assert.equal(run.templateSet, 'portfolio')
    assert.equal(run.plan.coverageGaps[0], 'Cost data is not in the sources.')
    assert.deepEqual(
      run.pages.map((p: any) => p.design),
      ['cover', 'entry', 'sources', 'entry', 'sources']
    )
    assert.isAbove(run.pages[1].fill, 0.5)
    assert.isAbove(run.pages[1].citations, 1)
    assert.equal(run.metrics.pages, 5)
    assert.notProperty(run.pages[1], 'content')
  })

  test('rewriting an entry changes that entry and the sources pages; other pages are kept exactly', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const first = await generated(client, g)
    const before = (await canvasOf(first.currentVersionId!)).project
    model.restore()
    model = installPortfolioModel({ entries: 2, alternate: true })
    const res = await post(client, g, '/pages/1/regenerate', {
      mutationId: randomUUID(),
      baseVersionId: first.currentVersionId,
      mode: 'rewrite',
    })
    res.assertStatus(202)
    await new TaskDispatchService().dispatch()
    const doc = await Document.findOrFail(g.a.document.id)
    assert.notEqual(doc.currentVersionId, first.currentVersionId)
    const after = await canvasOf(doc.currentVersionId!)
    assert.equal(after.source, 'generated')
    assert.equal(after.sheetCount, before.sheets.length)
    assert.notEqual(hashOf(after.project.sheets[1]), hashOf(before.sheets[1]))
    // The cover and the second entry are the author's sheets and stay as they were.
    assert.equal(hashOf(after.project.sheets[0]), hashOf(before.sheets[0]))
    assert.equal(hashOf(after.project.sheets[3]), hashOf(before.sheets[3]))
    // One writer call for the entry, with its own evidence; nothing else was asked again.
    assert.deepEqual(
      model.calls.map((c) => c.kind),
      ['entry']
    )
    const run = await CanvasGenerationRun.findOrFail(res.body().data.runId)
    assert.equal(run.status, 'ready')
  })

  test('"Add depth" and "Make shorter" adjust the stored entry with one correction', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 1 })
    const g = await portfolioGeneratable()
    const first = await generated(client, g)
    model.restore()
    model = installPortfolioModel({ entries: 1 })
    ;(
      await post(client, g, '/pages/1/regenerate', {
        mutationId: randomUUID(),
        baseVersionId: first.currentVersionId,
        mode: 'expand',
      })
    ).assertStatus(202)
    await new TaskDispatchService().dispatch()
    assert.lengthOf(model.calls, 1)
    assert.include(model.calls[0].corrections.join('\n'), 'The entry you wrote')
    assert.match(model.calls[0].corrections.join('\n'), /write at least \d+/)
    const second = await Document.findOrFail(g.a.document.id)
    model.restore()
    model = installPortfolioModel({ entries: 1 })
    ;(
      await post(client, g, '/pages/1/regenerate', {
        mutationId: randomUUID(),
        baseVersionId: second.currentVersionId,
        mode: 'condense',
      })
    ).assertStatus(202)
    await new TaskDispatchService().dispatch()
    assert.match(model.calls[0].corrections.join('\n'), /Shorten the entry/)
  })

  test('the cover can be rewritten; the sources pages and unknown pages cannot', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 1 })
    const g = await portfolioGeneratable()
    ;(
      await post(client, g, '/pages/0/regenerate', {
        mutationId: randomUUID(),
        baseVersionId: g.baseVersionId,
        mode: 'rewrite',
      })
    ).assertStatus(409)
    const doc = await generated(client, g)
    const send = (index: number, body: object = {}) =>
      post(client, g, `/pages/${index}/regenerate`, {
        mutationId: randomUUID(),
        baseVersionId: doc.currentVersionId,
        mode: 'rewrite',
        ...body,
      })
    ;(await send(2)).assertStatus(409)
    ;(await send(40)).assertStatus(404)
    ;(await send(1, { mode: 'rewrite-all' })).assertStatus(422)
    model.restore()
    model = installPortfolioModel({ entries: 1 })
    ;(await send(0)).assertStatus(202)
    await new TaskDispatchService().dispatch()
    assert.deepEqual(
      model.calls.map((c) => c.kind),
      ['cover']
    )
  })

  test('pages made by a retired template are generated again, not patched; there is no design route', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 1 })
    const g = await portfolioGeneratable()
    const doc = await generated(client, g)
    await db.from('canvas_generation_runs').update({ template_set: 'academic_report' })
    const res = await post(client, g, '/pages/1/regenerate', {
      mutationId: randomUUID(),
      baseVersionId: doc.currentVersionId,
      mode: 'rewrite',
    })
    res.assertStatus(409)
    assert.match(res.body().error.message, /retired template/)
    ;(
      await post(client, g, '/pages/1/design', {
        mutationId: randomUUID(),
        baseVersionId: doc.currentVersionId,
        design: 'entry',
      })
    ).assertStatus(404)
  })

  test('"Make shorter" keeps the citations the entry has when the new retrieval does not return them', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const first = await generated(client, g)
    const firstRun = await CanvasGenerationRun.query()
      .where('documentId', g.a.document.id)
      .where('status', 'ready')
      .orderBy('createdAt', 'desc')
      .firstOrFail()
    const stored = await CanvasGenerationPage.query()
      .where('runId', firstRun.id)
      .where('pageIndex', 1)
      .firstOrFail()
    const original = stored.citedChunkIds
    assert.isAbove(original.length, 0)
    model.restore()
    model = installPortfolioModel({ entries: 2 })
    // Retrieval finds nothing for this entry now, so only the evidence the entry already has can back its citations.
    const searchPages = RetrievalService.prototype.searchPages
    RetrievalService.prototype.searchPages = async (input) =>
      input.pages.map((page) => ({ key: page.key, chunks: [], extra: [], images: [] }))
    try {
      const res = await post(client, g, '/pages/1/regenerate', {
        mutationId: randomUUID(),
        baseVersionId: first.currentVersionId,
        mode: 'condense',
      })
      res.assertStatus(202)
      await new TaskDispatchService().dispatch()
      const run = await CanvasGenerationRun.findOrFail(res.body().data.runId)
      assert.equal(run.status, 'ready')
      const after = await CanvasGenerationPage.query()
        .where('runId', run.id)
        .where('pageIndex', 1)
        .firstOrFail()
      for (const id of original) assert.include(after.citedChunkIds, id)
    } finally {
      RetrievalService.prototype.searchPages = searchPages
    }
  })

  test('a page action is refused when the author has rearranged the pages since they were generated', async ({
    client,
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const doc = await generated(client, g)
    const saved = (await canvasOf(doc.currentVersionId!)).project
    saved.sheets.splice(3, 1)
    const { version } = await new CanvasService().save(g.a.context, g.a.document.id, {
      project: saved,
      baseVersionId: doc.currentVersionId,
      mutationId: randomUUID(),
    })
    const stale = await post(client, g, '/pages/1/regenerate', {
      mutationId: randomUUID(),
      baseVersionId: version.id,
      mode: 'condense',
    })
    stale.assertStatus(409)
    assert.match(stale.body().error.message, /rearranged/)
  })
})
