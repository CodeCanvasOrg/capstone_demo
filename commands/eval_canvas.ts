import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

type Thresholds = {
  minWords: number
  minAvgFill: number
  maxAvgFill: number
  minCitations: number
  maxInventedFigures: number
  maxPlaceholders: number
}
type SourceSet = {
  name: string
  title: string
  brief: string
  files: string[]
  options: Record<string, unknown>
  sourcesCoverBrief: boolean
}
type Corpus = { thresholds: Thresholds; sets: SourceSet[] }

/**
 * Real-model evaluation of the canvas pipeline on the source sets in
 * tests/eval/canvas_density.json. For each set it prepares the PDFs in a throwaway
 * workspace (real extraction and embedding), runs the pipeline as `canvas:generate
 * --dry-run` does and checks the result against the thresholds. Calls the configured
 * models, so it costs credits, and writes rows: run it against a disposable database
 * (`DB_URL=$TEST_DB_URL node ace eval:canvas`). Exits 1 when a threshold fails.
 */
export default class EvalCanvas extends BaseCommand {
  static commandName = 'eval:canvas'
  static description = 'Evaluate canvas generation against a real model on the eval source sets'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Source sets JSON', default: 'tests/eval/canvas_density.json' })
  declare corpus: string
  @flags.string({ description: 'Only this source set' })
  declare set?: string
  @flags.boolean({ description: 'Print the report as JSON' })
  declare json?: boolean
  @flags.boolean({ description: 'Run against a database whose name does not end in _test' })
  declare force?: boolean

