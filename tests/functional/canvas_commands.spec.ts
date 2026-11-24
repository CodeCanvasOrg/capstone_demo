/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import driveService from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import CanvasGenerationRun from '#models/canvas_generation_run'
import CanvasTemplate from '#models/canvas_template'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentImage from '#models/document_image'
import DocumentImageVariant from '#models/document_image_variant'
import DocumentImageService from '#services/documents/document_image_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import CanvasDensity from '../../commands/canvas_density.ts'
import CanvasGenerate from '../../commands/canvas_generate.ts'
import CanvasPlan from '../../commands/canvas_plan.ts'
import CanvasTemplatesSeed from '../../commands/canvas_templates_seed.ts'
import ImagesOptimize from '../../commands/images_optimize.ts'
import { ACADEMIC_DESIGN_IDS } from '../../shared/canvas/academic/designs.ts'
import { reset } from '../helpers/workspaces.ts'
import { flagsOff, generatable, installModel } from '../helpers/canvas_generation.ts'
import { randomUUID } from 'node:crypto'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'

async function exec(Command: any, args: string[]) {
  const command = await ace.create(Command, args)
  await command.exec()
  return command as { exitCode?: number; logger: { getLogs(): { message: string }[] } }
}

test.group('canvas:density', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installModel>
  group.each.teardown(() => {
    model?.restore()
    flagsOff()
  })

  async function withCanvas() {
    model = installModel()
    const g = await generatable()
    await new CanvasGenerationService().request(g.a.context, g.a.document.id, {
      mutationId: randomUUID(),
      baseVersionId: g.baseVersionId,
      options: new CanvasGenerationService().options({}),
    })
    await new TaskDispatchService().dispatch()
    return g
  }

  test('it needs a workspace', async ({ assert }) => {
    assert.equal((await exec(CanvasDensity, [])).exitCode, 1)
    assert.equal((await exec(CanvasDensity, ['--workspace=x', '--min-fill=9'])).exitCode, 1)
  })

  test('it passes a well filled generated canvas and fails one under the thresholds', async ({
    assert,
  }) => {
    const g = await withCanvas()
    const ws = `--workspace=${g.a.workspace.id}`
    const ok = await exec(CanvasDensity, [ws])
    assert.notEqual(ok.exitCode, 1)
    const one = await exec(CanvasDensity, [ws, `--document=${g.a.document.id}`, '--json'])
    assert.notEqual(one.exitCode, 1)
    // Raising the bar fails the gate, as does a fill no page reaches.
    assert.equal((await exec(CanvasDensity, [ws, '--min-words=5000'])).exitCode, 1)
    assert.equal((await exec(CanvasDensity, [ws, '--min-fill=1.2'])).exitCode, 1)
  })

  test('a workspace with no canvas documents passes and reports nothing', async ({ assert }) => {
    model = installModel()
    const g = await generatable()
    const other = await (await import('../helpers/workspaces.ts')).account('carol@example.test')
    const done = await exec(CanvasDensity, [`--workspace=${other.workspace.id}`])
    assert.notEqual(done.exitCode, 1)
    assert.exists(g)
  })

  test('canvas:plan prints the plan and each page’s coverage and saves nothing', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const before = (await Document.findOrFail(g.a.document.id)).currentVersionId
    const done = await exec(CanvasPlan, [
      `--workspace=${g.a.workspace.id}`,
      `--document=${g.a.document.id}`,
      '--json',
    ])
    assert.notEqual(done.exitCode, 1)
    assert.lengthOf(model.plans, 1)
    assert.equal((await Document.findOrFail(g.a.document.id)).currentVersionId, before)
    assert.equal((await CanvasGenerationRun.query()).length, 0)
    assert.equal((await exec(CanvasPlan, [`--workspace=${g.a.workspace.id}`])).exitCode, 1)
    assert.equal(
      (
        await exec(CanvasPlan, [
          `--workspace=${g.a.workspace.id}`,
          `--document=${g.a.document.id}`,
          '--depth=huge',
        ])
      ).exitCode,
      1
    )
  })

  test('canvas:generate --dry-run saves nothing; without it the canvas is a generated version', async ({
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    const args = [`--workspace=${g.a.workspace.id}`, `--document=${g.a.document.id}`]
    const before = (await Document.findOrFail(g.a.document.id)).currentVersionId
    const dry = await exec(CanvasGenerate, [...args, '--dry-run', '--json'])
    assert.notEqual(dry.exitCode, 1)
    assert.equal((await Document.findOrFail(g.a.document.id)).currentVersionId, before)
    assert.equal((await CanvasGenerationRun.query()).length, 0)
    assert.isAbove(model.calls.length, 4)

    const real = await exec(CanvasGenerate, [...args, '--depth=detailed'])
    assert.notEqual(real.exitCode, 1)
    const doc = await Document.findOrFail(g.a.document.id)
    assert.notEqual(doc.currentVersionId, before)
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    assert.equal(saved.source, 'generated')
    const run = await CanvasGenerationRun.findOrFail(saved.generationRunId!)
    assert.equal(run.status, 'ready')
    assert.equal(run.depth, 'detailed')
    assert.isNull(run.taskId)
    assert.equal((await exec(CanvasGenerate, [...args, '--pages=2'])).exitCode, 1)
    assert.equal((await exec(CanvasGenerate, [])).exitCode, 1)
  })
})

