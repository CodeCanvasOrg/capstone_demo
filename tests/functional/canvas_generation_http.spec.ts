/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import env from '#start/env'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import WorkspaceTask from '#models/workspace_task'
import CanvasService from '#services/canvas/canvas_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { hashOf } from '../../shared/layout/hash.ts'
import { account, reset } from '../helpers/workspaces.ts'
import { flagsOff, generatable, installModel } from '../helpers/canvas_generation.ts'

type G = Awaited<ReturnType<typeof generatable>>
const base = (g: G) => `/workspaces/${g.a.workspace.id}/documents/${g.a.document.id}/canvas`
const post = (client: any, g: G, path: string, body: object, user = g.a.user) =>
  client
    .post(`${base(g)}${path}`)
    .json(body)
    .header('accept', 'application/json')
    .withCsrfToken()
    .loginAs(user)

async function generated(client: any, g: G) {
  const res = await post(client, g, '/generate', {
    mutationId: randomUUID(),
    baseVersionId: g.baseVersionId,
    options: {},
  })
  res.assertStatus(202)
  await new TaskDispatchService().dispatch()
  return Document.findOrFail(g.a.document.id)
}
const canvasOf = (versionId: string) =>
  DocumentCanvas.query().where('versionId', versionId).firstOrFail()

