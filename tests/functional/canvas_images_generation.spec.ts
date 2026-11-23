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
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import CanvasService from '#services/canvas/canvas_service'
import DocumentImageService from '#services/documents/document_image_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { canvasOptionsSchema } from '../../shared/canvas/academic/options.ts'
import { framePixels } from '../../shared/canvas/image_rules.ts'
import { densityReport, pageProblems } from '../../shared/canvas/density.ts'
import type { AcademicDesignId } from '../../shared/canvas/academic/designs.ts'
import { reset, source } from '../helpers/workspaces.ts'
import { flagsOff, generatable, installModel } from '../helpers/canvas_generation.ts'

const defaults = canvasOptionsSchema.parse({})

/** A noisy picture, so it is a real file size and no two are alike. */
async function noise(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256)
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}

type G = Awaited<ReturnType<typeof generatable>>

/** An image chunk in the document's sources, with its bytes in storage and a description. */
async function pictureSource(g: G, bytes: Buffer, description: string) {
  const s = await source(g.a, true, true)
  await drive.use().put(s.file.objectKey!, bytes)
  await db.from('chunks').where({ id: s.chunkId }).update({ content: description })
  return s
}

async function generate(g: G, designs: AcademicDesignId[], extra: Record<string, unknown> = {}) {
  const model = installModel({ designs, ...extra })
  const seen: Record<string, any>[] = []
  const proto = (await import('#services/open_router_service')).default.prototype
  const inner = proto.writeCanvasPage
  proto.writeCanvasPage = async function (input, guard) {
    seen.push(JSON.parse(input.user))
    return inner.call(this, input, guard)
  }
  const doc = await Document.findOrFail(g.a.document.id)
  await new CanvasGenerationService().request(g.a.context, g.a.document.id, {
    mutationId: randomUUID(),
    baseVersionId: doc.currentVersionId,
    options: defaults,
  })
  await new TaskDispatchService().dispatch()
  const after = await Document.findOrFail(g.a.document.id)
  const row = await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail()
  return {
    model,
    seen,
    row,
    doc: after,
    canvas: await DocumentCanvas.query().where('versionId', after.currentVersionId!).firstOrFail(),
    pages: await CanvasGenerationPage.query().where('runId', row.id).orderBy('pageIndex'),
  }
}

