/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import DocumentImage from '#models/document_image'
import DocumentImageVariant from '#models/document_image_variant'
import ImageVariantService from '#services/documents/image_variant_service'
import { hamming } from '../../shared/canvas/image_rules.ts'
import { account, reset } from '../helpers/workspaces.ts'

type Account = Awaited<ReturnType<typeof account>>
const images = (a: Account) => `/workspaces/${a.workspace.id}/documents/${a.document.id}/images`
const upload = (client: any, a: Account, bytes: Buffer, filename: string) =>
  client
    .post(images(a))
    .loginAs(a.user)
    .withCsrfToken()
    .header('accept', 'application/json')
    .file('file', bytes, { filename })

/** A dark picture with a bright square at (cx, cy), in percent of its size. */
async function spot(
  width: number,
  height: number,
  cx: number,
  cy: number,
  format: 'png' | 'jpeg' = 'png'
) {
  const size = Math.round(Math.min(width, height) / 5)
  const blob = await sharp({
    create: { width: size, height: size, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer()
  const base = sharp({ create: { width, height, channels: 3, background: '#101820' } }).composite([
    {
      input: blob,
      left: Math.round((width * cx) / 100 - size / 2),
      top: Math.round((height * cy) / 100 - size / 2),
    },
  ])
  const flat = base.removeAlpha()
  return format === 'png' ? flat.png().toBuffer() : flat.jpeg().toBuffer()
}

test.group('Document image variants', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => drive.restore())

  test('an upload makes thumb, screen and print copies, a focal point and a hash', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const original = await spot(4200, 2800, 80, 25)
    const res = await upload(client, a, original, 'big.png')
    res.assertStatus(201)
    const image = await DocumentImage.findOrFail(res.body().data.id)
    const variants = await DocumentImageVariant.query().where('imageId', image.id)
    assert.sameMembers(
      variants.map((v) => v.purpose),
      ['thumb', 'screen', 'print']
    )
    const by = Object.fromEntries(variants.map((v) => [v.purpose, v]))
    assert.equal(by.thumb.format, 'webp')
    assert.equal(by.thumb.width, 320)
    assert.equal(by.screen.format, 'webp')
    assert.equal(by.screen.width, 1600)
    // A4 at 300 dpi: the long edge is 3508 px, and only ever scaled down.
    assert.equal(by.print.format, 'jpeg')
    assert.equal(by.print.width, 3508)
    assert.equal(by.print.height, 2339)
    assert.isBelow(by.print.bytes, original.length)
    for (const v of variants) {
      assert.isTrue(await drive.use().exists(v.key), v.purpose)
      assert.equal(Buffer.from(await drive.use().getBytes(v.key)).length, v.bytes)
    }
    // The original is untouched.
    assert.deepEqual(Buffer.from(await drive.use().getBytes(image.objectKey)), original)
    // The eye goes to the bright square at the right, near the top.
    assert.isAbove(image.focusX!, 60)
    assert.isBelow(image.focusY!, 45)
    assert.match(image.phash!, /^[0-9a-f]{16}$/)
    assert.equal(image.origin, 'upload')
  })

  test('a small picture is never enlarged', async ({ client, assert }) => {
    const a = await account()
    const res = await upload(client, a, await spot(500, 300, 50, 50), 'small.png')
    const variants = await DocumentImageVariant.query().where('imageId', res.body().data.id)
    for (const v of variants) {
      assert.isAtMost(v.width, 500)
      assert.isAtMost(v.height, 300)
    }
  })

  test('a picture with transparency keeps a PNG print copy', async ({ client, assert }) => {
    const a = await account()
    const png = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.4 },
      },
    })
      .png()
      .toBuffer()
    const res = await upload(client, a, png, 'logo.png')
    const print = await DocumentImageVariant.query()
      .where({ imageId: res.body().data.id, purpose: 'print' })
      .firstOrFail()
    assert.equal(print.format, 'png')
  })

  test('EXIF rotation is applied and the metadata is gone', async ({ client, assert }) => {
    const a = await account()
    const jpeg = await sharp({
      create: { width: 600, height: 400, channels: 3, background: '#445566' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer()
    const res = await upload(client, a, jpeg, 'phone.jpg')
    res.assertStatus(201)
    const screen = await DocumentImageVariant.query()
      .where({ imageId: res.body().data.id, purpose: 'screen' })
      .firstOrFail()
    // Orientation 6 turns the picture on its side: it is now 400 wide and 600 tall.
    assert.equal(screen.width, 400)
    assert.equal(screen.height, 600)
    const meta = await sharp(Buffer.from(await drive.use().getBytes(screen.key))).metadata()
    assert.notExists(meta.exif)
    assert.notExists(meta.orientation)
    assert.equal(meta.space, 'srgb')
  })

  test('the hash tells different pictures apart and the same one together', async ({ assert }) => {
    const service = new ImageVariantService()
    const left = await service.phash(await spot(800, 600, 15, 50))
    const left2 = await service.phash(await spot(1600, 1200, 15, 50, 'jpeg'))
    const right = await service.phash(await spot(800, 600, 85, 50))
    assert.isAtMost(hamming(left, left2), 6)
    assert.isAbove(hamming(left, right), 6)
  })

  test('the screen and thumb variants are served on request, the original by default', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const res = await upload(client, a, await spot(3000, 2000, 50, 50), 'photo.png')
    const src: string = res.body().data.src
    const original = await client.get(src).loginAs(a.user)
    original.assertStatus(200)
    original.assertHeader('content-type', 'image/png')
    const screen = await client.get(`${src}?variant=screen`).loginAs(a.user)
    screen.assertStatus(200)
    screen.assertHeader('content-type', 'image/webp')
    const thumb = await client.get(`${src}?variant=thumb`).loginAs(a.user)
    assert.isBelow(
      thumb.response.body.length ?? thumb.text().length,
      original.response.body.length ?? Infinity
    )
    // An unknown variant is the original; a missing one falls back to it.
    ;(await client.get(`${src}?variant=nonsense`).loginAs(a.user)).assertHeader(
      'content-type',
      'image/png'
    )
    await DocumentImageVariant.query().where('imageId', res.body().data.id).delete()
    ;(await client.get(`${src}?variant=screen`).loginAs(a.user)).assertHeader(
      'content-type',
      'image/png'
    )
  })

  test('images:optimize logic builds the missing variants and lists what failed', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const res = await upload(client, a, await spot(900, 600, 50, 50), 'old.png')
    const id = res.body().data.id as string
    await DocumentImageVariant.query().where('imageId', id).delete()
    await DocumentImage.query()
      .where('id', id)
      .update({ phash: null, focus_x: null, focus_y: null })
    const service = new ImageVariantService()
    const dry = await service.backfill({ dryRun: true })
    assert.equal(dry.checked, 1)
    assert.equal(dry.built, 0)
    assert.lengthOf(await DocumentImageVariant.query().where('imageId', id), 0)
    const done = await service.backfill()
    assert.equal(done.built, 1)
    assert.lengthOf(await DocumentImageVariant.query().where('imageId', id), 3)
    const image = await DocumentImage.findOrFail(id)
    assert.isNotNull(image.phash)
    assert.isNotNull(image.focusX)
    // Nothing is left to do.
    assert.equal((await service.backfill()).checked, 0)
  })
})
