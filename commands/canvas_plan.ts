import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Stages 1 and 2 of the canvas pipeline only: the plan, and what each page's
 * retrieval finds (chunks, tokens, files). Calls the planner model; saves nothing.
 * For tuning prompts and checking that the sources cover the plan.
 */
export default class CanvasPlan extends BaseCommand {
  static commandName = 'canvas:plan'
  static description = 'Print the canvas plan and each page’s retrieval coverage (saves nothing)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Document UUID' })
  declare document: string
  @flags.string({ description: 'academic | informative', default: 'academic' })
  declare profile: string
  @flags.string({ description: 'concise | standard | detailed', default: 'standard' })
  declare depth: string
  @flags.string({
    description: 'academic_report | research_brief | brochure',
    default: 'academic_report',
  })
  declare templateSet: string
  @flags.string({ description: 'auto, or a page count from 3 to 16', default: 'auto' })
  declare pages: string
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
    const { default: CanvasPlanner } = await import('#services/canvas/generation/canvas_planner')
    const { default: RetrievalService } = await import('#services/documents/retrieval_service')
    const { pageQueries } = await import('#services/canvas/generation/page_queries')
    const { DEPTH_TOKENS } = await import('../shared/canvas/academic/designs.ts')
    const { countTokens } = await import('gpt-tokenizer')

    let options
    try {
      options = new CanvasGenerationService().options({
        profile: this.profile,
        depth: this.depth,
        templateSet: this.templateSet,
        pages: this.pages === 'auto' ? 'auto' : Number(this.pages),
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
    const planned = await new CanvasPlanner().plan({
      context,
      documentId: input.document.id,
      pins: input.pins,
      title: input.title,
      brief: input.brief,
      options,
      guard,
    })
    const writable = planned.pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => page.design !== 'contents' && page.design !== 'references')
    const queries = pageQueries(
      writable.map((w) => w.page),
      input.title,
      input.brief
    ).map((q, n) => ({ ...q, key: String(writable[n].index) }))
    const found = await new RetrievalService().searchPages({
      context,
      documentId: input.document.id,
      pins: input.pins,
      guard,
      pages: queries,
      tokenBudget: DEPTH_TOKENS[options.depth],
    })
    const coverage = found.map((f) => {
      const page = planned.pages[Number(f.key)]
      return {
        page: Number(f.key) + 1,
        design: page.design,
        title: page.title,
        chunks: f.chunks.length,
        tokens: f.chunks.reduce((n, c) => n + countTokens(`${c.fileName}\n${c.content}`), 0),
        files: [...new Set(f.chunks.map((c) => c.fileName))],
        images: f.images.length,
      }
    })
    const report = {
      thesis: planned.thesis,
      audience: planned.audience,
      coverageGaps: planned.coverageGaps,
      pages: planned.pages.map((p, i) => ({
        page: i + 1,
        design: p.design,
        title: p.title,
        purpose: p.purpose,
        questions: p.questions,
      })),
      coverage,
    }
    if (this.json) {
      this.logger.log(JSON.stringify(report, null, 2))
      return
    }
    this.logger.log(this.colors.bold(`Thesis: ${planned.thesis}`))
    this.logger.log(`Audience: ${planned.audience}`)
    for (const p of report.pages) {
      const c = coverage.find((x) => x.page === p.page)
      this.logger.log(
        `  ${String(p.page).padStart(2)}  ${p.design.padEnd(14)} ${p.title}${
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
