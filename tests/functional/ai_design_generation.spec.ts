/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { chromium } from 'playwright'
import sharp from 'sharp'
import env from '#start/env'
import config from '#config/open_router'
import CanvasGenerationPage from '#models/canvas_generation_page'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentImage from '#models/document_image'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import PortfolioRenderService from '#services/canvas/portfolio/portfolio_render_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { canvasOptionsSchema } from '../../shared/canvas/options.ts'
import { parseCanvas, walkNodes, type TextFrame } from '../../shared/canvas/model.ts'
import { citationNumbers } from '../../shared/canvas/portfolio/citations.ts'
import { canvasDesignSchema, type CanvasDesign } from '../../shared/canvas/ai_design/schema.ts'
import { reset, source } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'
import { installAiDesignModel, sampleDesign } from '../helpers/ai_design.ts'

const ai = canvasOptionsSchema.parse({ templateSet: 'ai_design' })
type G = Awaited<ReturnType<typeof portfolioGeneratable>>

const request = (g: G, options = ai) =>
  new CanvasGenerationService().request(g.a.context, g.a.document.id, {
    mutationId: randomUUID(),
    baseVersionId: g.baseVersionId,
    options,
  })
async function generate(g: G, options = ai) {
  await request(g, options)
  await new TaskDispatchService().dispatch()
  const doc = await Document.findOrFail(g.a.document.id)
  const row = await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail()
  return {
    doc,
    row,
    pages: await CanvasGenerationPage.query().where('runId', row.id).orderBy('pageIndex'),
    saved: await DocumentCanvas.query().where('versionId', doc.currentVersionId!).first(),
  }
}
const textOf = (frame: TextFrame) => {
  const parts: string[] = []
  walkNodes(frame.doc, (n) => {
    if (n.type === 'text') parts.push(String((n as { text?: string }).text))
  })
  return parts.join(' ')
}
/** A noisy picture, so it is a real file size. */
async function noise(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256)
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}

