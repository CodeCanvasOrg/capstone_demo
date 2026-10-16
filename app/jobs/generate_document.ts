import workspaceConfig from '#config/workspaces'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import TaskService from '#services/workspaces/task_service'
import GenerationService from '#services/documents/generation_service'
import logger from '@adonisjs/core/services/logger'
import OpenRouterService from '#services/open_router_service'
export default class GenerateDocument extends Job<{ version: 1; taskId: string }> {
  static options: JobOptions = { queue: 'documents', timeout: '10m' }
  async execute() {
    if (this.payload.version !== 1 || typeof this.payload.taskId !== 'string') return
    const tasks = new TaskService()
    const lease = await tasks.claim(this.payload.taskId)
    if (!lease || lease.task.kind !== 'generate') return
    const heartbeat = setInterval(() => {
      void tasks.renew(lease).catch(() => {})
    }, workspaceConfig.heartbeatMilliseconds)
    heartbeat.unref()
    try {
      await new GenerationService().execute(lease)
    } catch (error) {
      logger.error(
        {
          taskId: lease.task.id,
          providerStatus: OpenRouterService.status(error),
        },
        'Document generation failed'
      )
      await new GenerationService().failed(lease, OpenRouterService.status(error) === 409, error)
    } finally {
      clearInterval(heartbeat)
    }
  }
}
