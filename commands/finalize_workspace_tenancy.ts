import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { readFile } from 'node:fs/promises'
export default class FinalizeWorkspaceTenancy extends BaseCommand {
  static commandName = 'workspaces:finalize'
  static description =
    'Verify original IDs and reviewed backfill, then enforce tenant columns during maintenance'
  static options: CommandOptions = { startApp: true }
  @flags.string({ required: true }) declare baseline: string
  @flags.string({ required: true }) declare mapping: string
  @flags.boolean() declare apply: boolean
  @flags.boolean() declare dryRun: boolean
  async run() {
    if (this.apply === this.dryRun) throw new Error('Choose exactly one of --apply or --dry-run')
    const { default: CutoverService } = await import('#services/workspaces/cutover_service')
    const result = await new CutoverService().finalize(
      JSON.parse(await readFile(this.baseline, 'utf8')),
      JSON.parse(await readFile(this.mapping, 'utf8')),
      this.apply
    )
    this.logger.info(JSON.stringify(result))
  }
}
