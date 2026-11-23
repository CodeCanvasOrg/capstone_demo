/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import DocumentImage from '#models/document_image'
import DocumentImageService from '#services/documents/document_image_service'
import { account, reset } from '../helpers/workspaces.ts'
import { JPEG, PNG, png } from '../fixtures/document_image.ts'

type Account = Awaited<ReturnType<typeof account>>
const images = (a: Account) => `/workspaces/${a.workspace.id}/documents/${a.document.id}/images`

const upload = (client: any, a: Account, bytes: Buffer, filename: string) =>
  client
    .post(images(a))
    .loginAs(a.user)
    .withCsrfToken()
    .header('accept', 'application/json')
    .file('file', bytes, { filename })

test.group('Canvas images: sizes and library', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => drive.restore())

  test('an upload records the picture size from its header', async ({ client, assert }) => {
    const a = await account()
    const wide = await upload(client, a, png(40, 10), 'wide.png')
    wide.assertStatus(201)
    assert.include(wide.body().data, { width: 40, height: 10 })
    const jpeg = await upload(client, a, JPEG, 'photo.jpg')
    assert.include(jpeg.body().data, { width: 1, height: 1 })
    const row = await DocumentImage.findOrFail(wide.body().data.id)
    assert.equal(row.width, 40)
    assert.equal(row.height, 10)
  })

  test('size is read from PNG and JPEG headers, and unknown otherwise', ({ assert }) => {
    assert.deepEqual(DocumentImageService.dimensions('image/png', png(3, 7)), {
      width: 3,
      height: 7,
    })
    assert.deepEqual(DocumentImageService.dimensions('image/png', PNG), { width: 1, height: 1 })
    assert.deepEqual(DocumentImageService.dimensions('image/jpeg', JPEG), { width: 1, height: 1 })
    assert.isNull(DocumentImageService.dimensions('image/jpeg', Buffer.from([0xff, 0xd8, 0x00])))
    assert.isNull(DocumentImageService.dimensions('image/gif', PNG))
  })

  test('the library lists the document images, newest first, to its workspace only', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('other@example.test')
    const first = (await upload(client, a, png(4, 4), 'first.png')).body().data
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = (await upload(client, a, png(8, 2), 'second.png')).body().data
    const res = await client.get(images(a)).loginAs(a.user).header('accept', 'application/json')
    res.assertStatus(200)
    const list = res.body().data
    assert.deepEqual(
      list.map((i: any) => i.id),
      [second.id, first.id]
    )
    assert.include(list[0], { filename: 'second.png', width: 8, height: 2, mime: 'image/png' })
    assert.notProperty(list[0], 'objectKey')
    // Another workspace learns nothing.
    ;(
      await client
        .get(images(a).replace(a.workspace.id, b.workspace.id))
        .loginAs(b.user)
        .header('accept', 'application/json')
    ).assertStatus(404)
    ;(
      await client.get(images(a)).loginAs(b.user).header('accept', 'application/json')
    ).assertStatus(404)
    ;(await client.get(images(a)).header('accept', 'application/json')).assertStatus(401)
  })
})
