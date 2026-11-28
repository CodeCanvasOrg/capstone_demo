/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import driveService from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import DocumentImage from '#models/document_image'
import DocumentImageVariant from '#models/document_image_variant'
import DocumentImageService from '#services/documents/document_image_service'
import ImagesOptimize from '../../commands/images_optimize.ts'
import { reset } from '../helpers/workspaces.ts'

async function exec(Command: any, args: string[]) {
  const command = await ace.create(Command, args)
  await command.exec()
  return command as { exitCode?: number; logger: { getLogs(): { message: string }[] } }
}

test.group('images:optimize', (group) => {
  group.each.setup(async () => {
    await reset()
    driveService.fake()
  })
  group.each.teardown(() => driveService.restore())

  test('--dry-run writes nothing; a run builds the missing variants; a bad image is reported', async ({
    assert,
  }) => {
    const { account } = await import('../helpers/workspaces.ts')
    const a = await account()
    const raw = Buffer.alloc(900 * 600 * 3, 120)
    const good = await sharp(raw, { raw: { width: 900, height: 600, channels: 3 } })
      .png()
      .toBuffer()
    const image = await new DocumentImageService().upload(a.context, a.document.id, {
      filename: 'a.png',
      contents: good,
    })
    await DocumentImageVariant.query().where('imageId', image.id).delete()
    const dry = await exec(ImagesOptimize, ['--dry-run'])
    assert.notEqual(dry.exitCode, 1)
    assert.lengthOf(await DocumentImageVariant.query().where('imageId', image.id), 0)
    assert.notEqual((await exec(ImagesOptimize, [])).exitCode, 1)
    assert.lengthOf(await DocumentImageVariant.query().where('imageId', image.id), 3)
    // An image whose file is gone cannot be processed: exit 1, and the rest still ran.
    const lost = await new DocumentImageService().upload(a.context, a.document.id, {
      filename: 'b.png',
      contents: good,
    })
    await DocumentImageVariant.query().where('imageId', lost.id).delete()
    const row = await DocumentImage.findOrFail(lost.id)
    await driveService.use().delete(row.objectKey)
    assert.equal((await exec(ImagesOptimize, [])).exitCode, 1)
    assert.equal((await exec(ImagesOptimize, ['--limit=0'])).exitCode, 1)
  })
})
