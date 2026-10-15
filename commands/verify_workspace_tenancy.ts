import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class VerifyWorkspaceTenancy extends BaseCommand {
  static commandName = 'workspaces:verify'
  static description = 'Audit, preserve and verify workspace tenancy migration'

  static options: CommandOptions = { startApp: true }

  async run() {
    const { default: MigrationService } = await import('#services/workspaces/migration_service')
    const report = await new MigrationService().verify()
    this.logger.info(JSON.stringify(report))
    if (!report.valid) this.exitCode = 1
  }
}