test.group('Canvas generation: HTTP', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installModel>
  group.each.teardown(() => {
    model?.restore()
    flagsOff()
  })

  test('POST generate answers 202 with a task and a queued run, and the document is processing', async ({
    client,
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const res = await post(client, g, '/generate', {
      mutationId: randomUUID(),
      baseVersionId: g.baseVersionId,
      options: {
        profile: 'informative',
        depth: 'detailed',
        templateSet: 'research_brief',
        pages: 6,
      },
    })
    res.assertStatus(202)
    const { taskId, runId } = res.body().data
    const task = await WorkspaceTask.findOrFail(taskId)
    assert.equal(task.payload.target, 'canvas')
    assert.deepInclude(task.payload.canvas as object, {
      profile: 'informative',
      depth: 'detailed',
      templateSet: 'research_brief',
      pages: 6,
    })
    assert.equal((await CanvasGenerationRun.findOrFail(runId)).status, 'queued')
    assert.equal((await Document.findOrFail(g.a.document.id)).generationStatus, 'processing')
  })

  test('the body options default and are validated', async ({ client, assert }) => {
    model = installModel()
    const g = await generatable()
    const none = await post(client, g, '/generate', {
      mutationId: randomUUID(),
      baseVersionId: g.baseVersionId,
    })
    none.assertStatus(202)
    const run = await CanvasGenerationRun.findOrFail(none.body().data.runId)
    assert.deepInclude(
      { profile: run.profile, depth: run.depth, templateSet: run.templateSet },
      { profile: 'academic', depth: 'standard', templateSet: 'academic_report' }
    )
    for (const options of [
      { depth: 'huge' },
      { pages: 2 },
      { pages: 17 },
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
    model = installModel()
    const g = await generatable()
    ;(
      await post(client, g, '/generate', { mutationId: randomUUID(), baseVersionId: randomUUID() })
    ).assertStatus(409)
    ;(
      await post(client, g, '/generate', {
        mutationId: randomUUID(),
        baseVersionId: g.baseVersionId,
      })
    ).assertStatus(202)
    const second = await post(client, g, '/generate', {
      mutationId: randomUUID(),
      baseVersionId: g.baseVersionId,
    })
    second.assertStatus(409)
    assert.equal((await CanvasGenerationRun.query().where('documentId', g.a.document.id)).length, 1)
  })

  test('with either flag off, the routes are 404', async ({ client }) => {
    model = installModel()
    const g = await generatable()
    const send = async () => {
      const a = await post(client, g, '/generate', {
        mutationId: randomUUID(),
        baseVersionId: g.baseVersionId,
      })
      const b = await client
        .get(`${base(g)}/generation`)
        .header('accept', 'application/json')
        .loginAs(g.a.user)
      return [a.status(), b.status()]
    }
    env.set('CANVAS_GENERATION', undefined as never)
    ;(await send()).forEach(
      (s) =>
        s === 404 ||
        (() => {
          throw new Error(`expected 404, got ${s}`)
        })()
    )
    env.set('CANVAS_GENERATION', 'on')
    env.set('CANVAS_EDITOR', undefined as never)
    ;(await send()).forEach(
      (s) =>
        s === 404 ||
        (() => {
          throw new Error(`expected 404, got ${s}`)
        })()
    )
  })

  test('another workspace learns nothing', async ({ client }) => {
    model = installModel()
    const g = await generatable()
    const other = await account('bob@example.test')
    const body = { mutationId: randomUUID(), baseVersionId: g.baseVersionId }
    // Bob's own workspace, Alice's document: not found.
    const url = `/workspaces/${other.workspace.id}/documents/${g.a.document.id}/canvas`
    ;(
      await client
        .post(`${url}/generate`)
        .json(body)
        .header('accept', 'application/json')
        .withCsrfToken()
        .loginAs(other.user)
    ).assertStatus(404)
    ;(
      await client.get(`${url}/generation`).header('accept', 'application/json').loginAs(other.user)
    ).assertStatus(404)
    // Alice's workspace, Bob's login: not a member.
    ;(await post(client, g, '/generate', body, other.user)).assertStatus(404)
    ;(
      await client
        .get(`${base(g)}/generation`)
        .header('accept', 'application/json')
        .loginAs(other.user)
    ).assertStatus(404)
  })

  test('GET generation reports the latest run, its stage, its plan and every page', async ({
    client,
    assert,
  }) => {
    model = installModel({ gaps: ['Cost data is not in the sources.'] })
    const g = await generatable()
    const empty = await client
      .get(`${base(g)}/generation`)
      .header('accept', 'application/json')
      .loginAs(g.a.user)
    empty.assertStatus(200)
    assert.isNull(empty.body().data)
    await generated(client, g)
    const res = await client
      .get(`${base(g)}/generation`)
      .header('accept', 'application/json')
      .loginAs(g.a.user)
    res.assertStatus(200)
    const run = res.body().data
    assert.equal(run.status, 'ready')
    assert.equal(run.profile, 'academic')
    assert.equal(run.plan.coverageGaps[0], 'Cost data is not in the sources.')
    assert.equal(run.plan.thesis, 'Combined heat programmes outperform single measures.')
    assert.lengthOf(run.pages, 7)
    assert.deepEqual(
      run.pages.map((p: any) => p.design),
      ['title_page', 'contents', 'essay', 'two_column', 'data_findings', 'conclusion', 'references']
    )
    assert.isAbove(run.pages[2].words, 280)
    assert.isAbove(run.pages[2].fill, 0.7)
    assert.isAbove(run.pages[2].citations, 1)
    assert.equal(run.metrics.pages, 7)
    assert.isString(run.resultVersionId)
    assert.notProperty(run.pages[2], 'content')
  })

  test('regenerating one page makes a new version where only that sheet changed', async ({
    client,
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const first = await generated(client, g)
    const before = (await canvasOf(first.currentVersionId!)).project
    model.restore()
    // The rewrite is a different (fuller) page.
    model = installModel({ first: { essay: 0.74 } })
    const res = await post(client, g, '/pages/2/regenerate', {
      mutationId: randomUUID(),
      baseVersionId: first.currentVersionId,
      mode: 'rewrite',
    })
    res.assertStatus(202)
    assert.equal((await CanvasGenerationRun.findOrFail(res.body().data.runId)).status, 'queued')
    await new TaskDispatchService().dispatch()
    const doc = await Document.findOrFail(g.a.document.id)
    assert.notEqual(doc.currentVersionId, first.currentVersionId)
    const after = await canvasOf(doc.currentVersionId!)
    assert.equal(after.source, 'generated')
    assert.equal(after.sheetCount, before.sheets.length)
    after.project.sheets.forEach((sheet, i) => {
      if (i === 2) assert.notEqual(hashOf(sheet), hashOf(before.sheets[i]))
      else assert.equal(hashOf(sheet), hashOf(before.sheets[i]), `sheet ${i} is unchanged`)
    })
    // One writer call for the page, with fresh retrieval; the others were not asked again.
    assert.deepEqual(
      model.calls.map((c) => c.design),
      ['essay']
    )
    // The run shows the page was rewritten and keeps the rest of the plan.
    const run = await CanvasGenerationRun.findOrFail(res.body().data.runId)
    assert.equal(run.status, 'ready')
    assert.lengthOf(await CanvasGenerationPage.query().where('runId', run.id), 7)
  })

  test('"Add depth" and "Make shorter" adjust the stored page with one correction', async ({
    client,
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const first = await generated(client, g)
    model.restore()
    model = installModel({ corrected: 0.95 })
    const deeper = await post(client, g, '/pages/3/regenerate', {
      mutationId: randomUUID(),
      baseVersionId: first.currentVersionId,
      mode: 'expand',
    })
    deeper.assertStatus(202)
    await new TaskDispatchService().dispatch()
    assert.lengthOf(model.calls, 1)
    assert.match(model.calls[0].corrections.join('\n'), /fills \d+% of its layout/)
    assert.include(model.calls[0].corrections.join('\n'), 'The page you wrote')
    // The page's stored quality is that of the new page, not of the one it replaced.
    const status = await client
      .get(`${base(g)}/generation`)
      .header('accept', 'application/json')
      .loginAs(g.a.user)
    assert.isAbove(status.body().data.pages[3].fill, 0.9)
    const second = await Document.findOrFail(g.a.document.id)
    model.restore()
    model = installModel({ corrected: 0.75 })
    const shorter = await post(client, g, '/pages/3/regenerate', {
      mutationId: randomUUID(),
      baseVersionId: second.currentVersionId,
      mode: 'condense',
    })
    shorter.assertStatus(202)
    await new TaskDispatchService().dispatch()
    assert.match(model.calls[0].corrections.join('\n'), /exceeds its layout/)
    assert.notEqual(
      (await Document.findOrFail(g.a.document.id)).currentVersionId,
      second.currentVersionId
    )
  })

  test('a page action is refused when the page is the application’s, unknown or the pages were rearranged', async ({
    client,
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
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
    // Contents (1) and references (6) are written by the application.
    ;(await send(1)).assertStatus(409)
    ;(await send(6)).assertStatus(409)
    ;(await send(40)).assertStatus(404)
    ;(await send(2, { mode: 'rewrite-all' })).assertStatus(422)
    // The author deletes a page: the stored pages no longer line up with the canvas.
    const saved = (await canvasOf(doc.currentVersionId!)).project
    saved.sheets.splice(3, 1)
    const { version } = await new CanvasService().save(g.a.context, g.a.document.id, {
      project: saved,
      baseVersionId: doc.currentVersionId,
      mutationId: randomUUID(),
    })
    const stale = await send(2, { baseVersionId: version.id })
    stale.assertStatus(409)
    assert.match(stale.body().error.message, /rearranged/)
  })

  test('"Change design" re-lays the stored page out in another design with no model call', async ({
    client,
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const first = await generated(client, g)
    const before = (await canvasOf(first.currentVersionId!)).project
    const calls = model.calls.length
    const res = await post(client, g, '/pages/2/design', {
      mutationId: randomUUID(),
      baseVersionId: first.currentVersionId,
      design: 'two_column',
    })
    res.assertStatus(200)
    assert.equal(model.calls.length, calls)
    const doc = await Document.findOrFail(g.a.document.id)
    assert.equal(res.body().data.versionId, doc.currentVersionId)
    const after = (await canvasOf(doc.currentVersionId!)).project
    after.sheets.forEach((sheet, i) => {
      if (i === 2) assert.exists(sheet.frames.find((f) => f.id.endsWith('-col1')))
      else assert.equal(hashOf(sheet), hashOf(before.sheets[i]))
    })
    const row = await CanvasGenerationPage.query()
      .where('designId', 'two_column')
      .where('pageIndex', 2)
      .first()
    assert.exists(row)
    ;(
      await post(client, g, '/pages/2/design', {
        mutationId: randomUUID(),
        baseVersionId: doc.currentVersionId,
        design: 'references',
      })
    ).assertStatus(422)
  })

  test('a signed-out request creates nothing', async ({ client, assert }) => {
    model = installModel()
    const g = await generatable()
    await client
      .post(`${base(g)}/generate`)
      .json({ mutationId: randomUUID(), baseVersionId: g.baseVersionId })
      .header('accept', 'application/json')
      .withCsrfToken()
    assert.equal((await CanvasGenerationRun.query().where('documentId', g.a.document.id)).length, 0)
  })
})
