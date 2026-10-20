import factory from '@adonisjs/lucid/factories'
import WorkflowEvent from '#models/workflow_event'

export const WorkflowEventFactory = factory
  .define(WorkflowEvent, async () => {
    return {}
  })
  .build()
