/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import env from '#start/env'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentCanvasDraft from '#models/document_canvas_draft'
import DocumentVersion from '#models/document_version'
import VersionService from '#services/documents/version_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { DEFAULT_TEMPLATE_ID } from '../../shared/layout/templates.ts'
import { documentFromPages } from '../../shared/brochure/content.ts'
import type { DesignId } from '../../shared/brochure/designs.ts'
import type { CanvasDocument } from '../../shared/canvas/model.ts'
import { samples } from '../fixtures/brochure/pages.ts'
import { malicious } from '../fixtures/canvas/index.ts'
import { account, reset } from '../helpers/workspaces.ts'

type Account = Awaited<ReturnType<typeof account>>
const DESIGNS: DesignId[] = ['cover', 'offer', 'contact']
const url = (a: Account, path = '') =>
  `/workspaces/${a.workspace.id}/documents/${a.document.id}/canvas${path}`

/** A saved three-page brochure with its page designs pinned. */
async function brochure(a: Account) {
  const doc = await Document.findOrFail(a.document.id)
  await new VersionService().save(a.context, a.document.id, {
    content: documentFromPages(DESIGNS.map((d) => samples[d])).document,
    baseVersionId: doc.currentVersionId,
    mutationId: randomUUID(),
  })
  await new LayoutSelectionService().save(a.context, a.document.id, {
    templateId: DEFAULT_TEMPLATE_ID,
    options: { brochure: { source: 'custom', pages: DESIGNS } },
    baseRevision: 0,
  })
}

async function enabled(client: any, a: Account) {
  await brochure(a)
  const res = await client
    .post(url(a, '/enable'))
    .json({ mutationId: randomUUID() })
    .withCsrfToken()
    .loginAs(a.user)
  res.assertStatus(200)
  return res.body().data as {
    mode: string
    project: CanvasDocument
    revision: number
    baseVersionId: string
    source: string
  }
}

const moved = (project: CanvasDocument, dx = 100) => {
  const next = structuredClone(project)
  const frame = next.sheets[0].frames.find((f) => f.kind === 'text')!
  frame.geo.x = Math.max(0, Math.min(frame.geo.x + dx, 2100 - frame.geo.w))
  return next
}

