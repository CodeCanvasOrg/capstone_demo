import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class VerifyOpenrouter extends BaseCommand {
  static commandName = 'verify:openrouter'
  static description =
    'Check provider configuration; --live runs a synthetic chat and embedding probe'

  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Send a synthetic brief to OpenRouter; consumes provider credits' })
  declare live: boolean

  async run() {
    const { default: config } = await import('#config/open_router')
    this.logger.info(
      `Chat: ${config.model}; embeddings: ${config.embeddingModel}; endpoint: ${config.baseUrl}`
    )
    if (!this.live) {
      this.logger.info('Configuration loaded. Use --live for a synthetic provider check.')
      return
    }
    const { default: Chat } = await import('#services/open_router_service')
    try {
      const { default: Embeddings } = await import('#services/documents/embedding_service')
      const vector = await new Embeddings().embedQuery('Synthetic connectivity fixture')
      this.logger.success(`Live embeddings returned ${vector.length} dimensions`)
      const content = await new Chat().generateDocumentWithEvidence(
        'Synthetic connectivity fixture',
        'This is a synthetic connectivity check, not a real project. Return only a short heading and one short paragraph about verifying a connection. Do not invent evidence.',
        []
      )
      this.logger.success(
        `Live structured generation returned ${content.content.length} document blocks`
      )
    } catch (error) {
      const status = Chat.status(error)
      this.logger.error(
        status
          ? (config.failureMessages[status] ?? `Provider check failed (HTTP ${status})`)
          : 'Provider check failed before a valid document was received'
      )
      this.exitCode = 1
    }
  }
}
