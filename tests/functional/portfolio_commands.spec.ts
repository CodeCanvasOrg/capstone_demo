/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import driveService from '@adonisjs/drive/services/main'
import sharp from 'sharp'
import CanvasGenerationRun from '#models/canvas_generation_run'
import CanvasTemplate from '#models/canvas_template'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import CanvasGenerationService from '#services/canvas/generation/canvas_generation_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import CanvasDensity from '../../commands/canvas_density.ts'
import CanvasGenerate from '../../commands/canvas_generate.ts'
import CanvasPlan from '../../commands/canvas_plan.ts'
import CanvasTemplatesSeed from '../../commands/canvas_templates_seed.ts'
import PortfolioTemplateCheck from '../../commands/portfolio_template_check.ts'
import PortfolioTemplateRender from '../../commands/portfolio_template_render.ts'
import PortfolioTemplateSeed from '../../commands/portfolio_template_seed.ts'
import { account, reset } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

async function exec(Command: any, args: string[]) {
  ace.ui.switchMode('raw')
  const command = await ace.create(Command, args)
  await command.exec()
  return command as { exitCode?: number; logger: { getLogs(): { message: string }[] } }
}

test.group('canvas:density, canvas:plan and canvas:generate', (group) => {
  group.each.setup(reset)
  let model: ReturnType<typeof installPortfolioModel>
  group.each.teardown(() => {
    model?.restore()
    flagsOff()
  })

  async function withCanvas() {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    await new CanvasGenerationService().request(g.a.context, g.a.document.id, {
      mutationId: randomUUID(),
      baseVersionId: g.baseVersionId,
      options: new CanvasGenerationService().options({}),
    })
    await new TaskDispatchService().dispatch()
    return g
  }

  test('canvas:density needs a workspace', async ({ assert }) => {
    assert.equal((await exec(CanvasDensity, [])).exitCode, 1)
    assert.equal((await exec(CanvasDensity, ['--workspace=x', '--min-fill=9'])).exitCode, 1)
  })

  test('canvas:density passes a well filled portfolio and fails one under the thresholds', async ({
    assert,
  }) => {
    const g = await withCanvas()
    const ws = `--workspace=${g.a.workspace.id}`
    assert.notEqual((await exec(CanvasDensity, [ws])).exitCode, 1)
    const one = await exec(CanvasDensity, [ws, `--document=${g.a.document.id}`, '--json'])
    assert.notEqual(one.exitCode, 1)
    const json = JSON.parse(one.logger.getLogs().at(-1)!.message)
    const kinds = json.documents[0].report.pages.map((p: { portfolio: string }) => p.portfolio)
    assert.deepEqual(kinds, ['cover', 'entry', 'sources', 'entry', 'sources'])
    assert.equal((await exec(CanvasDensity, [ws, '--min-fill=1.2'])).exitCode, 1)
  })

  test('a workspace with no canvas documents passes and reports nothing', async ({ assert }) => {
    model = installPortfolioModel()
    await portfolioGeneratable()
    const other = await account('carol@example.test')
    const done = await exec(CanvasDensity, [`--workspace=${other.workspace.id}`])
    assert.notEqual(done.exitCode, 1)
  })

  test('canvas:plan prints the entries and each one’s coverage and saves nothing', async ({
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const before = (await Document.findOrFail(g.a.document.id)).currentVersionId
    const done = await exec(CanvasPlan, [
      `--workspace=${g.a.workspace.id}`,
      `--document=${g.a.document.id}`,
      '--json',
    ])
    assert.notEqual(done.exitCode, 1)
    const report = JSON.parse(done.logger.getLogs().at(-1)!.message)
    assert.lengthOf(report.entries, 2)
    assert.lengthOf(report.coverage, 2)
    assert.equal((await Document.findOrFail(g.a.document.id)).currentVersionId, before)
    assert.equal((await CanvasGenerationRun.query()).length, 0)
    assert.equal((await exec(CanvasPlan, [`--workspace=${g.a.workspace.id}`])).exitCode, 1)
    const bad = await exec(CanvasPlan, [
      `--workspace=${g.a.workspace.id}`,
      `--document=${g.a.document.id}`,
      '--depth=huge',
    ])
    assert.equal(bad.exitCode, 1)
  })

  test('canvas:generate --dry-run saves nothing; without it the portfolio is a generated version', async ({
    assert,
  }) => {
    model = installPortfolioModel({ entries: 2 })
    const g = await portfolioGeneratable()
    const args = [`--workspace=${g.a.workspace.id}`, `--document=${g.a.document.id}`]
    const before = (await Document.findOrFail(g.a.document.id)).currentVersionId
    const dry = await exec(CanvasGenerate, [...args, '--dry-run', '--json'])
    assert.notEqual(dry.exitCode, 1)
    assert.equal((await Document.findOrFail(g.a.document.id)).currentVersionId, before)
    assert.equal((await CanvasGenerationRun.query()).length, 0)
    assert.isAtLeast(model.calls.length, 4)

    const real = await exec(CanvasGenerate, [...args, '--depth=detailed', '--entries=1'])
    assert.notEqual(real.exitCode, 1)
    const doc = await Document.findOrFail(g.a.document.id)
    assert.notEqual(doc.currentVersionId, before)
    const saved = await DocumentCanvas.query()
      .where('versionId', doc.currentVersionId!)
      .firstOrFail()
    assert.equal(saved.source, 'generated')
    assert.equal(saved.templateKey, 'portfolio')
    const run = await CanvasGenerationRun.findOrFail(saved.generationRunId!)
    assert.equal(run.status, 'ready')
    assert.equal(run.depth, 'detailed')
    assert.equal(run.templateSet, 'portfolio')
    assert.equal(run.pipelineVersion, 'portfolio-1')
    assert.isNull(run.taskId)
    assert.equal((await exec(CanvasGenerate, [...args, '--entries=9'])).exitCode, 1)
    assert.equal((await exec(CanvasGenerate, [])).exitCode, 1)
  })
})

test.group('portfolio:template:seed', (group) => {
  group.each.setup(async () => {
    await reset()
    await db.rawQuery(
      "DELETE FROM canvas_templates WHERE workspace_id IS NULL AND category <> 'brochure'"
    )
    driveService.fake()
  })
  group.each.teardown(() => driveService.restore())

  const system = () =>
    CanvasTemplate.query()
      .whereNull('workspaceId')
      .where('category', 'portfolio')
      .orderBy('designId')

  test('it creates the document template and one sheet template per page design, then leaves them alone', async ({
    assert,
  }) => {
    const first = await exec(PortfolioTemplateSeed, ['--no-previews'])
    assert.notEqual(first.exitCode, 1)
    const rows = await system()
    assert.sameMembers(
      rows.map((r) => r.designId!),
      ['portfolio', 'cover', 'entry', 'sources']
    )
    for (const row of rows) {
      assert.equal(row.templateKey, 'portfolio')
      assert.equal(row.version, 1)
      assert.isNull(row.retiredAt)
      assert.deepEqual(row.project.template, { id: 'portfolio', version: 1 })
      assert.exists((row.slots as { designs?: unknown }).designs, row.designId!)
    }
    assert.equal(rows.find((r) => r.designId === 'portfolio')!.kind, 'document')
    assert.lengthOf(rows.find((r) => r.designId === 'portfolio')!.project.sheets, 3)
    for (const design of ['cover', 'entry', 'sources'])
      assert.lengthOf(rows.find((r) => r.designId === design)!.project.sheets, 1)
    const again = await exec(PortfolioTemplateSeed, ['--no-previews'])
    assert.notEqual(again.exitCode, 1)
    assert.isTrue((await system()).every((r) => r.version === 1))
    assert.lengthOf(await system(), 4)
  })

  test('the academic system templates are retired, not deleted, and no longer offered', async ({
    assert,
  }) => {
    const [row] = await db
      .table('canvas_templates')
      .insert({
        name: 'Essay',
        kind: 'sheet',
        design_id: 'essay',
        category: 'academic',
        schema_version: 1,
        project: JSON.stringify({
          schemaVersion: 1,
          sheets: [{ id: 's0', background: 'white', frames: [] }],
        }),
        project_hash: 'f'.repeat(64),
      })
      .returning('id')
    await exec(PortfolioTemplateSeed, ['--no-previews'])
    const academic = await CanvasTemplate.findOrFail(row.id)
    assert.exists(academic.retiredAt)
    const visible = await CanvasTemplate.query().withScopes((s) => s.visibleTo(randomUUID()))
    assert.isFalse(visible.some((t) => t.id === academic.id))
    assert.isTrue(visible.some((t) => t.designId === 'portfolio'))
  })

  test('a changed layout updates the template and bumps its version', async ({ assert }) => {
    await exec(PortfolioTemplateSeed, ['--no-previews'])
    await db.rawQuery(
      "UPDATE canvas_templates SET project_hash = repeat('0', 64) WHERE design_id = 'entry' AND workspace_id IS NULL"
    )
    await exec(PortfolioTemplateSeed, ['--no-previews'])
    const rows = await system()
    const entry = rows.find((r) => r.designId === 'entry')!
    assert.equal(entry.version, 2)
    assert.notEqual(entry.projectHash, '0'.repeat(64))
    assert.isTrue(rows.filter((r) => r.designId !== 'entry').every((r) => r.version === 1))
  })

  test('--dry-run writes nothing, and the old command name is an alias', async ({ assert }) => {
    assert.notEqual((await exec(PortfolioTemplateSeed, ['--dry-run', '--no-previews'])).exitCode, 1)
    assert.lengthOf(await system(), 0)
    assert.notEqual((await exec(CanvasTemplatesSeed, ['--no-previews'])).exitCode, 1)
    assert.lengthOf(await system(), 4)
  })

  test('previews are rendered when Chromium is available', async ({ assert }) => {
    if (!existsSync(chromium.executablePath())) return
    await exec(PortfolioTemplateSeed, [])
    for (const row of await system()) {
      assert.match(row.previewKey!, /^canvas-templates\/portfolio\/.+\.v1\.png$/)
      const png = Buffer.from(await driveService.use().getBytes(row.previewKey!))
      assert.equal((await sharp(png).metadata()).format, 'png')
    }
  })
})

test.group('portfolio:template:render and portfolio:template:check', () => {
  test('render writes the sample PDF and one PNG per page', async ({ assert }) => {
    if (!existsSync(chromium.executablePath())) return
    const out = await mkdtemp(join(tmpdir(), 'portfolio-render-'))
    try {
      const done = await exec(PortfolioTemplateRender, [`--out=${out}`])
      assert.notEqual(done.exitCode, 1)
      const pdf = await readFile(join(out, 'portfolio-sample.pdf'))
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
      for (const n of [1, 2, 3]) {
        const meta = await sharp(await readFile(join(out, `page-${n}.png`))).metadata()
        assert.equal(meta.width, 744)
        assert.equal(meta.height, 1053)
      }
    } finally {
      await rm(out, { recursive: true, force: true })
    }
  }).timeout(60_000)

  test('check measures every slot against tokens.json and reports no drift on the sample', async ({
    assert,
  }) => {
    if (!existsSync(chromium.executablePath())) return
    const done = await exec(PortfolioTemplateCheck, ['--json', '--tolerance=1'])
    assert.notEqual(done.exitCode, 1)
    const report = JSON.parse(done.logger.getLogs().at(-1)!.message)
    assert.equal(report.checked, 78)
    assert.deepEqual(report.failures, [])
    assert.isTrue(report.ok)
    for (const page of report.visual) assert.isTrue(page.ok, `${page.page} ${page.differing}`)
  }).timeout(90_000)
})
