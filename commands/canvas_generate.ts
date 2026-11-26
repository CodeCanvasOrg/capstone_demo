import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Runs the whole portfolio pipeline for one document, synchronously, in this process:
 * for operators and for debugging prompts. With --dry-run it prints the plan, the
 * pages and the quality metrics and saves nothing (the eval in tests/eval uses this);
 * without it the result is saved as a new version, exactly as the "Generate pages"
 * button would.
 */
export default class CanvasGenerate extends BaseCommand {
  static commandName = 'canvas:generate'
  static description =
    'Generate a document’s canvas pages now; --dry-run prints metrics and saves nothing'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Document UUID' })
  declare document: string
  @flags.string({ description: 'concise | standard | detailed', default: 'standard' })
  declare depth: string
  @flags.string({ description: 'auto, or the number of entries from 1 to 6', default: 'auto' })
  declare entries: string
  @flags.boolean({
    description: 'Place pictures beside the entries (--no-images skips them)',
    default: true,
    showNegatedVariantInHelp: true,
  })
  declare images: boolean
  @flags.boolean({ description: 'Generate and print metrics, but save nothing' })
  declare dryRun?: boolean
  @flags.boolean({ description: 'Print the report as JSON' })
  declare json?: boolean

  async run() {
    if (!this.workspace || !this.document) {
      this.logger.error('--workspace and --document are required')
      this.exitCode = 1
      return
    }
    const { default: CanvasGenerationService } =
      await import('#services/canvas/generation/canvas_generation_service')
    const { default: CanvasOperator } = await import('#services/canvas/generation/canvas_operator')
    const { default: CanvasPipeline } = await import('#services/canvas/generation/canvas_pipeline')
    const { portfolioProblems, portfolioReport } =
      await import('../shared/canvas/portfolio/quality.ts')

    let options
    try {
      options = new CanvasGenerationService().options({
        depth: this.depth,
        entries: this.entries === 'auto' ? 'auto' : Number(this.entries),
        images: this.images,
      })
    } catch (error) {
      this.logger.error((error as Error).message)
      this.exitCode = 1
      return
    }
    const operator = new CanvasOperator()
    const context = await operator.context(this.workspace)
    const input = await operator.inputs(context, this.document)
    const generated = await new CanvasPipeline().generate({
      context,
      documentId: input.document.id,
      title: input.title,
      brief: input.brief,
      pins: input.pins,
      options,
      guard: async () => {},
    })
    const report = portfolioReport(generated.canvas)
    const problems = report.pages.flatMap((page) => portfolioProblems(page))
    let versionId: string | null = null
    if (!this.dryRun) {
      const saved = await operator.save(context, input.document, generated, options)
      versionId = saved.version.id
    }

    if (this.json) {
      this.logger.log(
        JSON.stringify(
          {
            dryRun: !!this.dryRun,
            versionId,
            options,
            models: generated.models,
            metrics: generated.metrics,
            density: report,
            problems,
            plan: generated.plan,
          },
          null,
          2
        )
      )
      return
    }
    const m = generated.metrics
    this.logger.log(
      this.colors.bold(
        `${input.title}  (${this.dryRun ? 'dry run, nothing saved' : `saved as ${versionId}`})`
      )
    )
    this.logger.log(
      `  ${m.pages} pages, ${m.words} words, average fill ${Math.round(m.avgFill * 100)}%, ${m.citations} citations, ${m.placeholders} placeholders, ${m.lowDpiImages} low-resolution images, ${Math.round(m.durationMs / 1000)} s, ~${m.tokens} tokens`
    )
    for (const page of report.pages)
      this.logger.log(
        `  page ${page.index + 1}  ${(page.portfolio ?? 'page').padEnd(10)} ${String(page.words).padStart(4)} words  fill ${
          page.fill === null ? '   -' : `${String(Math.round(page.fill * 100)).padStart(3)}%`
        }  ${page.citations} cited`
      )
    for (const p of problems) this.logger.warning(`  page ${p.page}: ${p.message}`)
    for (const gap of generated.plan.coverageGaps)
      this.logger.warning(`  not covered by the sources: ${gap}`)
  }
}
