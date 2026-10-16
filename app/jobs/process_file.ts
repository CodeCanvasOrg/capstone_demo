import workspaceConfig from '#config/workspaces'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import ProcessingService from '#services/documents/processing_service'
import TaskService from '#services/workspaces/task_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
export default class ProcessFile extends Job<{ version: 1; taskId: string }> {
  static options: JobOptions = { queue: 'documents', timeout: '20m' }
  async execute() {
    // Old queue payloads are deliberately rejected; they have no attributable authorization.
    if (this.payload.version !== 1 || typeof this.payload.taskId !== 'string') return
    const tasks = new TaskService()
    const lease = await tasks.claim(this.payload.taskId)
    if (!lease || lease.task.kind !== 'ingest') return
    const heartbeat = setInterval(() => {
      void tasks.renew(lease).catch(() => {})
    }, workspaceConfig.heartbeatMilliseconds)
    heartbeat.unref()
    try {
      await new ProcessingService().processRun(lease)
    } catch {
      await tasks.fail(lease)
    } finally {
      clearInterval(heartbeat)
    }
    await new TaskDispatchService().dispatch()
  }
}
