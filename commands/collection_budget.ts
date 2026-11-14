import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class CollectionBudget extends BaseCommand {
  static commandName = 'collection:budget'
  static description =
    'Show a collection’s page-budget arithmetic, contents page numbers and approval state'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'User ID acting on the collection' })
  declare actor: number
  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Collection UUID' })
  declare collection: string
  @flags.number({ description: 'Target page count (default 20)' })
  declare target?: number

  async run() {
    if (!this.actor || !this.workspace || !this.collection) {
      this.logger.error('--actor, --workspace and --collection are required')
      this.exitCode = 1
      return
    }
    const { default: AccessService } = await import('#services/workspaces/access_service')
    const { default: CollectionService } = await import('#services/layout/collection_service')
    const { context } = await new AccessService().resolve(this.actor, this.workspace)
    const service = new CollectionService()
    const budget = await service.budget(context, this.collection, { target: this.target ?? 20 })
    const contents = await service.contents(context, this.collection)
    const state = await service.state(context, this.collection)
    this.logger.info(JSON.stringify({ budget, contents, state }, null, 2))
    if (budget.over || !contents.converged || state.approval === 'stale') this.exitCode = 1
  }
}
