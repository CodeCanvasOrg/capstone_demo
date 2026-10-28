import { test } from '@japa/runner'
import sharp from 'sharp'
import { Readable } from 'node:stream'
import drive from '@adonisjs/drive/services/main'
import ModelImageService from '#services/documents/model_image_service'
import ModelImageException from '#exceptions/model_image_exception'
import config from '#config/open_router'

test.group('Model image previews', () => {
  test('bounds a large real raster without changing its source or aspect ratio', async ({
    assert,
  }) => {
    const input = await sharp({
      create: { width: 10000, height: 6000, channels: 3, background: '#abcdef' },
    })
      .png()
      .toBuffer()
    const copy = Buffer.from(input)
    const output = await new ModelImageService().resize(input)
    const metadata = await sharp(output).metadata()
    assert.equal(metadata.format, 'jpeg')
    assert.equal(metadata.width, 2048)
    assert.equal(metadata.height, 1229)
    assert.isBelow(output.length, config.images.maxOutputBytes)
    assert.deepEqual(input, copy)
  }).timeout(15000)

  test('does not upscale small images', async ({ assert }) => {
    const input = await sharp({
      create: { width: 30, height: 20, channels: 4, background: '#00000000' },
    })
      .png()
      .toBuffer()
    const metadata = await sharp(await new ModelImageService().resize(input)).metadata()
    assert.equal(metadata.width, 30)
    assert.equal(metadata.height, 20)
    assert.isFalse(metadata.hasAlpha)
  })

  test('rejects malformed, unsupported and excessive inputs without leaking decoder details', async ({
    assert,
  }) => {
    const service = new ModelImageService()
    const excessivePixels = await sharp({
      create: { width: 10001, height: 10000, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer()
    for (const input of [
      Buffer.from('private source corrupt'),
      Buffer.alloc(config.images.maxInputBytes + 1),
      excessivePixels,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    ]) {
      try {
        await service.resize(input)
        assert.fail('Expected image preparation to fail')
      } catch (error) {
        assert.instanceOf(error, ModelImageException)
        assert.notInclude((error as Error).message, 'private source')
      }
    }
  }).timeout(15000)

  test('guards private reads and emits only an ephemeral JPEG preview', async ({ assert }) => {
    const original = drive.use
    const input = await sharp({
      create: { width: 40, height: 20, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer()
    let checks = 0
    let reads = 0
    drive.use = () =>
      ({
        getStream: async (key: string) => {
          assert.equal(key, 'authorized/key.png')
          reads++
          return Readable.from([input])
        },
      }) as any
    try {
      const output = await new ModelImageService().prepare('authorized/key.png', async () => {
        checks++
      })
      assert.match(output, /^data:image\/jpeg;base64,/)
      assert.equal(checks, 3)
      assert.equal(reads, 1)
      await assert.rejects(
        () =>
          new ModelImageService().prepare('denied', async () => {
            throw new Error('lease lost')
          }),
        /lease lost/
      )
      assert.equal(reads, 1)
      let revokedChecks = 0
      await assert.rejects(
        () =>
          new ModelImageService().prepare('authorized/key.png', async () => {
            if (++revokedChecks === 2) throw new Error('lease revoked after read')
          }),
        /lease revoked/
      )
    } finally {
      drive.use = original
    }
  })

  test('stops an oversized stream before reading its remainder', async ({ assert }) => {
    const original = drive.use
    let reachedEnd = false
    const stream = Readable.from(
      (async function* () {
        yield Buffer.alloc(config.images.maxInputBytes + 1)
        await new Promise((resolve) => setTimeout(resolve, 10))
        reachedEnd = true
        yield Buffer.from('tail')
      })()
    )
    drive.use = () => ({ getStream: async () => stream }) as any
    try {
      await assert.rejects(
        () => new ModelImageService().prepare('authorized/key', async () => {}),
        /source image/
      )
      assert.isTrue(stream.destroyed)
      assert.isFalse(reachedEnd)
    } finally {
      drive.use = original
    }
  })
})
