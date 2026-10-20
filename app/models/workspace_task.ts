import { WorkspaceTaskSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { TaskPayload } from '#services/workspaces/task_service'
export default class WorkspaceTask extends WorkspaceTaskSchema {
  @column() declare payload: TaskPayload
  @column() declare result: Record<string, unknown>
}
