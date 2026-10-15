import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class AuditWorkspaceMigration extends BaseCommand {
  static commandName = 'workspaces:audit'
  static description = 'Audit, preserve and verify workspace tenancy migration'

  static options: CommandOptions = { startApp: true }

  @flags.string({ default: 'tmp/workspace-audit.json' }) declare output: string

  async run() {
    const { default: MigrationService } = await import('#services/workspaces/migration_service')
    const service = new MigrationService()
    const report = await service.audit()
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    await mkdir(dirname(this.output), { recursive: true })
    await writeFile(this.output, JSON.stringify(report, null, 2), { mode: 0o600 })
    this.logger.info(`Audit saved: ${this.output}; conflicts: ${report.conflicts.length}`)
  }
}
