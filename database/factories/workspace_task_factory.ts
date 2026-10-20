import factory from '@adonisjs/lucid/factories'
import WorkspaceTask from '#models/workspace_task'

export const WorkspaceTaskFactory = factory
  .define(WorkspaceTask, async () => {
    return {}
  })
  .build()