test.group('Canvas generation: images', (group) => {
  let cleanup: (() => void) | undefined
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => {
    cleanup?.()
    drive.restore()
    flagsOff()
  })
  const designs: AcademicDesignId[] = ['figure_text', 'essay', 'data_findings', 'conclusion']

  test('a source picture is promoted to a document image and placed with a numbered caption', async ({
    assert,
  }) => {
    const g = await generatable()
    const s = await pictureSource(
      g,
      await noise(1200, 800),
      'Thermal map of the pilot district showing surface temperature before planting.'
    )
    const r = await generate(g, designs)
    cleanup = () => r.model.restore()
    assert.equal(r.row.status, 'ready')

    const image = await DocumentImage.query().where('documentId', g.a.document.id).firstOrFail()
    assert.equal(image.origin, 'source')
    assert.equal(image.sourceChunkId, s.chunkId)
    assert.equal(image.width, 1200)
    assert.isNotNull(image.phash)
    assert.match(image.caption!, /^Thermal map of the pilot district/)
    assert.isString(image.altText)

    // The figure page was written knowing what the figure shows.
    const figurePage = r.seen.find((p) => p.page.design === 'figure_text')!
    assert.include(figurePage.page.figure, 'Thermal map')

    const sheet = r.canvas.project.sheets[2]
    const frame = sheet.frames.find((f) => f.kind === 'image')!
    assert.equal(frame.kind === 'image' && frame.imageId, image.id)
    assert.equal(frame.kind === 'image' && frame.fit, 'cover')
    const caption = JSON.stringify(sheet.frames.find((f) => f.id.endsWith('-cap')))
    assert.include(caption, 'Figure 1. Thermal map of the pilot district')
    assert.include(caption, 'Source: image.png')

    // Only document images: the canvas validates, and the page row records the image.
    const parsed = await new CanvasService().validate(
      g.a.context,
      g.a.document.id,
      r.canvas.project
    )
    assert.exists(parsed)
    assert.deepEqual(r.pages[2].imageIds, [image.id])
    // 1200 px across a 64 mm short edge is far over 200 dpi.
    const report = densityReport(r.canvas.project, {
      images: new Map([[image.id, { width: 1200, height: 800 }]]),
    })
    assert.equal(report.lowDpiImages, 0)
    assert.deepEqual(pageProblems(report.pages[2]), [])
  })

  test('a low-resolution picture is skipped and the page becomes plain text', async ({
    assert,
  }) => {
    const g = await generatable()
    await pictureSource(
      g,
      await noise(400, 300),
      'A small thumbnail of the district map, too small to print.'
    )
    const r = await generate(g, designs)
    cleanup = () => r.model.restore()
    assert.equal(r.row.status, 'ready')
    assert.equal(
      await DocumentImage.query()
        .where('documentId', g.a.document.id)
        .then((x) => x.length),
      0
    )
    // The planned figure page is written and laid out as two columns instead.
    assert.equal(r.pages[2].designId, 'two_column')
    assert.equal(
      r.seen.find((p) => p.page.title.includes('Figure and text'))?.page.design,
      'two_column'
    )
    assert.notExists(
      r.canvas.project.sheets.flatMap((s) => s.frames).find((f) => f.kind === 'image')
    )
  })

  test('a portrait picture gives the page its side-figure design', async ({ assert }) => {
    const g = await generatable()
    await pictureSource(
      g,
      await noise(800, 1200),
      'Portrait photograph of a reflective roof installation.'
    )
    const r = await generate(g, designs)
    cleanup = () => r.model.restore()
    assert.equal(r.pages[2].designId, 'side_figure')
    const frame = r.canvas.project.sheets[2].frames.find((f) => f.kind === 'image')!
    // The portrait slot is taller than wide.
    assert.isAbove(frame.geo.h, frame.geo.w)
    assert.equal(
      await DocumentImage.query()
        .where('documentId', g.a.document.id)
        .then((x) => x.length),
      1
    )
  })

  test('the same picture is not placed twice', async ({ assert }) => {
    const g = await generatable()
    const bytes = await noise(1200, 800)
    await pictureSource(g, bytes, 'Thermal map of the district before planting trees.')
    await pictureSource(g, bytes, 'Thermal map of the district before planting trees (copy).')
    const r = await generate(g, ['figure_text', 'figure_text', 'data_findings', 'conclusion'])
    cleanup = () => r.model.restore()
    assert.equal(r.row.status, 'ready')
    assert.equal(
      await DocumentImage.query()
        .where('documentId', g.a.document.id)
        .then((x) => x.length),
      1
    )
    assert.equal(r.pages[2].designId, 'figure_text')
    assert.equal(r.pages[3].designId, 'two_column')
  })

  test('an uploaded picture is used for a figure page, with the caption the author gave it', async ({
    assert,
  }) => {
    const g = await generatable()
    const uploaded = await new DocumentImageService().upload(g.a.context, g.a.document.id, {
      filename: 'district.png',
      contents: await noise(1600, 1000),
    })
    await DocumentImage.query()
      .where('id', uploaded.id)
      .update({ caption: 'The pilot district from the air.' })
    const r = await generate(g, designs)
    cleanup = () => r.model.restore()
    const frame = r.canvas.project.sheets[2].frames.find((f) => f.kind === 'image')!
    assert.equal(frame.kind === 'image' && frame.imageId, uploaded.id)
    assert.include(
      JSON.stringify(r.canvas.project.sheets[2].frames),
      'Figure 1. The pilot district from the air.'
    )
    // Nothing was promoted from the sources.
    assert.equal(
      await DocumentImage.query()
        .where({ documentId: g.a.document.id, origin: 'source' })
        .then((x) => x.length),
      0
    )
  })

  test('with images off, no picture is chosen', async ({ assert }) => {
    const g = await generatable()
    await pictureSource(g, await noise(1200, 800), 'Thermal map of the pilot district.')
    const model = installModel({ designs })
    cleanup = () => model.restore()
    const doc = await Document.findOrFail(g.a.document.id)
    await new CanvasGenerationService().request(g.a.context, g.a.document.id, {
      mutationId: randomUUID(),
      baseVersionId: doc.currentVersionId,
      options: { ...defaults, images: false },
    })
    await new TaskDispatchService().dispatch()
    assert.equal(
      await DocumentImage.query()
        .where('documentId', g.a.document.id)
        .then((x) => x.length),
      0
    )
    assert.equal(model.calls.find((c) => c.design === 'two_column') !== undefined, true)
  })
})

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