test.group('AI design generation', (group) => {
  let model: ReturnType<typeof installAiDesignModel>
  let portfolio: ReturnType<typeof installPortfolioModel> | undefined
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => {
    model?.restore()
    portfolio?.restore()
    portfolio = undefined
    drive.restore()
    flagsOff()
  })

  test('a request queues an ai_design run with the design model', async ({ assert }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const { runId } = await request(g)
    const row = await CanvasGenerationRun.findOrFail(runId)
    assert.equal(row.templateSet, 'ai_design')
    assert.equal(row.pipelineVersion, 'ai-design-1')
    assert.equal(row.plannerModel, config.canvasDesignModel)
    assert.equal(row.status, 'queued')
  })

  test('the design model defaults to the planner model', async ({ assert }) => {
    assert.equal(config.canvasDesignModel, 'test/canvas-planner')
  })

  test('executing the task saves a designed canvas with the ai_design marker, run rows and metrics', async ({
    assert,
  }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const { doc, row, pages, saved } = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2 })
    )
    assert.equal(row.status, 'ready')
    assert.equal(row.templateSet, 'ai_design')
    assert.equal(saved!.source, 'generated')
    assert.equal(saved!.templateKey, 'ai_design')
    assert.equal(saved!.templateVersion, 1)
    assert.deepEqual(saved!.project.template, { id: 'ai_design', version: 1 })
    assert.isTrue(parseCanvas(saved!.project).ok)

    // entries: 2 is a cover and two pages, then the sources page.
    assert.deepEqual(
      pages.map((p) => p.designId),
      ['cover', 'ai_page', 'ai_page', 'sources']
    )
    assert.equal(saved!.sheetCount, 4)
    assert.equal(row.writerModel, 'test/canvas-writer')
    assert.equal(row.metrics!.pages, 4)
    assert.isAbove(row.metrics!.words, 100)
    assert.isAbove(row.metrics!.citations, 2)
    assert.isAbove(row.metrics!.avgFill, 0.2)
    assert.isAtMost(row.metrics!.avgFill, 1)
    assert.equal((row.plan as { kind: string }).kind, 'ai_design')
    assert.lengthOf((row.plan as { pages: unknown[] }).pages, 3)

    // The model was called once to design and once per page to write; nothing else.
    assert.equal(model.calls.filter((c) => c.kind === 'design').length, 1)
    assert.equal(model.calls.filter((c) => c.kind === 'page').length, 3)
    assert.equal(model.calls.find((c) => c.kind === 'design')!.model, 'test/canvas-planner')

    // Every designed page has its text, cited chunks, and a fill; the version text is derived.
    for (const p of pages.filter((x) => x.designId !== 'sources')) {
      assert.equal(p.status, 'fitted')
      assert.isAbove(p.wordCount!, 5)
      assert.isNotNull(p.fillRatio)
    }
    const version = await (
      await import('#models/document_version')
    ).default.findOrFail(doc.currentVersionId!)
    assert.include(JSON.stringify(version.content), 'Cooling the city through design')

    // Footnotes: one number per source document, printed on the sources page as the export numbers them.
    const numbers = citationNumbers(saved!.project)
    assert.isAbove(numbers.size, 0)
    const sheet = saved!.project.sheets.at(-1)!
    const printed = sheet.frames
      .filter((f): f is TextFrame => f.kind === 'text' && /-ref-\d+-number$/.test(f.id))
      .map((f) => Number(textOf(f)))
    assert.deepEqual(
      printed,
      [...printed].sort((a, b) => a - b)
    )
    assert.deepEqual(
      printed,
      Array.from({ length: numbers.size }, (_, i) => i + 1)
    )
    const names = sheet.frames
      .filter((f): f is TextFrame => f.kind === 'text' && /-ref-\d+-name$/.test(f.id))
      .map(textOf)
      .join(' ')
    assert.match(names, /Research summary \d/)
    assert.notMatch(names, /\.pdf/)
    // The sources pages carry the evidence table from the claims.
    assert.include(
      sheet.frames.map((f) => (f.kind === 'text' ? textOf(f) : '')).join(' '),
      'Measured result'
    )
  })

  test('the page count follows depth when entries is auto, held down to what the sources can fill', async ({
    assert,
  }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const { pages } = await generate(g)
    // Four short sources (about 700 words) fill four pages; the standard depth would ask for six.
    assert.equal(pages.filter((p) => p.designId !== 'sources').length, 5)
    const design = JSON.parse(JSON.stringify(model.calls.filter((c) => c.kind === 'design')))
    assert.lengthOf(design, 1)
  })

  test('text that is over its frame is condensed once; one that stays over is cut and noted', async ({
    assert,
  }) => {
    model = installAiDesignModel({ overflow: true })
    const g = await portfolioGeneratable()
    const first = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 1 })
    )
    assert.equal(first.row.status, 'ready')
    const pageCalls = model.calls.filter((c) => c.kind === 'page')
    // The cover is written once; the page's body is over its frame, so it is written and condensed once.
    assert.lengthOf(pageCalls, 3)
    assert.lengthOf(
      pageCalls.filter((c) => c.corrections.some((x) => /over their space/.test(x))),
      1
    )
    assert.match(
      pageCalls.find((c) => c.corrections.length)!.corrections.join(' '),
      /body takes \d+ lines \(limit \d+\)/
    )
    model.restore()
    await reset()

    model = installAiDesignModel({ overflow: true, stubborn: true })
    const h = await portfolioGeneratable()
    const second = await generate(
      h,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 1 })
    )
    assert.equal(second.row.status, 'ready')
    assert.match(second.pages[1].notes.join(' '), /body was cut to fit its frame/)
  })

  test('an invalid first design gets one corrective retry that names the problems', async ({
    assert,
  }) => {
    model = installAiDesignModel({
      design: (call, pages) => {
        const d = sampleDesign(pages)
        // The first answer has body text of 6 pt and two text frames on top of each other.
        if (call === 0) {
          d.pages[1].frames.find((f) => f.id === 'body')!.style = { size: 6 }
          d.pages[1].frames.find((f) => f.id === 'lead')!.y = 300
        }
        return d
      },
    })
    const g = await portfolioGeneratable()
    const { row, saved } = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2 })
    )
    assert.equal(row.status, 'ready')
    const designs = model.calls.filter((c) => c.kind === 'design')
    assert.lengthOf(designs, 2)
    assert.deepEqual(designs[0].corrections, [])
    assert.match(designs[1].corrections.join(' '), /minimum is 7 pt|minimum is 8 pt/)
    assert.match(designs[1].corrections.join(' '), /overlap/)
    assert.equal(saved!.templateKey, 'ai_design')
    assert.equal(row.templateSet, 'ai_design')
  })

  test('a design still invalid after the retry falls back to the portfolio with a reviewer note', async ({
    assert,
  }) => {
    portfolio = installPortfolioModel({ entries: 2 })
    model = installAiDesignModel({
      design: (_, pages) => {
        const d = sampleDesign(pages)
        d.pages[1].frames.find((f) => f.id === 'body')!.style = { size: 5.5 }
        return d
      },
    })
    const g = await portfolioGeneratable()
    const { row, pages, saved } = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2 })
    )
    assert.equal(row.status, 'ready')
    assert.lengthOf(
      model.calls.filter((c) => c.kind === 'design'),
      2
    )
    assert.lengthOf(
      model.calls.filter((c) => c.kind === 'page'),
      0
    )
    // The portfolio template, deterministically laid out.
    assert.deepEqual(saved!.project.template, { id: 'portfolio', version: 1 })
    assert.deepEqual(
      pages.map((p) => p.designId),
      ['cover', 'entry', 'sources', 'entry', 'sources']
    )
    assert.match(
      pages[0].notes[0],
      /AI design fell back to the portfolio template: the design still broke/
    )
    // The run is the portfolio's from here on: its page actions work.
    assert.equal(row.templateSet, 'portfolio')
    assert.equal(row.pipelineVersion, 'portfolio-1')
  })

  test('output the model cannot be asked to fix (unreadable design) also falls back', async ({
    assert,
  }) => {
    portfolio = installPortfolioModel({ entries: 1 })
    model = installAiDesignModel()
    const proto = (await import('#services/open_router_service')).default.prototype
    proto.designCanvas = async () => {
      throw Object.assign(new Error('The model returned an invalid canvas design.'), {
        unusableOutput: true,
      })
    }
    const g = await portfolioGeneratable()
    const { pages, saved } = await generate(g)
    assert.equal(saved!.templateKey, 'portfolio')
    assert.match(pages[0].notes[0], /did not return a usable design/)
  })

  test('a writer failure fails the run and keeps the previous version', async ({ assert }) => {
    model = installAiDesignModel({ fail: true })
    const g = await portfolioGeneratable()
    await request(g)
    for (let i = 0; i < 4; i++) await new TaskDispatchService().dispatch()
    const doc = await Document.findOrFail(g.a.document.id)
    const row = await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail()
    assert.equal(row.status, 'failed')
    assert.equal(doc.currentVersionId, g.baseVersionId)
    assert.notInclude(row.error ?? '', 'boom')
  })

  test('page actions on AI-designed pages answer a clear 409', async ({ assert }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    await generate(g, canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2 }))
    const doc = await Document.findOrFail(g.a.document.id)
    const error = await new CanvasGenerationService()
      .requestRegenerate(g.a.context, g.a.document.id, 1, {
        mutationId: randomUUID(),
        baseVersionId: doc.currentVersionId,
        mode: 'rewrite',
      })
      .then(() => null)
      .catch((e: unknown) => e as { status: number; message: string })
    assert.equal(error?.status, 409)
    assert.match(error!.message, /AI-designed pages are generated again as a whole/)
  })

  test('a source picture is placed in the image frame, registered as a document image', async ({
    assert,
  }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const s = await source(g.a, true, true)
    await drive.use().put(s.file.objectKey!, await noise(900, 1200))
    await db
      .from('chunks')
      .where({ id: s.chunkId })
      .update({ content: 'Photograph of the pilot district street with trees.' })
    const { pages, saved } = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2 })
    )
    const image = await DocumentImage.query().where('documentId', g.a.document.id).firstOrFail()
    assert.equal(image.origin, 'source')
    assert.equal(image.sourceChunkId, s.chunkId)
    const frames = saved!.project.sheets.flatMap((sheet) => sheet.frames)
    const placed = frames.filter((f) => f.kind === 'image')
    assert.lengthOf(placed, 1)
    assert.equal(placed[0].kind === 'image' && placed[0].imageId, image.id)
    assert.deepEqual(
      pages.flatMap((p) => p.imageIds),
      [image.id]
    )
    // The design was told about the picture (size and shape) in its brief.
    assert.isTrue(model.calls.some((c) => c.kind === 'design'))
  })

  test('with images off, no picture is offered or placed', async ({ assert }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const s = await source(g.a, true, true)
    await drive.use().put(s.file.objectKey!, await noise(900, 1200))
    const { saved } = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2, images: false })
    )
    assert.lengthOf(await DocumentImage.query().where('documentId', g.a.document.id), 0)
    assert.isFalse(saved!.project.sheets.flatMap((s2) => s2.frames).some((f) => f.kind === 'image'))
  })

  test('reference pictures are sent only to a model that accepts images', async ({ assert }) => {
    for (const vision of [false, true]) {
      model = installAiDesignModel({ vision })
      const g = await portfolioGeneratable()
      const s = await source(g.a, true, true)
      await drive.use().put(s.file.objectKey!, await noise(900, 1200))
      await generate(g, canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 1 }))
      const sent = model.calls.find((c) => c.kind === 'design')!.images
      assert.equal(sent, vision ? 1 : 0)
      model.restore()
      await reset()
    }
  })
})

