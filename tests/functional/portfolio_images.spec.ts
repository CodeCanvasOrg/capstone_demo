/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import sharp from 'sharp'
import env from '#start/env'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentImage from '#models/document_image'
import DocumentImageService from '#services/documents/document_image_service'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { canvasOptionsSchema } from '../../shared/canvas/options.ts'
import { framePixels } from '../../shared/canvas/image_rules.ts'
import { reset, source } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

const defaults = canvasOptionsSchema.parse({})
type G = Awaited<ReturnType<typeof portfolioGeneratable>>

/** A noisy picture, so it is a real file size and no two are alike. */
async function noise(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256)
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}

/** An image chunk in the document's sources, with its bytes in storage and a description. */
async function pictureSource(g: G, bytes: Buffer, description: string) {
  const s = await source(g.a, true, true)
  await drive.use().put(s.file.objectKey!, bytes)
  await db.from('chunks').where({ id: s.chunkId }).update({ content: description })
  return s
}

async function generate(g: G, options = defaults) {
  await new CanvasGenerationService().request(g.a.context, g.a.document.id, {
    mutationId: randomUUID(),
    baseVersionId: g.baseVersionId,
    options,
  })
  await new TaskDispatchService().dispatch()
  const doc = await Document.findOrFail(g.a.document.id)
  const row = await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail()
  return {
    doc,
    row,
    pages: await CanvasGenerationPage.query().where('runId', row.id).orderBy('pageIndex'),
    canvas: await DocumentCanvas.query().where('versionId', doc.currentVersionId!).firstOrFail(),
  }
}

test.group('Canvas export: image variants', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
    env.set('CANVAS_EDITOR', 'pilot')
  })
  group.each.teardown(() => {
    drive.restore()
    flagsOff()
  })

  test('the export embeds the print copy resized to the frame at 300 dpi, not the original', async ({
    client,
    assert,
  }) => {
    const { account } = await import('../helpers/workspaces.ts')
    const a = await account()
    // A 3000 x 2000 photograph: large, but a real file size (noise, blurred, as a JPEG).
    const raw = Buffer.alloc(3000 * 2000 * 3)
    for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256)
    const original = await sharp(raw, { raw: { width: 3000, height: 2000, channels: 3 } })
      .blur(4)
      .jpeg({ quality: 88 })
      .toBuffer()
    const image = await new DocumentImageService().upload(a.context, a.document.id, {
      filename: 'wide.jpg',
      contents: original,
    })
    const base = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const enabled = await client
      .post(`${base}/canvas/enable`)
      .json({ mutationId: randomUUID() })
      .withCsrfToken()
      .loginAs(a.user)
    const state = enabled.body().data
    const project = structuredClone(state.project)
    // 80 x 40 mm frame, with no focal point of its own.
    project.sheets[0].frames.push({
      id: 'hero',
      kind: 'image',
      geo: { x: 650, y: 1300, w: 800, h: 400 },
      z: 90,
      order: 90,
      style: {},
      imageId: image.id,
      alt: 'Hero',
      fit: 'cover',
    })
    ;(
      await client
        .put(`${base}/canvas/draft`)
        .json({ project, revision: 0, baseVersionId: state.baseVersionId })
        .withCsrfToken()
        .loginAs(a.user)
    ).assertStatus(200)
    const html = (await client.get(`${base}/preview`).loginAs(a.user)).text()
    const data = /id="hero"><img src="data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)"/.exec(html)
    assert.exists(data)
    const bytes = Buffer.from(data![2], 'base64')
    const meta = await sharp(bytes).metadata()
    const need = framePixels({ w: 800, h: 400 })
    // It covers the frame at 300 dpi and not by much more; the original is 3000 px wide.
    assert.isAtLeast(meta.width!, need.w)
    assert.isAtMost(meta.width!, need.w + 2)
    assert.isAtLeast(meta.height!, need.h)
    assert.isBelow(bytes.length, original.length / 4)
    // The stored focal point is used because the frame has none of its own.
    const stored = await DocumentImage.findOrFail(image.id)
    assert.include(html, `object-position:${stored.focusX}% ${stored.focusY}%`)
  })
})

test.group('Portfolio generation: images', (group) => {
  let model: ReturnType<typeof installPortfolioModel> | undefined
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => {
    model?.restore()
    model = undefined
    drive.restore()
    flagsOff()
  })

  test('a large source picture is promoted to a document image and placed on the entry sheet', async ({
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const s = await pictureSource(
      g,
      await noise(1200, 800),
      'Thermal map of the pilot district showing surface temperature before planting.'
    )
    const r = await generate(g, canvasOptionsSchema.parse({ images: true }))
    assert.equal(r.row.status, 'ready')

    const image = await DocumentImage.query().where('documentId', g.a.document.id).firstOrFail()
    assert.equal(image.origin, 'source')
    assert.equal(image.sourceChunkId, s.chunkId)
    assert.equal(image.width, 1200)
    assert.isNotNull(image.phash)

    // The entry row records the picture it placed.
    const entryPages = r.pages.filter((p) => p.designId === 'entry')
    assert.deepEqual(
      entryPages.flatMap((p) => p.imageIds),
      [image.id]
    )

    // The picture is an image frame on the entry's sheet, and the canvas only shows document images.
    const frames = r.canvas.project.sheets.flatMap((sheet) => sheet.frames)
    const frame = frames.find((f) => f.kind === 'image')!
    assert.equal(frame.kind === 'image' && frame.imageId, image.id)
    const entrySheet = r.canvas.project.sheets.find((sheet) =>
      sheet.frames.some((f) => f.kind === 'image')
    )!
    assert.isTrue(entrySheet.frames.some((f) => f.kind === 'image' && f.imageId === image.id))
  })

  test('a picture under 300 px on its short edge is skipped', async ({ assert }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    await pictureSource(
      g,
      await noise(240, 180),
      'A small thumbnail of the district map, too small to print.'
    )
    const r = await generate(g, canvasOptionsSchema.parse({ images: true }))
    assert.equal(r.row.status, 'ready')
    assert.lengthOf(await DocumentImage.query().where('documentId', g.a.document.id), 0)
    assert.deepEqual(
      r.pages.filter((p) => p.designId === 'entry').flatMap((p) => p.imageIds),
      []
    )
    assert.notExists(
      r.canvas.project.sheets.flatMap((s) => s.frames).find((f) => f.kind === 'image')
    )
  })

  test('with images off, no picture is chosen', async ({ assert }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    await pictureSource(g, await noise(1200, 800), 'Thermal map of the pilot district.')
    const r = await generate(g, canvasOptionsSchema.parse({ images: false }))
    assert.equal(r.row.status, 'ready')
    assert.lengthOf(await DocumentImage.query().where('documentId', g.a.document.id), 0)
    assert.deepEqual(
      r.pages.filter((p) => p.designId === 'entry').flatMap((p) => p.imageIds),
      []
    )
    assert.notExists(
      r.canvas.project.sheets.flatMap((s) => s.frames).find((f) => f.kind === 'image')
    )
  })
})
