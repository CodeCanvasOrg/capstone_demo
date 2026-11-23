import PdfUnavailableException from '#exceptions/pdf_unavailable_exception'
import workspaceConfig from '#config/workspaces'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import TaskService from '#services/workspaces/task_service'
import DocumentExportService from '#services/exports/document_export_service'
import { trackLease } from '#services/workspaces/active_leases'
export default class RenderDocument extends Job<{ version: 1; taskId: string }> {
  static options: JobOptions = { queue: 'documents', timeout: '5m' }
  async execute() {
    if (this.payload.version !== 1 || typeof this.payload.taskId !== 'string') return
    const service = new TaskService()
    const lease = await service.claim(this.payload.taskId)
    if (!lease || lease.task.kind !== 'render') return
    const heartbeat = setInterval(() => {
      void service.renew(lease).catch(() => {})
    }, workspaceConfig.heartbeatMilliseconds)
    heartbeat.unref()
    const untrack = trackLease(lease)
    try {
      await new DocumentExportService().render(lease)
    } catch (error) {
      await service.fail(
        lease,
        !!error && typeof error === 'object' && 'status' in error && error.status === 409,
        error instanceof PdfUnavailableException ? error.message : undefined,
        error instanceof PdfUnavailableException
      )
    } finally {
      clearInterval(heartbeat)
      untrack()
    }
  }
}
