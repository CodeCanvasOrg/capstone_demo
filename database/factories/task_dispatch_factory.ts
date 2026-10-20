import factory from '@adonisjs/lucid/factories'
import TaskDispatch from '#models/task_dispatch'

export const TaskDispatchFactory = factory
  .define(TaskDispatch, async () => {
    return {}
  })
  .build()
