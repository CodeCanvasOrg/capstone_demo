import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
export default class DispatchWorkspaceTasks extends BaseCommand {
  static commandName = 'workspaces:dispatch-tasks'
  static description = 'Dispatch one bounded pass of durable workspace task intents'
  static options: CommandOptions = { startApp: true }
  async run() {
    const { default: Service } = await import('#services/workspaces/task_dispatch_service')
    this.logger.info(`Dispatched ${await new Service().dispatch()} task intents`)
  }
}
