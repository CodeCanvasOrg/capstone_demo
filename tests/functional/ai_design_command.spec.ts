/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import ace from '@adonisjs/core/services/ace'
import drive from '@adonisjs/drive/services/main'
import CanvasGenerationRun from '#models/canvas_generation_run'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import CanvasAiDesign from '../../commands/canvas_ai_design.ts'
import { reset } from '../helpers/workspaces.ts'
import { flagsOff, portfolioGeneratable } from '../helpers/portfolio_generation.ts'
import { installAiDesignModel, sampleDesign } from '../helpers/ai_design.ts'

async function exec(args: string[]) {
  ace.ui.switchMode('raw')
  const command = await ace.create(CanvasAiDesign, args)
  await command.exec()
  return command as { exitCode?: number; logger: { getLogs(): { message: string }[] } }
}

test.group('canvas:ai-design', (group) => {
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

  test('--dry-run prints the design JSON and saves nothing', async ({ assert }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const before = (await Document.findOrFail(g.a.document.id)).currentVersionId
    const done = await exec([g.a.document.id, '--dry-run', '--entries=2'])
    assert.notEqual(done.exitCode, 1)
    const out = JSON.parse(done.logger.getLogs().at(-1)!.message)
    assert.isTrue(out.dryRun)
    assert.isTrue(out.usable)
    assert.equal(out.pages, 3)
    assert.equal(out.design.pages.length, 3)
    assert.equal(out.design.system.palette.accent, '#f2a900')
    assert.deepEqual(out.problems, [])
    // Only the design step ran: no text was written, nothing was saved.
    assert.deepEqual(
      model.calls.map((c) => c.kind),
      ['design']
    )
    assert.equal((await Document.findOrFail(g.a.document.id)).currentVersionId, before)
    assert.lengthOf(await CanvasGenerationRun.query(), 0)
  })

  test('--dry-run exits 1 and lists the problems when the design is unusable', async ({
    assert,
  }) => {
    model = installAiDesignModel({
      design: (_, pages) => {
        const d = sampleDesign(pages)
        d.pages[1].frames.find((f) => f.id === 'body')!.style = { size: 5 }
        return d
      },
    })
    const g = await portfolioGeneratable()
    const done = await exec([g.a.document.id, '--dry-run', '--entries=2'])
    assert.equal(done.exitCode, 1)
    const out = JSON.parse(done.logger.getLogs().at(-1)!.message)
    assert.isFalse(out.usable)
    assert.equal(out.attempts, 2)
    assert.equal(out.problems[0].code, 'size')
  })

  test('without --dry-run the canvas is saved as an ai_design run', async ({ assert }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    const done = await exec([g.a.document.id, '--entries=2'])
    assert.notEqual(done.exitCode, 1)
    const doc = await Document.findOrFail(g.a.document.id)
    assert.notEqual(doc.currentVersionId, g.baseVersionId)
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    assert.equal(saved.templateKey, 'ai_design')
    const run = await CanvasGenerationRun.findOrFail(saved.generationRunId!)
    assert.equal(run.templateSet, 'ai_design')
    assert.equal(run.pipelineVersion, 'ai-design-1')
    assert.equal(run.status, 'ready')
  })

  test('bad options and an unknown document exit 1', async ({ assert }) => {
    model = installAiDesignModel()
    const g = await portfolioGeneratable()
    assert.equal((await exec([g.a.document.id, '--pages=2', '--dry-run'])).exitCode, 1)
    assert.equal((await exec([randomUUID(), '--dry-run'])).exitCode, 1)
  })
})
