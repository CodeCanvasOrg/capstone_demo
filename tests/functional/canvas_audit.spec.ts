/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import ace from '@adonisjs/core/services/ace'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import Document from '#models/document'
import DocumentCanvasDraft from '#models/document_canvas_draft'
import DocumentImage from '#models/document_image'
import CanvasAuditService from '#services/canvas/canvas_audit_service'
import DocumentImageService from '#services/documents/document_image_service'
import type { CanvasDocument } from '../../shared/canvas/model.ts'
import CanvasAudit from '../../commands/canvas_audit.ts'
import ImagesMeasure from '../../commands/images_measure.ts'
import { png } from '../fixtures/document_image.ts'
import { account, reset } from '../helpers/workspaces.ts'

type Account = Awaited<ReturnType<typeof account>>

async function enabled(client: any, a: Account) {
  const res = await client
    .post(`/workspaces/${a.workspace.id}/documents/${a.document.id}/canvas/enable`)
    .json({ mutationId: randomUUID() })
    .withCsrfToken()
    .loginAs(a.user)
  res.assertStatus(200)
  return res.body().data as { project: CanvasDocument; baseVersionId: string }
}

const imageFrame = (id: string, imageId: string | null) => ({
  id,
  kind: 'image' as const,
  geo: { x: 100, y: 100, w: 400, h: 300 },
  z: 80,
  order: 80,
  style: {},
  imageId,
  alt: '',
  fit: 'cover' as const,
})

test.group('canvas:audit and images:measure', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
    env.set('CANVAS_EDITOR', 'pilot')
  })
  group.each.teardown(() => {
    drive.restore()
    env.set('CANVAS_EDITOR', undefined as never)
  })

  test('diff lists deleted and added boxes and pages', ({ assert }) => {
    const saved = {
      schemaVersion: 1,
      sheets: [
        { id: 's0', background: 'white', frames: [{ id: 's0-f0' }, { id: 's0-f1' }] },
        { id: 's1', background: 'white', frames: [{ id: 's1-f0' }] },
      ],
    } as unknown as CanvasDocument
    const draft = {
      schemaVersion: 1,
      sheets: [
        { id: 's0', background: 'white', frames: [{ id: 's0-f1' }, { id: 's0-f2' }] },
        { id: 's2', background: 'white', frames: [] },
      ],
    } as unknown as CanvasDocument
    assert.deepEqual(CanvasAuditService.diff(saved, draft), {
      deletedFrames: ['s0-f0', 's1-f0'],
      addedFrames: ['s0-f2'],
      deletedSheets: ['s1'],
      addedSheets: ['s2'],
    })
  })

  test('the audit reports unsaved deletions and image problems', async ({ client, assert }) => {
    const a = await account()
    const state = await enabled(client, a)
    const image = await new DocumentImageService().upload(a.context, a.document.id, {
      filename: 'a.png',
      contents: png(10, 10),
    })
    // An image uploaded before sizes were recorded.
    await DocumentImage.query().where('id', image.id).update({ width: null, height: null })
    const draft = structuredClone(state.project)
    const [gone] = draft.sheets[0].frames.splice(0, 1)
    draft.sheets[0].frames.push(
      imageFrame('img-empty', null) as never,
      imageFrame('img-ok', image.id) as never,
      // Written behind the API's back: a picture this document does not have.
      imageFrame('img-missing', randomUUID()) as never
    )
    await DocumentCanvasDraft.create({
      documentId: a.document.id,
      workspaceId: a.workspace.id,
      project: draft,
      schemaVersion: 1,
      baseVersionId: state.baseVersionId,
      revision: 3,
      updatedBy: a.user.id,
    })

    const [report] = await new CanvasAuditService().audit(a.workspace.id)
    assert.equal(report.documentId, a.document.id)
    assert.equal(report.draft?.revision, 3)
    assert.isFalse(report.draft?.stale)
    assert.deepEqual(report.draft?.diff.deletedFrames, [gone.id])
    assert.deepEqual(report.draft?.diff.addedFrames, ['img-empty', 'img-missing', 'img-ok'])
    assert.deepEqual(report.images, {
      empty: ['img-empty'],
      missing: ['img-missing'],
      unmeasured: [image.id],
    })
    assert.deepEqual(report.problems, [])

    // Another workspace sees nothing of it.
    const b = await account('other@example.test')
    assert.deepEqual(await new CanvasAuditService().audit(b.workspace.id), [])

    // The command fails on the missing picture; images:measure fixes the size.
    const audit = await ace.create(CanvasAudit, [`--workspace=${a.workspace.id}`, '--json'])
    await audit.exec()
    assert.equal(audit.exitCode, 1)
    const dry = await ace.create(ImagesMeasure, ['--dry-run'])
    await dry.exec()
    assert.isNull((await DocumentImage.findOrFail(image.id)).width)
    const measure = await ace.create(ImagesMeasure, [])
    await measure.exec()
    assert.notEqual(measure.exitCode, 1)
    const measured = await DocumentImage.findOrFail(image.id)
    assert.deepEqual([measured.width, measured.height], [10, 10])
    const [after] = await new CanvasAuditService().audit(a.workspace.id, a.document.id)
    assert.deepEqual(after.images.unmeasured, [])
  })

  test('a draft from an older version is reported stale; a clean canvas passes', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const state = await enabled(client, a)
    const clean = await ace.create(CanvasAudit, [`--workspace=${a.workspace.id}`])
    await clean.exec()
    assert.notEqual(clean.exitCode, 1)
    await DocumentCanvasDraft.create({
      documentId: a.document.id,
      workspaceId: a.workspace.id,
      project: state.project,
      schemaVersion: 1,
      baseVersionId: null,
      revision: 1,
      updatedBy: a.user.id,
    })
    const [report] = await new CanvasAuditService().audit(a.workspace.id)
    assert.isTrue(report.draft?.stale)
    assert.equal((await Document.findOrFail(a.document.id)).currentVersionId, report.versionId)
  })
})
