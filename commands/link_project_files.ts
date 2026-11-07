import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class LinkProjectFiles extends BaseCommand {
  static commandName = 'files:project-link'
  static description = 'Link or unlink workspace files and projects in bulk'

  static options: CommandOptions = { startApp: true }

  @flags.string({ required: true }) declare workspace: string
  @flags.string() declare project: string
  @flags.array({ description: 'File ids (repeat or comma-separate)' }) declare files: string[]
  @flags.string({ description: 'JSON file of [{ "fileId": "...", "projectId": "..." }]' })
  declare mapping: string
  @flags.boolean() declare unlink: boolean
  @flags.boolean() declare apply: boolean
  @flags.boolean() declare dryRun: boolean

  async run() {
    if (this.apply === this.dryRun) throw new Error('Choose exactly one of --apply or --dry-run')
    const files = (this.files ?? []).flatMap((value) => value.split(',')).filter(Boolean)
    if (!files.length === !this.mapping)
      throw new Error('Choose exactly one of --files or --mapping')
    let pairs: { fileId: string; projectId: string }[]
    if (this.mapping) {
      const { readFile } = await import('node:fs/promises')
      pairs = JSON.parse(await readFile(this.mapping, 'utf8'))
    } else {
      if (!this.project) throw new Error('--files requires --project')
      pairs = files.map((fileId) => ({ fileId, projectId: this.project }))
    }
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const { default: ProjectFilesService } = await import('#services/files/project_files_service')
    const service = new ProjectFilesService()
    const change = this.unlink ? 'detach' : 'attach'
    const changed: typeof pairs = []
    const unchanged: typeof pairs = []
    const skipped: ((typeof pairs)[number] & { reason: string })[] = []
    const trx = await db.transaction()
    try {
      for (const pair of pairs) {
        // A savepoint per pair lets one conflict skip without losing the rest.
        const savepoint = await trx.transaction()
        try {
          const done = await service.link(
            savepoint,
            this.workspace,
            pair.fileId,
            pair.projectId,
            change,
            null
          )
          await savepoint.commit()
          ;(done ? changed : unchanged).push(pair)
        } catch (error) {
          await savepoint.rollback()
          skipped.push({ ...pair, reason: (error as Error).message })
        }
      }
      if (this.apply) await trx.commit()
      else await trx.rollback()
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
    this.logger.info(JSON.stringify({ applied: !!this.apply, change, changed, unchanged, skipped }))
    if (skipped.length) this.exitCode = 1
  }
}
