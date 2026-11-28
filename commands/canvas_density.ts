import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Quality report for canvas documents: words, fill, citations, placeholders and
 * low-resolution pictures on every content page. Exits 1 when any content page is
 * under a threshold, so it works as a gate. Read-only.
 */
export default class CanvasDensity extends BaseCommand {
  static commandName = 'canvas:density'
  static description =
    'Report words, fill, citations and image resolution per canvas page; exits 1 below thresholds'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Only this document (UUID)' })
  declare document?: string
  @flags.number({ description: 'Fewest words on a content page', default: 280 })
  declare minWords: number
  @flags.number({ description: 'Lowest fill of a content page, 0 to 1', default: 0.7 })
  declare minFill: number
  @flags.boolean({ description: 'Print the report as JSON' })
  declare json?: boolean

  async run() {
    if (!this.workspace) {
      this.logger.error('--workspace is required')
      this.exitCode = 1
      return
    }
    if (!(this.minWords >= 0) || !(this.minFill >= 0 && this.minFill <= 1.5)) {
      this.logger.error('--min-words must be 0 or more and --min-fill between 0 and 1.5')
      this.exitCode = 1
      return
    }
    const { default: CanvasOperator } = await import('#services/canvas/generation/canvas_operator')
    const { DEFAULT_THRESHOLDS, pageProblems } = await import('../shared/canvas/density.ts')
    const { PORTFOLIO_THRESHOLDS, portfolioProblems } =
      await import('../shared/canvas/portfolio/quality.ts')
    const thresholds = { ...DEFAULT_THRESHOLDS, minWords: this.minWords, minFill: this.minFill }
    const operator = new CanvasOperator()
    const documents = await operator.canvasDocuments(this.workspace, this.document)
    const reports = []
    for (const document of documents) {
      const report = await operator.density(document)
      if (!report) continue
      // A portfolio's entry pages are measured by their rows; words are not a threshold there.
      const problems = report.pages.flatMap((page) =>
        'portfolio' in page
          ? portfolioProblems(page as never, { ...PORTFOLIO_THRESHOLDS, minFill: this.minFill })
          : pageProblems(page, thresholds)
      )
      reports.push({ documentId: document.id, title: document.title, report, problems })
    }
    const failing = reports.some((r) => r.problems.length)
    if (failing) this.exitCode = 1

    if (this.json) {
      this.logger.log(JSON.stringify({ thresholds, ok: !failing, documents: reports }, null, 2))
      return
    }
    if (!reports.length) {
      this.logger.info('No documents with a saved canvas are open in the canvas editor.')
      return
    }
    for (const { documentId, title, report, problems } of reports) {
      this.logger.log('')
      this.logger.log(this.colors.bold(`${title}  (${documentId})`))
      this.logger.log(
        `  ${report.pages.length} pages, ${report.words} words, average fill ${Math.round(report.avgFill * 100)}%, ${report.citations} citations, ${report.placeholders} placeholders, ${report.lowDpiImages} low-resolution images`
      )
      for (const page of report.pages)
        this.logger.log(
          `  page ${page.index + 1}  ${('portfolio' in page && page.portfolio ? String(page.portfolio) : page.kind).padEnd(10)} ${String(page.words).padStart(4)} words  fill ${
            page.fill === null ? '   -' : `${String(Math.round(page.fill * 100)).padStart(3)}%`
          }  ${page.citations} cited`
        )
      if (report.maxOverlap > 0.15)
        this.logger.warning(
          `  ${Math.round(report.maxOverlap * 100)}% of a page's phrases repeat an earlier page`
        )
      for (const p of problems) this.logger.log(this.colors.red(`  page ${p.page}: ${p.message}`))
    }
    if (failing) this.logger.error('Some pages are under the thresholds.')
    else this.logger.success('Every content page meets the thresholds.')
  }
}
