import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import DocumentImage from '#models/document_image'
import DocumentVersion from '#models/document_version'
import DocumentService from '#services/documents/document_service'
import DocumentImageService from '#services/documents/document_image_service'
import VersionService from '#services/documents/version_service'
import DocumentExportService from '#services/exports/document_export_service'
import ExportPdfService from '#services/exports/pdf_service'
import { account, reset } from '../helpers/workspaces.ts'
import { PNG, JPEG } from '../fixtures/document_image.ts'

test.group('Document images', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => drive.restore())
  test('multipart upload stores private bytes and authorizes reads before storage', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('other@example.test')
    const url = `/workspaces/${a.workspace.id}/documents/${a.document.id}/images`
    const uploaded = await client
      .post(url)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .file('file', PNG, { filename: 'photo.png' })
    uploaded.assertStatus(201)
    const image = uploaded.body().data
    assert.notProperty(image, 'objectKey')
    assert.equal(image.mime, 'image/png')
    const stored = await DocumentImage.findOrFail(image.id)
    assert.deepEqual(await drive.use().getBytes(stored.objectKey), PNG)
    const allowed = await client.get(image.src).loginAs(a.user)
    allowed.assertStatus(200)
    allowed.assertHeader('content-type', 'image/png')
    allowed.assertHeader('cache-control', 'private, no-store')
    allowed.assertHeader('x-content-type-options', 'nosniff')
    const denied = await client.get(image.src).loginAs(b.user).header('accept', 'application/json')
    denied.assertStatus(404)
    const foreign = await client
      .get(`/workspaces/${b.workspace.id}/documents/${b.document.id}/images/${image.id}`)
      .loginAs(b.user)
      .header('accept', 'application/json')
    foreign.assertStatus(404)
    const guest = await client.get(image.src).header('accept', 'application/json')
    guest.assertStatus(401)
    const forbiddenUpload = await client
      .post(url)
      .loginAs(b.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .file('file', PNG, { filename: 'photo.png' })
    forbiddenUpload.assertStatus(404)
    const jpeg = await client
      .post(url)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .file('file', JPEG, { filename: 'photo.jpeg' })
    jpeg.assertStatus(201)
    assert.equal(jpeg.body().data.mime, 'image/jpeg')
  })
  test('rejects invalid, missing and oversized uploads without creating attachments', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const url = `/workspaces/${a.workspace.id}/documents/${a.document.id}/images`
    for (const [filename, bytes] of [
      ['fake.png', Buffer.from('not an image')],
      ['empty.png', Buffer.alloc(0)],
      ['big.png', Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)])],
      ['danger.svg', Buffer.from('<svg/>')],
    ] as const) {
      const response = await client
        .post(url)
        .loginAs(a.user)
        .withCsrfToken()
        .header('accept', 'application/json')
        .file('file', bytes, { filename })
      response.assertStatus(422)
    }
    const missing = await client
      .post(url)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({})
    missing.assertStatus(422)
    assert.lengthOf(await DocumentImage.all(), 0)
  })
  test('saved attachments survive reload, history, undo and PDF hydration, but cannot cross documents', async ({
    client,
    assert,
    cleanup,
  }) => {
    const a = await account()
    const service = new DocumentImageService()
    const image = await service.upload(a.context, a.document.id, {
      filename: 'photo.png',
      contents: PNG,
    })
    const content = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            documentImageId: image.id,
            src: 'https://untrusted.invalid',
            sourceChunkId: null,
            alt: 'An uploaded diagram',
            width: 320,
            align: 'left',
          },
        },
      ],
    }
    const versions = new VersionService()
    const version = await versions.save(a.context, a.document.id, {
      content,
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    assert.equal(version.content.content[0].attrs?.src, image.src)
    const view = await client
      .get(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    view.assertStatus(200)
    assert.include(JSON.stringify(view.body().props.document), image.id)
    const other = await new DocumentService().create(
      a.context,
      { title: 'Other document', sourceMode: 'input_only' },
      []
    )
    await assert.rejects(
      () =>
        versions.save(a.context, other.id, {
          content,
          baseVersionId: null,
          mutationId: randomUUID(),
        }),
      /An image is unavailable/
    )
    const b = await account('bob@example.test')
    await assert.rejects(() =>
      versions.save(b.context, b.document.id, {
        content,
        baseVersionId: null,
        mutationId: randomUUID(),
      })
    )
    const originalPdf = ExportPdfService.generate
    cleanup(() => {
      ExportPdfService.generate = originalPdf
    })
    ExportPdfService.generate = async (value) => {
      const first = value.body[0]
      assert.equal(
        first.type === 'image' && first.src,
        `data:image/png;base64,${PNG.toString('base64')}`
      )
      return Buffer.from('PDF bytes')
    }
    await new DocumentExportService().preview(a.context, a.document.id)
    const removed = await versions.save(a.context, a.document.id, {
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      baseVersionId: version.id,
      mutationId: randomUUID(),
    })
    const historical = await DocumentVersion.findOrFail(version.id)
    assert.equal(historical.content.content[0].attrs?.documentImageId, image.id)
    const asset = await client.get(image.src).loginAs(a.user)
    asset.assertStatus(200)
    const restored = await versions.save(a.context, a.document.id, {
      content,
      baseVersionId: removed.id,
      mutationId: randomUUID(),
    })
    assert.equal(restored.content.content[0].attrs?.documentImageId, image.id)
    await db
      .from('workspace_memberships')
      .where('id', a.context.membershipId)
      .update({ revoked_at: new Date() })
    const revoked = await client.get(image.src).loginAs(a.user).header('accept', 'application/json')
    revoked.assertStatus(404)
  })
  test('compensates the S3 object when attachment persistence fails', async ({
    assert,
    cleanup,
  }) => {
    const a = await account()
    const original = DocumentImage.create
    cleanup(() => {
      DocumentImage.create = original
    })
    DocumentImage.create = async () => {
      throw new Error('simulated database failure')
    }
    await assert.rejects(
      () =>
        new DocumentImageService().upload(a.context, a.document.id, {
          filename: 'photo.png',
          contents: PNG,
        }),
      'simulated database failure'
    )
    const list = await drive
      .use()
      .listAll(`workspaces/${a.workspace.id}/documents/${a.document.id}/images`)
    assert.lengthOf([...list.objects], 0)
  })
})
