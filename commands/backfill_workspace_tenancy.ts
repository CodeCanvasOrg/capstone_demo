import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class BackfillWorkspaceTenancy extends BaseCommand {
  static commandName = 'workspaces:backfill'
  static description = 'Audit, preserve and verify workspace tenancy migration'

  static options: CommandOptions = { startApp: true }

  @flags.string({ required: true }) declare mapping: string
  @flags.boolean() declare apply: boolean
  @flags.boolean() declare dryRun: boolean

  async run() {
    if (this.apply === this.dryRun) throw new Error('Choose exactly one of --apply or --dry-run')
    const { readFile } = await import('node:fs/promises')
    const mapping = JSON.parse(await readFile(this.mapping, 'utf8'))
    const { default: MigrationService } = await import('#services/workspaces/migration_service')
    const result = await new MigrationService().backfill(mapping, this.apply)
    this.logger.info(JSON.stringify(result))
  }
}
