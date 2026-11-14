import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class LayoutReport extends BaseCommand {
  static commandName = 'layout:report'
  static description =
    'Print a document’s pinned layout, page-fit result and content findings, plus its review-bundle hash'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'User ID acting on the document' })
  declare actor: number
  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Document UUID' })
  declare document: string

  async run() {
    if (!this.actor || !this.workspace || !this.document)
      return this.fail('--actor, --workspace and --document are required')
    const { default: AccessService } = await import('#services/workspaces/access_service')
    const { default: DocumentExportService } =
      await import('#services/exports/document_export_service')
    const { default: LayoutSelectionService } =
      await import('#services/layout/layout_selection_service')
    const { default: BundleService } = await import('#services/layout/bundle_service')

    const { context } = await new AccessService().resolve(this.actor, this.workspace)
    const document = await new AccessService().document(context, this.document)
    const selection = await new LayoutSelectionService().resolve(context, this.document)
    const report = await new DocumentExportService().layoutReport(context, this.document)
    const bundle = await new BundleService().current(document)
    this.logger.info(
      JSON.stringify({ selection, report, bundleHash: bundle?.hash ?? null }, null, 2)
    )
    // Error-severity findings would block final export, so surface them in the exit code.
    if (report?.findings.some((finding) => finding.severity === 'error')) this.exitCode = 1
  }

  private fail(message: string) {
    this.logger.error(message)
    this.exitCode = 1
  }
}
