import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Records the pixel size of document images uploaded before sizes were kept,
 * so the canvas can fit boxes to them. Safe to run again: only images without
 * a size are read.
 */
export default class ImagesMeasure extends BaseCommand {
  static commandName = 'images:measure'
  static description = 'Fill in the width and height of document images uploaded without them'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Most images to read in one run', default: 500 })
  declare limit: number
  @flags.boolean({ description: 'Read and report, but write nothing' })
  declare dryRun?: boolean

  async run() {
    if (!Number.isInteger(this.limit) || this.limit < 1) {
      this.logger.error('--limit must be a positive whole number')
      this.exitCode = 1
      return
    }
    const { default: DocumentImageService } =
      await import('#services/documents/document_image_service')
    const result = await new DocumentImageService().measureMissing({
      limit: this.limit,
      dryRun: !!this.dryRun,
    })
    const verb = this.dryRun ? 'Would measure' : 'Measured'
    this.logger.success(`${verb} ${result.measured} of ${result.checked} images without a size.`)
    if (result.unreadable.length) {
      this.logger.warning(
        `Could not read ${result.unreadable.length}: ${result.unreadable.join(', ')}`
      )
      this.exitCode = 1
    }
    if (result.checked === this.limit) this.logger.info('More may remain: run it again.')
  }
}
