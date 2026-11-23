/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import env from '#start/env'
import Document from '#models/document'
import VersionService from '#services/documents/version_service'
import DocumentExportService from '#services/exports/document_export_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { DEFAULT_TEMPLATE_ID } from '../../shared/layout/templates.ts'
import { documentFromPages } from '../../shared/brochure/content.ts'
import type { DesignId } from '../../shared/brochure/designs.ts'
import type { CanvasDocument } from '../../shared/canvas/model.ts'
import { samples } from '../fixtures/brochure/pages.ts'
import { account, reset } from '../helpers/workspaces.ts'

type Account = Awaited<ReturnType<typeof account>>
const DESIGNS: DesignId[] = ['cover', 'offer', 'contact']
const base = (a: Account) => `/workspaces/${a.workspace.id}/documents/${a.document.id}`

async function enabled(client: any, a: Account) {
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
  const res = await client
    .post(`${base(a)}/canvas/enable`)
    .json({ mutationId: randomUUID() })
    .withCsrfToken()
    .loginAs(a.user)
  res.assertStatus(200)
  return res.body().data as { project: CanvasDocument; baseVersionId: string }
}

const preview = async (client: any, a: Account) => {
  const res = await client.get(`${base(a)}/preview`).loginAs(a.user)
  res.assertStatus(200)
  return res.text() as string
}

const save = (client: any, a: Account, project: CanvasDocument, baseVersionId: string) =>
  client
    .post(`${base(a)}/canvas/versions`)
    .json({ project, baseVersionId, mutationId: randomUUID() })
    .header('Accept', 'application/json')
    .withCsrfToken()
    .loginAs(a.user)

/** The project without the first frame of the given kind on the first sheet. */
const without = (project: CanvasDocument, kind: string) => {
  const next = structuredClone(project)
  const frames = next.sheets[0].frames
  const removed = frames.find((f) => f.kind === kind)!
  next.sheets[0].frames = frames.filter((f) => f !== removed)
  return { next, removed }
}

test.group('Canvas: deletions reach the preview', (group) => {
  group.each.setup(reset)
  group.each.setup(() => {
    env.set('CANVAS_EDITOR', 'pilot')
    return () => env.set('CANVAS_EDITOR', undefined as never)
  })

  test('a frame deleted and autosaved is gone from the preview', async ({ client, assert }) => {
    const a = await account()
    const state = await enabled(client, a)
    const { next, removed } = without(state.project, 'text')
    ;(
      await client
        .put(`${base(a)}/canvas/draft`)
        .json({ project: next, revision: 0, baseVersionId: state.baseVersionId })
        .withCsrfToken()
        .loginAs(a.user)
    ).assertStatus(200)
    const html = await preview(client, a)
    assert.notInclude(html, `id="${removed.id}"`)
    assert.include(html, 'UNSAVED CHANGES')
    // A pinned version (collections, final export) still draws what was saved.
    const pinned = await new DocumentExportService().preview(a.context, a.document.id, 'html', {
      versionId: state.baseVersionId,
    })
    assert.include(String(pinned), `id="${removed.id}"`)
    assert.notInclude(String(pinned), 'UNSAVED CHANGES')
  })

  test('a frame deleted and saved is gone from the preview', async ({ client, assert }) => {
    const a = await account()
    const state = await enabled(client, a)
    const { next, removed } = without(state.project, 'text')
    ;(await save(client, a, next, state.baseVersionId)).assertStatus(200)
    assert.notInclude(await preview(client, a), `id="${removed.id}"`)
  })

  test('a text box emptied of all its text still previews', async ({ client, assert }) => {
    const a = await account()
    const state = await enabled(client, a)
    const next = structuredClone(state.project)
    const frame = next.sheets[0].frames.find((f) => f.kind === 'text')!
    if (frame.kind === 'text') frame.doc = []
    ;(await save(client, a, next, state.baseVersionId)).assertStatus(200)
    assert.include(await preview(client, a), `id="${frame.id}"`)
  })

  test('a deleted page is gone from the preview', async ({ client, assert }) => {
    const a = await account()
    const state = await enabled(client, a)
    const next = structuredClone(state.project)
    const [gone] = next.sheets.splice(1, 1)
    ;(await save(client, a, next, state.baseVersionId)).assertStatus(200)
    const html = await preview(client, a)
    assert.equal(html.match(/<section class="cv-sheet"/g)?.length, next.sheets.length)
    assert.notInclude(html, `id="${gone.id}"`)
  })

  test('a new image box with no picture or alt text saves and previews', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    const next = structuredClone(state.project)
    next.sheets[0].frames.push({
      id: 'img-empty',
      kind: 'image',
      geo: { x: 100, y: 100, w: 300, h: 300 },
      z: 50,
      order: 1,
      style: {},
      imageId: null,
      alt: '',
      fit: 'cover',
    })
    ;(await save(client, a, next, state.baseVersionId)).assertStatus(200)
    assert.include(await preview(client, a), 'id="img-empty"')
  })
})
