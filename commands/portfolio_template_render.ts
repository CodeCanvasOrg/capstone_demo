import { readFile } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Renders the portfolio template's sample document, or your own content in the same shape,
 * through the export path: one PDF and one PNG per page, to compare with
 * docs/design/portfolio-template/preview/pw-*.png.
 */
export default class PortfolioTemplateRender extends BaseCommand {
  static commandName = 'portfolio:template:render'
  static description = 'Render the portfolio template sample to a PDF and PNG previews'

  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Directory for the output', default: 'output/portfolio-template' })
  declare out: string

  @flags.string({ description: 'JSON file with a PortfolioInput (default: the design sample)' })
  declare content?: string

  @flags.number({ description: 'PNG resolution in dpi', default: 90 })
  declare dpi: number

  async run() {
    const { default: PortfolioRenderService, sampleCanvas } =
      await import('#services/canvas/portfolio/portfolio_render_service')
    const { composePortfolio } = await import('../shared/canvas/portfolio/compose.ts')
    const { parseCanvas } = await import('../shared/canvas/model.ts')
    let canvas = sampleCanvas()
    if (this.content) {
      const raw = JSON.parse(await readFile(this.content, 'utf8'))
      raw.sources = new Map(Object.entries(raw.sources ?? {}))
      canvas = composePortfolio(raw)
    }
    const parsed = parseCanvas(canvas)
    if (!parsed.ok) {
      this.logger.error(`The composed canvas is not valid: ${JSON.stringify(parsed.problems)}`)
      this.exitCode = 1
      return
    }
    const { pdfPath, pngPaths } = await new PortfolioRenderService().write(
      canvas,
      this.out,
      this.dpi
    )
    this.logger.success(`PDF: ${pdfPath}`)
    for (const path of pngPaths) this.logger.success(`PNG: ${path}`)
  }
}
