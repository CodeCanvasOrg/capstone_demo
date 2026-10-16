import workspaceConfig from '#config/workspaces'
import RenderDocument from '../../jobs/render_document.ts'
import TaskDispatch from '#models/task_dispatch'
import WorkspaceTask from '#models/workspace_task'
import ProcessFile from '../../jobs/process_file.ts'
import GenerateDocument from '../../jobs/generate_document.ts'
import { DateTime } from 'luxon'
export default class TaskDispatchService {
  async dispatch(limit = workspaceConfig.dispatchBatchSize) {
    const intents = await TaskDispatch.query()
      .whereNull('dispatchedAt')
      .whereExists((query) =>
        query
          .from('workspace_tasks')
          .select('id')
          .whereColumn('workspace_tasks.id', 'task_dispatches.task_id')
          .whereIn('workspace_tasks.status', ['queued', 'running'])
      )
      .orderBy('createdAt')
      .limit(limit)
    let sent = 0
    for (const intent of intents) {
      const task = await WorkspaceTask.find(intent.taskId)
      if (!task || !['queued', 'running'].includes(task.status)) continue
      try {
        // Delivery is at least once; the durable task lease makes duplicate execution safe.
        if (task.kind === 'ingest') await ProcessFile.dispatch({ version: 1, taskId: task.id })
        else if (task.kind === 'generate')
          await GenerateDocument.dispatch({ version: 1, taskId: task.id })
        else if (task.kind === 'render')
          await RenderDocument.dispatch({ version: 1, taskId: task.id })
        else continue
        intent.merge({
          dispatchedAt: DateTime.utc(),
          attempts: intent.attempts + 1,
          safeError: null,
        })
        await intent.save()
        sent++
      } catch {
        intent.merge({
          attempts: intent.attempts + 1,
          safeError: 'Queue delivery failed; intent retained for retry',
        })
        await intent.save()
      }
    }
    return sent
  }
}