  async run() {
    const { default: app } = await import('@adonisjs/core/services/app')
    const { default: env } = await import('#start/env')
    const database = new URL(env.get('DB_URL') ?? 'postgres://x/unknown').pathname
    if (!this.force && !/_test$/.test(database)) {
      this.logger.error(
        `Refusing to write evaluation data to "${database.slice(1)}". Use DB_URL=$TEST_DB_URL, or --force.`
      )
      this.exitCode = 1
      return
    }
    const { default: drive } = await import('@adonisjs/drive/services/main')
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { default: WorkspaceService } = await import('#services/workspaces/workspace_service')
    const { default: AccessService } = await import('#services/workspaces/access_service')
    const { default: DocumentService } = await import('#services/documents/document_service')
    const { default: UploadService } = await import('#services/upload_service')
    const { default: TaskService } = await import('#services/workspaces/task_service')
    const { default: ProcessingService } = await import('#services/documents/processing_service')
    const { default: CanvasOperator } = await import('#services/canvas/generation/canvas_operator')
    const { default: CanvasPipeline } = await import('#services/canvas/generation/canvas_pipeline')
    const { default: CanvasGenerationService } =
      await import('#services/canvas/generation/canvas_generation_service')
    const { figureSupported } = await import('../shared/canvas/academic/content.ts')
    const { pageProblems } = await import('../shared/canvas/density.ts')
    const { randomUUID } = await import('node:crypto')

    const corpus = JSON.parse(await readFile(app.makePath(this.corpus), 'utf8')) as Corpus
    const sets = corpus.sets.filter((s) => !this.set || s.name === this.set)
    const t = corpus.thresholds
    drive.fake()
    const results = []
    try {
      for (const set of sets) {
        const user = await new WorkspaceService().register({
          email: `canvas-eval-${randomUUID()}@example.invalid`,
          password: randomUUID(),
        })
        const { context } = await new AccessService().resolve(user.id, user.lastWorkspaceId!)
        const ids: string[] = []
        for (const file of set.files) {
          const uploaded = await new UploadService().upload(context, {
            filename: path.basename(file),
            contents: await readFile(app.makePath(file)),
          })
          ids.push(uploaded.id)
        }
        // The queue's job registry is only loaded by the worker, the server and the tests, so
        // preparation runs here directly, as the ProcessFile job would run it.
        const ingests = await db
          .from('workspace_tasks')
          .where({ workspace_id: context.workspaceId, kind: 'ingest' })
          .select('id')
        for (const { id } of ingests) {
          const lease = await new TaskService().claim(id)
          if (lease) await new ProcessingService().processRun(lease)
        }
        const document = await new DocumentService().create(
          context,
          { title: set.title, description: set.brief, sourceMode: 'files' },
          ids
        )
        const input = await new CanvasOperator().inputs(context, document.id)
        const options = new CanvasGenerationService().options(set.options)
        if (input.pins.length !== set.files.length) {
          // Nothing to evaluate without sources: say why the files were not prepared.
          const runs = await db
            .from('processing_runs')
            .where('workspace_id', context.workspaceId)
            .select('status', 'error')
          const tasks = await db
            .from('workspace_tasks')
            .where('workspace_id', context.workspaceId)
            .select('kind', 'status', 'attempts', 'safe_error')
          const intents = await db.from('task_dispatches').select('attempts', 'safe_error')
          this.logger.error(
            `${set.name}: ${input.pins.length} of ${set.files.length} sources were prepared. Processing runs: ${JSON.stringify(runs)}. Tasks: ${JSON.stringify(tasks)}. Dispatch: ${JSON.stringify(intents)}`
          )
          this.exitCode = 1
          await db
            .from('users')
            .where('id', user.id)
            .delete()
            .catch(() => {})
          continue
        }
        this.logger.info(`${set.name}: generating with ${input.pins.length} prepared source(s)`)
        const generated = await new CanvasPipeline().generate({
          context,
          documentId: document.id,
          title: input.title,
          brief: input.brief,
          pins: input.pins,
          options,
          guard: async () => {},
        })

        const content = generated.report.pages.filter((p) => p.kind === 'content')
        const invented = generated.pages.flatMap((row) =>
          ((row.content as { figures?: { value: string }[] } | null)?.figures ?? []).filter(
            (f) =>
              !figureSupported(
                f.value,
                row.citedChunkIds.map((id) => generated.evidence[id]).filter(Boolean)
              )
          )
        )
        const checks = [
          ['every content page has at least minWords', content.every((p) => p.words >= t.minWords)],
          [
            'average fill is within the band',
            generated.report.avgFill >= t.minAvgFill && generated.report.avgFill <= t.maxAvgFill,
          ],
          [
            'every content page cites at least minCitations',
            content.every((p) => p.citations >= t.minCitations),
          ],
          ['no invented figures', invented.length <= t.maxInventedFigures],
          [
            'placeholders within the limit',
            !set.sourcesCoverBrief || generated.report.placeholders <= t.maxPlaceholders,
          ],
        ] as const
        results.push({
          set: set.name,
          options,
          metrics: generated.metrics,
          pages: generated.report.pages.map((p) => ({
            page: p.index + 1,
            kind: p.kind,
            words: p.words,
            fill: p.fill,
            citations: p.citations,
            placeholders: p.placeholders,
          })),
          problems: generated.report.pages.flatMap((p) => pageProblems(p)),
          coverageGaps: generated.plan.coverageGaps,
          maxOverlap: generated.report.maxOverlap,
          checks: checks.map(([name, ok]) => ({ name, ok })),
        })
        await db
          .from('users')
          .where('id', user.id)
          .delete()
          .catch(() => {})
      }
    } finally {
      drive.restore()
    }
    const failed = results.some((r) => r.checks.some((c) => !c.ok))
    if (failed) this.exitCode = 1
    if (this.json) {
      this.logger.log(JSON.stringify({ thresholds: t, ok: !failed, results }, null, 2))
      return
    }
    for (const r of results) {
      this.logger.log('')
      this.logger.log(this.colors.bold(r.set))
      this.logger.log(
        `  ${r.metrics.pages} pages, ${r.metrics.words} words, average fill ${Math.round(r.metrics.avgFill * 100)}%, ${r.metrics.citations} citations, ${r.metrics.placeholders} placeholders, ${Math.round(r.metrics.durationMs / 1000)} s, ~${r.metrics.tokens} tokens`
      )
      for (const p of r.pages)
        this.logger.log(
          `  page ${p.page}  ${p.kind.padEnd(10)} ${String(p.words).padStart(4)} words  fill ${
            p.fill === null ? '   -' : `${String(Math.round(p.fill * 100)).padStart(3)}%`
          }  ${p.citations} cited  ${p.placeholders} placeholders`
        )
      for (const c of r.checks)
        this.logger.log(
          c.ok ? this.colors.green(`  pass  ${c.name}`) : this.colors.red(`  FAIL  ${c.name}`)
        )
      for (const gap of r.coverageGaps) this.logger.warning(`  not covered by the sources: ${gap}`)
    }
  }
}
