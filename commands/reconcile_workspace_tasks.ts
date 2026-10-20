import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
export default class ReconcileWorkspaceTasks extends BaseCommand {
  static commandName = 'workspaces:reconcile-tasks'
  static description = 'Make queued and expired workspace executions eligible for redelivery'
  static options: CommandOptions = { startApp: true }
  async run() {
    const { default: Service } = await import('#services/workspaces/task_service')
    await new Service().reconcile()
    this.logger.success('Task intents reconciled')
  }
}
