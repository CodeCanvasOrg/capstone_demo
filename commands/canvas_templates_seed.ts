import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/** The old name of `portfolio:template:seed`, kept so scripts and runbooks keep working. */
export default class CanvasTemplatesSeed extends BaseCommand {
  static commandName = 'canvas:templates:seed'
  static description = 'Alias of portfolio:template:seed'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Print what would change, but write nothing' })
  declare dryRun?: boolean
  @flags.boolean({ default: true, showNegatedVariantInHelp: true, description: 'Render previews' })
  declare previews: boolean

  async run() {
    await this.kernel.exec('portfolio:template:seed', [
      ...(this.dryRun ? ['--dry-run'] : []),
      ...(this.previews ? [] : ['--no-previews']),
    ])
  }
}