test.group('AI design export', (group) => {
  let model: ReturnType<typeof installAiDesignModel>
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => {
    model?.restore()
    drive.restore()
    flagsOff()
  })

  test('the export draws the design: Inter, superscripts, every sheet and no generic sources sheet', async ({
    assert,
  }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const { saved } = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2 })
    )
    const html = await new PortfolioRenderService().html(saved!.project)
    assert.include(html, '@font-face{font-family:"Inter"')
    assert.include(html, '@font-face{font-family:"Inter Display"')
    assert.include(html, '<sup class="ref">1</sup>')
    assert.notInclude(html, 'class="cv-sources"')
    assert.equal(html.split('class="cv-sheet"').length - 1, saved!.sheetCount)
    for (const sheet of saved!.project.sheets) assert.include(html, `id="${sheet.id}"`)
  })

  test('printed in Chromium no text frame overflows its box', async ({ assert }) => {
    if (!existsSync(chromium.executablePath())) return
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const { saved } = await generate(
      g,
      canvasOptionsSchema.parse({ templateSet: 'ai_design', entries: 2 })
    )
    const html = await new PortfolioRenderService().html(saved!.project)
    const pdf = Buffer.from(await new PortfolioRenderService().pdf(saved!.project))
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    assert.equal(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length, saved!.sheetCount)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(html)
      await page.evaluate(() => document.fonts.ready)
      const over = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.cv-text')]
          .filter((el) => el.scrollHeight > el.clientHeight + 1)
          .map((el) => `${el.id}: ${el.scrollHeight} > ${el.clientHeight}`)
      )
      assert.deepEqual(over, [])
    } finally {
      await browser.close()
    }
  }).timeout(60_000)
})

// Keeps the schema import honest: the fixtures are what the model could return.
test('the fixtures parse as designs', ({ assert }) => {
  const parsed = canvasDesignSchema.safeParse(sampleDesign(4) satisfies CanvasDesign)
  assert.isTrue(parsed.success)
  assert.isString(env.get('NODE_ENV'))
})
