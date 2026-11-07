import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class VerifyProjectFiles extends BaseCommand {
  static commandName = 'files:verify-project-scope'
  static description = 'Report case studies that use files from another project'

  static options: CommandOptions = { startApp: true }

  @flags.string() declare workspace: string

  async run() {
    const { default: ProjectFilesService } = await import('#services/files/project_files_service')
    const violations = await new ProjectFilesService().violations(this.workspace)
    this.logger.info(JSON.stringify({ valid: !violations.length, violations }))
    if (violations.length) this.exitCode = 1
  }
}
