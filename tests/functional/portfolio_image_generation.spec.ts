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
import DocumentImageVariant from '#models/document_image_variant'
import ImageGenerationService, {
  ILLUSTRATION_LABEL,
  PRINT_SIZE,
} from '#services/canvas/image_generation_service'
import PortfolioImagePlanner from '#services/canvas/portfolio/portfolio_image_planner'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { canvasOptionsSchema } from '../../shared/canvas/options.ts'
import { reset, source } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

const withImages = canvasOptionsSchema.parse({ images: true })
type G = Awaited<ReturnType<typeof portfolioGeneratable>>

async function noise(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256)
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}

/** A model answer: a navy picture of the size Gemini returns at 1K and 3:4. */
const answer = async () => ({
  bytes: await sharp({
    create: { width: 896, height: 1200, channels: 3, background: '#14213d' },
  })
    .png()
    .toBuffer(),
  mime: 'image/png',
  costUsd: 0.0665,
  latencyMs: 50,
  text: null,
})

async function generate(g: G, options = withImages) {
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

test.group('Portfolio generation: AI illustrations', (group) => {
  let model: ReturnType<typeof installPortfolioModel> | undefined
  let calls: { model: string; prompt: string }[] = []
  group.each.setup(async () => {
    await reset()
    drive.fake()
    calls = []
    ImageGenerationService.fake(async (input) => {
      calls.push({ model: input.model, prompt: input.prompt })
      return answer()
    })
  })
  group.each.teardown(() => {
    model?.restore()
    model = undefined
    ImageGenerationService.restore()
    drive.restore()
    flagsOff()
    env.set('CANVAS_IMAGE_GENERATION', undefined as never)
    env.set('CANVAS_IMAGE_MODEL', '')
  })

  test('with the flag off nothing is generated', async ({ assert }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const r = await generate(g)
    assert.equal(r.row.status, 'ready')
    assert.lengthOf(calls, 0)
    assert.lengthOf(await DocumentImage.query().where('documentId', g.a.document.id), 0)
    assert.notExists(
      r.canvas.project.sheets.flatMap((s) => s.frames).find((f) => f.kind === 'image')
    )
  })

  test('with the flag on and images off nothing is generated', async ({ assert }) => {
    env.set('CANVAS_IMAGE_GENERATION', 'on')
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const r = await generate(g, canvasOptionsSchema.parse({ images: false }))
    assert.equal(r.row.status, 'ready')
    assert.lengthOf(calls, 0)
  })

  test('an entry with a source picture is never illustrated; the other one is', async ({
    assert,
  }) => {
    env.set('CANVAS_IMAGE_GENERATION', 'on')
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const s = await source(g.a, true, true)
    await drive.use().put(s.file.objectKey!, await noise(1200, 800))
    await db
      .from('chunks')
      .where({ id: s.chunkId })
      .update({ content: 'Thermal map of the pilot district showing surface temperature.' })
    const r = await generate(g)
    assert.equal(r.row.status, 'ready')
    const images = await DocumentImage.query()
      .where('documentId', g.a.document.id)
      .orderBy('createdAt')
    assert.deepEqual(images.map((i) => i.origin).sort(), ['generated', 'source'])
    // One call: for the entry that had no picture.
    assert.lengthOf(calls, 1)
    const entryImages = r.pages.filter((p) => p.designId === 'entry').map((p) => p.imageIds)
    assert.lengthOf(entryImages.flat(), 2)
    assert.isTrue(entryImages.every((ids) => ids.length === 1))
  })

  test('an entry with no picture gets a stored, labelled, uncited illustration', async ({
    assert,
  }) => {
    env.set('CANVAS_IMAGE_GENERATION', 'on')
    env.set('CANVAS_IMAGE_MODEL', 'vendor/test-image')
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const r = await generate(g)
    assert.equal(r.row.status, 'ready')
    assert.lengthOf(calls, 2)
    assert.isTrue(calls.every((c) => c.model === 'vendor/test-image'))
    assert.isTrue(calls.every((c) => /no text, no letters/.test(c.prompt)))

    const images = await DocumentImage.query().where('documentId', g.a.document.id)
    assert.lengthOf(images, 2)
    for (const image of images) {
      assert.equal(image.origin, 'generated')
      assert.isNull(image.sourceChunkId)
      assert.equal(image.caption, ILLUSTRATION_LABEL)
      assert.include(image.altText ?? '', ILLUSTRATION_LABEL)
      assert.equal(image.width, PRINT_SIZE.width)
      assert.equal(image.height, PRINT_SIZE.height)
      assert.deepInclude(image.generation!, { model: 'vendor/test-image', costUsd: 0.0665 })
      assert.include(image.generation!.prompt, 'Strict rules')
      const variants = await DocumentImageVariant.query().where('imageId', image.id)
      assert.sameMembers(
        variants.map((v) => v.purpose),
        ['thumb', 'screen', 'print']
      )
    }

    const entryPages = r.pages.filter((p) => p.designId === 'entry')
    assert.sameMembers(
      entryPages.flatMap((p) => p.imageIds),
      images.map((i) => i.id)
    )
    // Illustrations are never cited and never in the stored evidence.
    for (const page of entryPages) {
      const ids = new Set(images.map((i) => i.id))
      assert.isFalse(page.citedChunkIds.some((id) => ids.has(id)))
      assert.isTrue(page.notes.some((n) => /AI-generated illustration, not evidence/.test(n)))
    }

    // The figure shows the picture and its label.
    const sheets = r.canvas.project.sheets
    const frames = sheets.flatMap((s) => s.frames)
    assert.lengthOf(
      frames.filter((f) => f.kind === 'image'),
      2
    )
    assert.lengthOf(
      frames.filter((f) => f.id.endsWith('-figure-label') && f.kind === 'text'),
      2
    )
    const sources = sheets.filter((s) => s.frames.some((f) => /references/.test(f.id)))
    for (const sheet of sources) assert.isFalse(sheet.frames.some((f) => f.kind === 'image'))
  })

  test('a provider failure leaves the frame out, adds a reviewer note and never crashes the run', async ({
    assert,
  }) => {
    env.set('CANVAS_IMAGE_GENERATION', 'on')
    model = installPortfolioModel({ entries: 2 })
    ImageGenerationService.fake(async () => {
      throw Object.assign(new Error('upstream'), { status: 503 })
    })
    const g = await portfolioGeneratable()
    const r = await generate(g)
    assert.equal(r.row.status, 'ready')
    assert.lengthOf(await DocumentImage.query().where('documentId', g.a.document.id), 0)
    const entryPages = r.pages.filter((p) => p.designId === 'entry')
    assert.deepEqual(
      entryPages.flatMap((p) => p.imageIds),
      []
    )
    for (const page of entryPages)
      assert.isTrue(page.notes.some((n) => /could not be made.*figure frame was left out/.test(n)))
    assert.notExists(
      r.canvas.project.sheets.flatMap((s) => s.frames).find((f) => f.kind === 'image')
    )
  })

  test('a refusal (no picture returned) is handled the same way', async ({ assert }) => {
    env.set('CANVAS_IMAGE_GENERATION', 'on')
    model = installPortfolioModel({ entries: 2 })
    ImageGenerationService.fake(async () => {
      throw Object.assign(new Error('no picture'), { unusableOutput: true })
    })
    const g = await portfolioGeneratable()
    const r = await generate(g)
    assert.equal(r.row.status, 'ready')
    assert.lengthOf(await DocumentImage.query().where('documentId', g.a.document.id), 0)
  })

  test('the planner illustrates only entries missing from the choices, and only when on', async ({
    assert,
  }) => {
    const g = await portfolioGeneratable()
    const planner = new PortfolioImagePlanner()
    const choices = new Map([
      [
        0,
        [
          {
            imageId: randomUUID(),
            origin: 'upload' as const,
            description: 'x',
            width: 900,
            height: 900,
            score: 1,
            phash: null,
          },
        ],
      ],
    ])
    const pages = [{ title: 'One' }, { title: 'Two', intro: 'Intro', category: 'Cat' }]
    const base = {
      context: g.a.context,
      documentId: g.a.document.id,
      pages,
      guard: async () => {},
    }
    const off = await planner.illustrate({ ...base, choices: new Map(choices) })
    assert.equal(off.size, 0)
    assert.lengthOf(calls, 0)

    env.set('CANVAS_IMAGE_GENERATION', 'on')
    const next = new Map(choices)
    const notes = await planner.illustrate({ ...base, choices: next })
    assert.lengthOf(calls, 1)
    assert.include(calls[0].prompt, 'Two')
    assert.include(calls[0].prompt, 'Cat')
    assert.equal(next.get(0)![0].origin, 'upload')
    assert.equal(next.get(1)![0].origin, 'generated')
    assert.deepEqual([...notes.keys()], [1])
  })
})
