import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class QaOutputBaseline extends BaseCommand {
  static commandName = 'qa:output-baseline'
  static description = 'Validate, render or compare the frozen QA-01 output fixtures (offline)'

  static options: CommandOptions = { startApp: true }

  @flags.string({ default: 'validate' }) declare mode: 'validate' | 'render' | 'compare'
  @flags.string({ default: 'tests/fixtures/output/qa01-v1/manifest.json' }) declare manifest: string
  @flags.string({ default: 'both' }) declare layout: 'legacy' | 'pilot' | 'both'
  @flags.string() declare output?: string
  @flags.string() declare baseline?: string

  async run() {
    const {
      default: Service,
      captureEnvironment,
      pymupdfInspector,
    } = await import('#services/qa/output_baseline_service')
    const { default: pdfWorkerConfig } = await import('#config/pdf_worker')
    const { default: ExportPdfService } = await import('#services/exports/pdf_service')
    const { default: Projection } =
      await import('#services/documents/publication_projection_service')
    const client = (content: any) => new Projection().project(content).client
    const { readFile } = await import('node:fs/promises')
    const root = this.app.makePath()
    const service = new Service()
    const corpus = await service.load(this.manifest)

    if (this.mode === 'validate') {
      const problems = service.validate(corpus)
      problems.forEach((problem) => this.logger.error(problem))
      if (problems.length) this.exitCode = 1
      else
        this.logger.success(`Corpus ${corpus.corpusVersion} valid (${corpus.cases.length} cases)`)
      return
    }

    if (!this.output) {
      this.logger.error('--output is required')
      this.exitCode = 1
      return
    }

    if (this.mode === 'render') {
      const layouts = this.layout === 'both' ? (['legacy', 'pilot'] as const) : [this.layout]
      const report = await service.render(corpus, {
        layouts: [...layouts],
        outputDir: this.output,
        renderer: {
          html: (content, options) => ExportPdfService.html(client(content), options),
          pdf: (content, options) => ExportPdfService.generate(client(content), options),
        },
        inspector: pymupdfInspector(pdfWorkerConfig.python),
        environment: () => captureEnvironment(root, pdfWorkerConfig.python),
        clock: () => performance.now(),
        now: () => new Date(),
      })
      for (const r of report.results)
        this.logger.info(
          `${r.fixtureId} ${r.layout}: pdf ${r.pdf.status === 'measured' ? `${r.pdf.value.pages}p ${r.pdf.value.bytes}B` : `unavailable (${r.pdf.status === 'unavailable' ? r.pdf.reason : ''})`}; checks ${r.checks.filter((c) => c.ok).length}/${r.checks.length}`
        )
      this.logger[report.ok ? 'success' : 'error'](`Report: ${this.output}/report.json`)
      if (!report.ok) this.exitCode = 1
      return
    }

    if (!this.baseline) {
      this.logger.error('--baseline is required')
      this.exitCode = 1
      return
    }
    const report = JSON.parse(await readFile(`${this.output}/report.json`, 'utf8'))
    const baseline = JSON.parse(await readFile(this.baseline, 'utf8'))
    const result = service.compare(report, baseline)
    result.differences.forEach((line) => this.logger.warning(line))
    this.logger.info(`Comparison: ${result.status}`)
    if (result.status !== 'same') this.exitCode = 1
  }
}
