import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Health report for canvas documents: what an autosaved draft deleted or added
 * compared with the saved version (and so what the preview shows but a final
 * export does not), and image boxes that will print empty or not at all.
 * Read-only. Exits 1 when a picture is missing or stored data is invalid.
 */
export default class CanvasAudit extends BaseCommand {
  static commandName = 'canvas:audit'
  static description =
    'Report canvas drafts vs saved versions (deleted/added boxes and pages) and image problems'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Only this document (UUID)' })
  declare document?: string
  @flags.boolean({ description: 'Print the report as JSON' })
  declare json?: boolean

  async run() {
    if (!this.workspace) {
      this.logger.error('--workspace is required')
      this.exitCode = 1
      return
    }
    const { default: CanvasAuditService } = await import('#services/canvas/canvas_audit_service')
    const reports = await new CanvasAuditService().audit(this.workspace, this.document)
    const failing = reports.some((r) => r.images.missing.length || r.problems.length)
    if (failing) this.exitCode = 1

    if (this.json) {
      this.logger.log(JSON.stringify(reports, null, 2))
      return
    }
    if (!reports.length) {
      this.logger.info('No documents are open in the canvas editor.')
      return
    }
    const list = (ids: string[]) => (ids.length ? ids.join(', ') : '-')
    for (const r of reports) {
      this.logger.log('')
      this.logger.log(this.colors.bold(`${r.title}  (${r.documentId})`))
      this.logger.log(`  saved version   ${r.versionId ?? '-'}, ${r.sheets ?? 0} pages`)
      if (!r.draft) this.logger.log('  draft           none (preview = saved version)')
      else {
        const d = r.draft
        this.logger.log(
          `  draft           revision ${d.revision}, ${d.sheets} pages${d.stale ? this.colors.yellow(' (stale: ignored)') : ''}`
        )
        this.logger.log(`    deleted boxes ${list(d.diff.deletedFrames)}`)
        this.logger.log(`    added boxes   ${list(d.diff.addedFrames)}`)
        this.logger.log(`    deleted pages ${list(d.diff.deletedSheets)}`)
        this.logger.log(`    added pages   ${list(d.diff.addedSheets)}`)
      }
      this.logger.log(`  empty images    ${list(r.images.empty)}`)
      const missing = list(r.images.missing)
      this.logger.log(
        `  missing images  ${r.images.missing.length ? this.colors.red(missing) : missing}`
      )
      this.logger.log(`  unmeasured      ${list(r.images.unmeasured)}`)
      for (const problem of r.problems) this.logger.log(this.colors.red(`  invalid  ${problem}`))
    }
  }
}
