import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Builds the thumb, screen and print copies, the focal point and the perceptual
 * hash of document images uploaded before they were made. Safe to run again: only
 * images with no print copy are read. Run it after deploying the variants migration.
 */
export default class ImagesOptimize extends BaseCommand {
  static commandName = 'images:optimize'
  static description =
    'Build image variants (thumb/screen/print), focal points and hashes for images without them'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Most images to process in one run', default: 500 })
  declare limit: number
  @flags.boolean({ description: 'Count what would be built, but write nothing' })
  declare dryRun?: boolean

  async run() {
    if (!Number.isInteger(this.limit) || this.limit < 1) {
      this.logger.error('--limit must be a positive whole number')
      this.exitCode = 1
      return
    }
    const { default: ImageVariantService } =
      await import('#services/documents/image_variant_service')
    const result = await new ImageVariantService().backfill({
      limit: this.limit,
      dryRun: !!this.dryRun,
    })
    if (this.dryRun) this.logger.info(`Would build variants for ${result.checked} images.`)
    else this.logger.success(`Built variants for ${result.built} of ${result.checked} images.`)
    if (result.failed.length) {
      this.logger.warning(`Could not process ${result.failed.length}: ${result.failed.join(', ')}`)
      this.exitCode = 1
    }
    if (result.checked === this.limit) this.logger.info('More may remain: run it again.')
  }
}
