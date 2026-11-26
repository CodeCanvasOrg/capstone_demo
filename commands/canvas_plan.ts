import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Stages 1 and 2 of the portfolio pipeline only: the plan, and what each entry's
 * retrieval finds (chunks, tokens, files). Calls the planner model; saves nothing.
 * For tuning prompts and checking that the sources cover the plan.
 */
export default class CanvasPlan extends BaseCommand {
  static commandName = 'canvas:plan'
  static description =
    'Print the portfolio plan and each entry’s retrieval coverage (saves nothing)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Document UUID' })
  declare document: string
  @flags.string({ description: 'concise | standard | detailed', default: 'standard' })
  declare depth: string
  @flags.string({ description: 'auto, or the number of entries from 1 to 6', default: 'auto' })
  declare entries: string
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
    const { default: PortfolioPlanner } =
      await import('#services/canvas/portfolio/portfolio_planner')
    const { default: RetrievalService } = await import('#services/documents/retrieval_service')
    const { entryQueries } = await import('#services/canvas/portfolio/portfolio_pipeline')
    const { DEPTH_TOKENS } = await import('../shared/canvas/academic/designs.ts')
    const { countTokens } = await import('gpt-tokenizer')

    let options
    try {
      options = new CanvasGenerationService().options({
        depth: this.depth,
        entries: this.entries === 'auto' ? 'auto' : Number(this.entries),
      })
    } catch (error) {
      this.logger.error((error as Error).message)
      this.exitCode = 1
      return
    }
    const operator = new CanvasOperator()
    const context = await operator.context(this.workspace)
    const input = await operator.inputs(context, this.document)
    const guard = async () => {}
    const planned = await new PortfolioPlanner().plan({
      context,
      documentId: input.document.id,
      pins: input.pins,
      title: input.title,
      brief: input.brief,
      options,
      guard,
    })
    const found = await new RetrievalService().searchPages({
      context,
      documentId: input.document.id,
      pins: input.pins,
      guard,
      pages: entryQueries(planned.entries, input.title, input.brief),
      tokenBudget: DEPTH_TOKENS[options.depth],
    })
    const coverage = found.map((f) => ({
      entry: Number(f.key) + 1,
      title: planned.entries[Number(f.key)].title,
      chunks: f.chunks.length,
      tokens: f.chunks.reduce((n, c) => n + countTokens(`${c.fileName}\n${c.content}`), 0),
      files: [...new Set(f.chunks.map((c) => c.fileName))],
      images: f.images.length,
    }))
    const report = {
      title: planned.title,
      thesis: planned.thesis,
      audience: planned.audience,
      coverageGaps: planned.coverageGaps,
      entries: planned.entries.map((e, i) => ({
        entry: i + 1,
        title: e.title,
        category: e.category,
        purpose: e.purpose,
        questions: e.questions,
      })),
      coverage,
    }
    if (this.json) {
      this.logger.log(JSON.stringify(report, null, 2))
      return
    }
    this.logger.log(this.colors.bold(`${planned.title}: ${planned.thesis}`))
    this.logger.log(`Audience: ${planned.audience}`)
    for (const e of report.entries) {
      const c = coverage.find((x) => x.entry === e.entry)
      this.logger.log(
        `  ${String(e.entry).padStart(2)}  ${e.category.padEnd(18)} ${e.title}${
          c
            ? `  [${c.chunks} chunks, ${c.tokens} tokens, ${c.files.length} files, ${c.images} images]`
            : ''
        }`
      )
    }
    for (const gap of planned.coverageGaps)
      this.logger.warning(`Not covered by the sources: ${gap}`)
  }
}
