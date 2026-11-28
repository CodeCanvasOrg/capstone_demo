import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Compares the rendered sample with the design: the measured box of every slot against
 * docs/design/portfolio-template/tokens.json, and each page against the design's PNG preview.
 * Prints the drift and exits non-zero when a slot is beyond tolerance or a page differs too much.
 */
export default class PortfolioTemplateCheck extends BaseCommand {
  static commandName = 'portfolio:template:check'
  static description =
    'Check the rendered portfolio template against the design tokens and previews'

  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Allowed drift of a slot box in points', default: 1 })
  declare tolerance: number

  @flags.boolean({ description: 'Print the result as JSON' })
  declare json?: boolean

  @flags.boolean({ description: 'Skip the pixel comparison with the preview PNGs' })
  declare skipVisual?: boolean

  async run() {
    const { default: PortfolioCheckService } =
      await import('#services/canvas/portfolio/portfolio_check_service')
    const service = new PortfolioCheckService()
    const geometry = await service.geometry(this.tolerance)
    const visual = this.skipVisual ? [] : await service.visual()
    const failed = geometry.failures.length > 0 || visual.some((v) => !v.ok)
    if (this.json) {
      this.logger.log(JSON.stringify({ ...geometry, visual, ok: !failed }, null, 2))
    } else {
      this.logger.info(`${geometry.checked} slots measured, ${geometry.drift.length} with drift`)
      for (const d of geometry.drift)
        this.logger.log(
          `${d.page.padEnd(8)} ${d.slot.padEnd(34)} ${d.metric.padEnd(5)} expected ${d.expected} got ${d.actual} (${d.delta > 0 ? '+' : ''}${d.delta})`
        )
      for (const v of visual)
        this.logger[v.ok ? 'success' : 'error'](
          `${v.page}: ${(v.differing * 100).toFixed(2)}% of pixels differ (limit ${(v.tolerance * 100).toFixed(1)}%)`
        )
      if (!failed) this.logger.success('The portfolio template matches the design.')
    }
    if (failed) this.exitCode = 1
  }
}
