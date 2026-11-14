import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class PdfInspect extends BaseCommand {
  static commandName = 'pdf:inspect'
  static description =
    'Inspect a finished PDF: pages, size, fonts (embedded / Type 3), links and page-fit findings'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Path to the PDF file' })
  declare file: string

  @flags.number({ description: 'Entry page budget to check against' })
  declare budget?: number
  @flags.number({ description: 'Fail when the file is larger than this many megabytes' })
  declare maxMb?: number

  async run() {
    const { inspectPdf } = await import('#services/exports/pdf_inspector')
    const { inspectPages } = await import('../shared/layout/fit.ts')
    const report = await inspectPdf(this.file)
    const findings = inspectPages(report.pageStats, { budget: this.budget })
    const type3 = report.fonts.filter((font) => font.type === 'Type3')
    const unembedded = report.fonts.filter((font) => !font.embedded)
    const mb = report.bytes / (1024 * 1024)
    this.logger.info(
      JSON.stringify(
        {
          pages: report.pages,
          megabytes: Number(mb.toFixed(2)),
          fonts: report.fonts,
          links: report.links.length,
          internalLinks: report.internalLinks,
          findings,
        },
        null,
        2
      )
    )
    const failures = [
      ...(type3.length ? [`Type 3 fonts: ${type3.map((font) => font.name).join(', ')}`] : []),
      ...(unembedded.length
        ? [`Fonts not embedded: ${unembedded.map((font) => font.name).join(', ')}`]
        : []),
      ...(this.maxMb !== undefined && mb > this.maxMb
        ? [`File is ${mb.toFixed(1)} MB (limit ${this.maxMb})`]
        : []),
      ...findings
        .filter((finding) => finding.severity === 'error')
        .map((finding) => finding.message),
    ]
    for (const failure of failures) this.logger.error(failure)
    if (failures.length) this.exitCode = 1
    else this.logger.success('No blocking findings')
  }
}
