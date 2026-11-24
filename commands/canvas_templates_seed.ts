import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Upserts the system academic templates (one per academic design) into
 * `canvas_templates`, so the template picker and gallery can show them. Idempotent:
 * a template whose layout has not changed is left alone; one whose layout hash
 * changed is updated and its version bumped, so a canvas pinned to the old version
 * never changes under it. Thumbnails are rendered with Chromium when it is available.
 */
export default class CanvasTemplatesSeed extends BaseCommand {
  static commandName = 'canvas:templates:seed'
  static description = 'Create or update the system academic canvas templates (idempotent)'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Print what would change, but write nothing' })
  declare dryRun?: boolean
  @flags.boolean({
    description: 'Render preview thumbnails with Chromium (--no-previews skips them)',
    default: true,
    showNegatedVariantInHelp: true,
  })
  declare previews: boolean

  async run() {
    const { default: CanvasTemplateSeeder } =
      await import('#services/canvas/canvas_template_seeder')
    const results = await new CanvasTemplateSeeder().seed({
      dryRun: !!this.dryRun,
      previews: this.previews,
    })
    for (const r of results)
      this.logger.log(
        `${r.action.padEnd(9)} ${r.design.padEnd(14)} v${r.version}${r.preview ? '  preview' : ''}`
      )
    const changed = results.filter((r) => r.action !== 'unchanged').length
    const verb = this.dryRun ? 'Would change' : 'Changed'
    this.logger.success(`${verb} ${changed} of ${results.length} templates.`)
  }
}
