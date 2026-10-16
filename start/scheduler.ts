/*
|--------------------------------------------------------------------------
| Scheduler
|--------------------------------------------------------------------------
|
| This file is used to define scheduled jobs. You can schedule jobs to run
| at specific intervals using cron expressions or duration strings.
|
| Example:
|
|   import SendWeeklyReport from '#jobs/send_weekly_report'
|
|   SendWeeklyReport.schedule({ userId: 1 })
|     .cron('0 9 * * MON')
|     .run()
|
*/
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import TaskService from '#services/workspaces/task_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'

// Deliver committed intents outside request handling, including the development sync adapter.
// The lease protocol fences duplicate deliveries across web processes and Redis workers.
await app.ready(() => {
  let running = false
  const interval = setInterval(async () => {
    if (running) return
    running = true
    try {
      await new TaskService().reconcile()
      await new TaskDispatchService().dispatch()
    } catch {
      logger.error('Workspace task delivery failed; durable intents will retry on the next pass')
    } finally {
      running = false
    }
  }, 2000)
  interval.unref()
  app.terminating(() => clearInterval(interval))
})
