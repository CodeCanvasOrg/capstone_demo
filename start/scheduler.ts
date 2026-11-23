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
// It also runs inside `ace queue:work`: on serverless hosts the web process is frozen between
// requests, so without the worker a task whose lease expired (e.g. its worker was replaced by a
// redeploy) would only be re-queued once someone used the site. Other ace commands (migrations,
// one-off scripts) skip it.
const runsHere = app.getEnvironment() === 'web' || process.argv.includes('queue:work')

await app.ready(() => {
  if (!runsHere) return
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