test.group('canvas:templates:seed', (group) => {
  group.each.setup(async () => {
    await reset()
    await db.rawQuery(
      "DELETE FROM canvas_templates WHERE workspace_id IS NULL AND category = 'academic'"
    )
    driveService.fake()
  })
  group.each.teardown(() => driveService.restore())

  test('it creates one system template per design, then leaves them alone', async ({ assert }) => {
    const first = await exec(CanvasTemplatesSeed, ['--no-previews'])
    assert.notEqual(first.exitCode, 1)
    const rows = await CanvasTemplate.query().whereNull('workspaceId').where('category', 'academic')
    assert.sameMembers(
      rows.map((r) => r.designId!),
      [...ACADEMIC_DESIGN_IDS]
    )
    for (const row of rows) {
      assert.equal(row.kind, 'sheet')
      assert.equal(row.version, 1)
      assert.lengthOf(row.project.sheets, 1)
      assert.exists((row.slots as { words?: unknown }).words, row.designId!)
    }
    const essay = rows.find((r) => r.designId === 'essay')!
    assert.sameMembers(Object.keys((essay.slots as { words: object }).words), [
      'concise',
      'standard',
      'detailed',
    ])
    const stamp = essay.updatedAt.toMillis()

    await exec(CanvasTemplatesSeed, ['--no-previews'])
    const again = await CanvasTemplate.query()
      .whereNull('workspaceId')
      .where('category', 'academic')
    assert.lengthOf(again, rows.length)
    assert.equal(again.find((r) => r.designId === 'essay')!.updatedAt.toMillis(), stamp)
    assert.isTrue(again.every((r) => r.version === 1))
  })

  test('a changed layout updates the template and bumps its version', async ({ assert }) => {
    await exec(CanvasTemplatesSeed, ['--no-previews'])
    await db.rawQuery(
      "UPDATE canvas_templates SET project_hash = repeat('0', 64) WHERE design_id = 'essay' AND workspace_id IS NULL"
    )
    await exec(CanvasTemplatesSeed, ['--no-previews'])
    const essay = await CanvasTemplate.query()
      .whereNull('workspaceId')
      .where('designId', 'essay')
      .firstOrFail()
    assert.equal(essay.version, 2)
    assert.notEqual(essay.projectHash, '0'.repeat(64))
    const others = await CanvasTemplate.query()
      .whereNull('workspaceId')
      .where('category', 'academic')
      .whereNot('designId', 'essay')
    assert.isTrue(others.every((r) => r.version === 1))
  })

  test('--dry-run writes nothing', async ({ assert }) => {
    const done = await exec(CanvasTemplatesSeed, ['--dry-run', '--no-previews'])
    assert.notEqual(done.exitCode, 1)
    assert.lengthOf(await CanvasTemplate.query().where('category', 'academic'), 0)
  })

  test('the names stay unique among system templates', async ({ assert }) => {
    await db.table('canvas_templates').insert({
      name: 'Essay',
      kind: 'sheet',
      design_id: 'article',
      schema_version: 1,
      project: JSON.stringify({
        schemaVersion: 1,
        sheets: [{ id: 's0', background: 'white', frames: [] }],
      }),
      project_hash: 'f'.repeat(64),
    })
    await exec(CanvasTemplatesSeed, ['--no-previews'])
    const essay = await CanvasTemplate.query()
      .whereNull('workspaceId')
      .where('designId', 'essay')
      .where('category', 'academic')
      .firstOrFail()
    assert.equal(essay.name, 'Academic Essay')
    await db.rawQuery("DELETE FROM canvas_templates WHERE name = 'Essay'")
  })

  test('previews are rendered when Chromium is available', async ({ assert }) => {
    if (!existsSync(chromium.executablePath())) return
    await exec(CanvasTemplatesSeed, [])
    const rows = await CanvasTemplate.query().whereNull('workspaceId').where('category', 'academic')
    for (const row of rows) {
      assert.match(row.previewKey!, /^canvas-templates\/academic\/.+\.v1\.png$/)
      const png = Buffer.from(await driveService.use().getBytes(row.previewKey!))
      assert.equal((await sharp(png).metadata()).format, 'png')
    }
  })
})

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
