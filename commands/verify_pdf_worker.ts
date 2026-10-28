import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class VerifyPdfWorker extends BaseCommand {
  static commandName = 'verify:pdf-worker'
  static description = 'Start one PyMuPDF worker, check its handshake and report versions'

  static options: CommandOptions = { startApp: true }

  async run() {
    const { default: config } = await import('#config/pdf_worker')
    const { default: PdfWorkerService, PdfWorkerError } =
      await import('#services/documents/pdf_worker_service')
    this.logger.info(`Extractor: ${config.extractor}; python: ${config.python}`)
    const started = Date.now()
    try {
      const hello = await new PdfWorkerService().hello()
      this.logger.success(
        `Worker ready in ${Date.now() - started} ms: Python ${hello.python}, ${hello.extractor}, protocol ${hello.protocol}`
      )
    } catch (error) {
      this.logger.error(error instanceof PdfWorkerError ? error.message : String(error))
      this.exitCode = 1
    } finally {
      await PdfWorkerService.shutdown()
    }
  }
}