test.group('Document canvases', (group) => {
  group.each.setup(reset)
  group.each.setup(() => {
    env.set('CANVAS_EDITOR', 'pilot')
    return () => env.set('CANVAS_EDITOR', undefined as never)
  })

  test('the canvas routes do not exist unless the pilot is on', async ({ client }) => {
    env.set('CANVAS_EDITOR', undefined as never)
    const a = await account()
    ;(await client.get(url(a, '/project')).loginAs(a.user)).assertStatus(404)
  })

  test('opening a brochure lays out one sheet per page and saves it as a version', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const before = (await Document.findOrFail(a.document.id)).currentVersionId
    const state = await enabled(client, a)
    assert.equal(state.mode, 'canvas')
    assert.equal(state.source, 'version')
    assert.lengthOf(state.project.sheets, DESIGNS.length)
    const doc = await Document.findOrFail(a.document.id)
    assert.notEqual(doc.currentVersionId, before)
    const row = await DocumentCanvas.findByOrFail('versionId', doc.currentVersionId!)
    assert.equal(row.source, 'composed')
    assert.equal(row.sheetCount, DESIGNS.length)
    // The version's text is the canvas's text, page breaks between sheets.
    const version = await DocumentVersion.findOrFail(doc.currentVersionId!)
    const rules = version.content.content.filter((n: any) => n.type === 'horizontalRule')
    assert.lengthOf(rules, DESIGNS.length - 1)
  })

  test('opening it again changes nothing', async ({ client, assert }) => {
    const a = await account()
    const first = await enabled(client, a)
    const again = await client
      .post(url(a, '/enable'))
      .json({ mutationId: randomUUID() })
      .withCsrfToken()
      .loginAs(a.user)
    again.assertStatus(200)
    assert.equal(again.body().data.baseVersionId, first.baseVersionId)
  })

  test('autosave keeps a draft, and two tabs cannot overwrite each other', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    const put = (revision: number, baseVersionId = state.baseVersionId) =>
      client
        .put(url(a, '/draft'))
        .json({ project: moved(state.project), revision, baseVersionId })
        .withCsrfToken()
        .loginAs(a.user)
    const first = await put(0)
    first.assertStatus(200)
    assert.equal(first.body().data.revision, 1)
    const read = await client.get(url(a, '/project')).loginAs(a.user)
    assert.equal(read.body().data.source, 'draft')
    assert.equal(read.body().data.revision, 1)
    // A second tab still on revision 0 is refused.
    ;(await put(0)).assertStatus(409)
    // A draft for an older version is refused.
    ;(await put(1, randomUUID())).assertStatus(409)
  })

  test('saving makes a version with the canvas, clears the draft and resets review', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    await client
      .put(url(a, '/draft'))
      .json({ project: moved(state.project), revision: 0, baseVersionId: state.baseVersionId })
      .withCsrfToken()
      .loginAs(a.user)
    const mutationId = randomUUID()
    const save = (project: CanvasDocument) =>
      client
        .post(url(a, '/versions'))
        .json({ project, baseVersionId: state.baseVersionId, mutationId })
        .withCsrfToken()
        .loginAs(a.user)
    const res = await save(moved(state.project))
    res.assertStatus(200)
    const versionId = res.body().data.versionId
    assert.notEqual(versionId, state.baseVersionId)
    const row = await DocumentCanvas.findByOrFail('versionId', versionId)
    assert.equal(row.source, 'edited')
    assert.isNull(await DocumentCanvasDraft.find(a.document.id))
    assert.equal((await Document.findOrFail(a.document.id)).status, 'edited')
    // The same save again is the same version; the same id for a different canvas is refused.
    assert.equal((await save(moved(state.project))).body().data.versionId, versionId)
    ;(await save(moved(state.project, -100))).assertStatus(409)
  })

  test('moving a frame alone is a new version, though the text is unchanged', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    const res = await client
      .post(url(a, '/versions'))
      .json({
        project: moved(state.project),
        baseVersionId: state.baseVersionId,
        mutationId: randomUUID(),
      })
      .withCsrfToken()
      .loginAs(a.user)
    res.assertStatus(200)
    assert.notEqual(res.body().data.versionId, state.baseVersionId)
    const older = await DocumentVersion.findOrFail(state.baseVersionId)
    const newer = await DocumentVersion.findOrFail(res.body().data.versionId)
    const text = (v: DocumentVersion) =>
      JSON.stringify(v.content.content).replace(/"nodeId":"[^"]*"/g, '')
    assert.equal(text(newer), text(older))
  })

  test('a saved canvas from an older version is refused', async ({ client }) => {
    const a = await account()
    const state = await enabled(client, a)
    const res = await client
      .post(url(a, '/versions'))
      .json({ project: state.project, baseVersionId: randomUUID(), mutationId: randomUUID() })
      .withCsrfToken()
      .loginAs(a.user)
    res.assertStatus(409)
  })

  for (const [name, make] of Object.entries(malicious))
    test(`a hostile canvas (${name}) is refused and nothing is stored`, async ({
      client,
      assert,
    }) => {
      const a = await account()
      const state = await enabled(client, a)
      const canvases = await DocumentCanvas.query().where('documentId', a.document.id)
      const res = await client
        .post(url(a, '/versions'))
        .json({ project: make(), baseVersionId: state.baseVersionId, mutationId: randomUUID() })
        .withCsrfToken()
        .loginAs(a.user)
      res.assertStatus(422)
      const after = await DocumentCanvas.query().where('documentId', a.document.id)
      assert.lengthOf(after, canvases.length)
      const draft = await client
        .put(url(a, '/draft'))
        .json({ project: make(), revision: 0, baseVersionId: state.baseVersionId })
        .withCsrfToken()
        .loginAs(a.user)
      draft.assertStatus(422)
    })

  test('another workspace cannot read or write the canvas', async ({ client }) => {
    const a = await account()
    const state = await enabled(client, a)
    const b = await account('bob@example.test')
    const theirs = `/workspaces/${b.workspace.id}/documents/${a.document.id}/canvas`
    ;(await client.get(`${theirs}/project`).loginAs(b.user)).assertStatus(404)
    ;(
      await client
        .post(`${theirs}/versions`)
        .json({
          project: state.project,
          baseVersionId: state.baseVersionId,
          mutationId: randomUUID(),
        })
        .withCsrfToken()
        .loginAs(b.user)
    ).assertStatus(404)
    ;(await client.get(url(a, '/project')).loginAs(b.user)).assertStatus(404)
  })

  test('a new case study opens in the canvas before it has any text', async ({
    client,
    assert,
  }) => {
    const a = await account()
    assert.isNull((await Document.findOrFail(a.document.id)).currentVersionId)
    const res = await client
      .post(url(a, '/enable'))
      .json({ mutationId: randomUUID() })
      .withCsrfToken()
      .loginAs(a.user)
    res.assertStatus(200)
    const state = res.body().data
    assert.equal(state.mode, 'canvas')
    assert.lengthOf(state.project.sheets, 2)
    const doc = await Document.findOrFail(a.document.id)
    assert.isNotNull(doc.currentVersionId)
    const version = await DocumentVersion.findOrFail(doc.currentVersionId!)
    assert.include(JSON.stringify(version.content), 'Evidence example')
  })

  test('a version saved outside the canvas is laid out again, not lost', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    // E.g. a new draft generated from the document page.
    const next = structuredClone(
      (await DocumentVersion.findOrFail(state.baseVersionId)).content
    ) as { content: unknown[] }
    next.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Added in text.' }] })
    await new VersionService().save(a.context, a.document.id, {
      content: next,
      baseVersionId: state.baseVersionId,
      mutationId: randomUUID(),
    })
    const res = await client.get(url(a, '/project')).loginAs(a.user)
    res.assertStatus(200)
    const after = res.body().data
    assert.equal(after.source, 'composed')
    assert.notEqual(after.baseVersionId, state.baseVersionId)
    assert.include(JSON.stringify(after.project), 'Added in text.')
  })

  test('going back to the text editor keeps the text and the canvas history', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    await client
      .put(url(a, '/draft'))
      .json({ project: moved(state.project), revision: 0, baseVersionId: state.baseVersionId })
      .withCsrfToken()
      .loginAs(a.user)
    const res = await client.post(url(a, '/disable')).withCsrfToken().loginAs(a.user)
    res.assertStatus(200)
    assert.equal(res.body().data.mode, 'flow')
    assert.isNull(await DocumentCanvasDraft.find(a.document.id))
    assert.lengthOf(await DocumentCanvas.query().where('documentId', a.document.id), 1)
    // Saving a canvas is refused until the canvas is opened again.
    ;(
      await client
        .post(url(a, '/versions'))
        .json({
          project: state.project,
          baseVersionId: state.baseVersionId,
          mutationId: randomUUID(),
        })
        .withCsrfToken()
        .loginAs(a.user)
    ).assertStatus(409)
  })

  test('the preview draws the canvas, one sheet per page, then the sources', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    const res = await client
      .get(`/workspaces/${a.workspace.id}/documents/${a.document.id}/preview`)
      .loginAs(a.user)
    res.assertStatus(200)
    const html = res.text()
    assert.equal(html.match(/<section class="cv-sheet"/g)?.length, state.project.sheets.length)
    assert.include(html, 'PREVIEW')
    for (const frame of state.project.sheets[0].frames) assert.include(html, `id="${frame.id}"`)
    // In flow mode the same document renders with the brochure designs again.
    await client.post(url(a, '/disable')).withCsrfToken().loginAs(a.user)
    const flow = await client
      .get(`/workspaces/${a.workspace.id}/documents/${a.document.id}/preview`)
      .loginAs(a.user)
    assert.notInclude(flow.text(), 'cv-sheet')
  })
})
