/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import ace from '@adonisjs/core/services/ace'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import CanvasTemplate from '#models/canvas_template'
import DocumentImage from '#models/document_image'
import DocumentImageService from '#services/documents/document_image_service'
import CanvasTemplatesSeed from '../../commands/canvas_templates_seed.ts'
import { png } from '../fixtures/document_image.ts'
import { account, reset } from '../helpers/workspaces.ts'
import { flagsOff } from '../helpers/canvas_generation.ts'

const json = { accept: 'application/json' }

test.group('Canvas generation: templates and image text', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
    env.set('CANVAS_EDITOR', 'pilot')
    await ace.create(CanvasTemplatesSeed, ['--no-previews']).then((c) => c.exec())
  })
  group.each.teardown(() => {
    drive.restore()
    flagsOff()
    return async () => {
      await CanvasTemplate.query().whereNull('workspaceId').where('category', 'academic').delete()
    }
  })

  test('the gallery lists the system academic templates, each with its slots', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const base = `/workspaces/${a.workspace.id}/documents/${a.document.id}/canvas/templates`
    const res = await client.get(base).headers(json).loginAs(a.user)
    res.assertStatus(200)
    const academic = res.body().data.filter((t: any) => t.category === 'academic')
    assert.lengthOf(academic, 12)
    const essay = academic.find((t: any) => t.designId === 'essay')
    assert.isTrue(essay.system)
    assert.isNull(essay.previewUrl)
    assert.exists(essay.slots.words)
    assert.notProperty(essay, 'project')
    const only = await client.get(`${base}?category=brochure`).headers(json).loginAs(a.user)
    assert.isEmpty(only.body().data.filter((t: any) => t.category === 'academic'))
  })

  test('a template preview is served to the workspace and to nobody else', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const row = await CanvasTemplate.query()
      .whereNull('workspaceId')
      .where('designId', 'essay')
      .firstOrFail()
    await drive.use().put('canvas-templates/academic/essay.v1.png', png(30, 40))
    row.merge({ previewKey: 'canvas-templates/academic/essay.v1.png' })
    await row.save()
    const base = `/workspaces/${a.workspace.id}/documents/${a.document.id}/canvas/templates`
    const list = await client.get(base).headers(json).loginAs(a.user)
    const url = list.body().data.find((t: any) => t.id === row.id).previewUrl
    assert.equal(url, `${base}/${row.id}/preview`)
    const image = await client.get(url).loginAs(a.user)
    image.assertStatus(200)
    image.assertHeader('content-type', 'image/png')
    assert.deepEqual(image.response.body, png(30, 40))
    ;(await client.get(url).headers(json).loginAs(b.user)).assertStatus(404)
    ;(
      await client.get(`${base}/${randomUUID()}/preview`).headers(json).loginAs(a.user)
    ).assertStatus(404)
    ;(await client.get(`${base}/not-a-uuid/preview`).headers(json).loginAs(a.user)).assertStatus(
      404
    )
  })

  test('the gallery is not there without the canvas pilot', async ({ client }) => {
    const a = await account()
    env.set('CANVAS_EDITOR', undefined as never)
    const base = `/workspaces/${a.workspace.id}/documents/${a.document.id}/canvas/templates`
    ;(await client.get(base).headers(json).loginAs(a.user)).assertStatus(404)
  })

  test('a picture’s caption and alt text are saved, trimmed and cleared', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const image = await new DocumentImageService().upload(a.context, a.document.id, {
      filename: 'a.png',
      contents: png(20, 10),
    })
    const url = `/workspaces/${a.workspace.id}/documents/${a.document.id}/images/${image.id}`
    const patch = (body: object, user = a.user, to = url) =>
      client.patch(to).json(body).headers(json).withCsrfToken().loginAs(user)
    const saved = await patch({
      caption: '  Thermal map of the district.  ',
      altText: 'A heat map',
    })
    saved.assertStatus(200)
    assert.include(saved.body().data, {
      caption: 'Thermal map of the district.',
      altText: 'A heat map',
    })
    // Only what is sent changes.
    await patch({ caption: 'Second caption.' })
    const row = await DocumentImage.findOrFail(image.id)
    assert.equal(row.caption, 'Second caption.')
    assert.equal(row.altText, 'A heat map')
    // A blank value clears.
    await patch({ altText: '   ' })
    assert.isNull((await DocumentImage.findOrFail(image.id)).altText)
    await patch({ caption: null })
    assert.isNull((await DocumentImage.findOrFail(image.id)).caption)
    // Too long is refused; another workspace cannot reach it.
    ;(await patch({ caption: 'x'.repeat(401) })).assertStatus(422)
    ;(await patch({ altText: 'x'.repeat(301) })).assertStatus(422)
    ;(await patch({ caption: 'Mine now' }, b.user)).assertStatus(404)
    ;(
      await patch(
        { caption: 'Mine now' },
        b.user,
        `/workspaces/${b.workspace.id}/documents/${b.document.id}/images/${image.id}`
      )
    ).assertStatus(404)
    assert.isNull((await DocumentImage.findOrFail(image.id)).caption)
    // The library lists them.
    const list = await client
      .get(url.replace(`/${image.id}`, ''))
      .headers(json)
      .loginAs(a.user)
    assert.property(list.body().data[0], 'caption')
    assert.property(list.body().data[0], 'focus')
  })
})
