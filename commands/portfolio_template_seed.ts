import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class PortfolioTemplateSeed extends BaseCommand {
  static commandName = 'portfolio:template:seed'
  static description = ''

  static options: CommandOptions = {}

  async run() {
    this.logger.info('Hello world from "PortfolioTemplateSeed"')
  }
}
