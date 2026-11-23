import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import TaskService, { type TaskLease } from '#services/workspaces/task_service'

/**
 * Leases held by jobs running in this process. On a redeploy the platform sends SIGTERM and
 * kills the process once its draining window ends, which can cut a long job off mid-run.
 * Without a hand-off, that task stays "running" until its lease expires and something
 * reconciles it. Releasing the leases just before the kill re-queues the tasks at once for
 * the new deployment; the lease fencing rejects anything the old process writes afterwards.
 */
const active = new Set<TaskLease>()

export const trackLease = (lease: TaskLease) => {
  active.add(lease)
  return () => active.delete(lease)
}

export const activeLeaseCount = () => active.size

/** Re-queues every task still running here and marks it for immediate re-dispatch. */
export async function releaseActiveLeases(tasks = new TaskService()) {
  const leases = [...active]
  active.clear()
  const released: string[] = []
  for (const lease of leases) {
    try {
      await tasks.defer(lease)
      released.push(lease.task.id)
    } catch {
      // The lease was already lost (expired or finished elsewhere); nothing to hand back.
    }
  }
  if (released.length) {
    await db.from('task_dispatches').whereIn('task_id', released).update({ dispatched_at: null })
    logger.info({ taskIds: released }, 'Handed running tasks back to the queue before shutdown')
  }
  return released
}

/**
 * Called on SIGTERM. Jobs that finish within the draining window keep their result; the rest
 * are released a little before the platform's SIGKILL so the next deployment picks them up.
 */
export function releaseBeforeKill(
  drainingSeconds = Number(process.env.RAILWAY_DEPLOYMENT_DRAINING_SECONDS)
) {
  const seconds = Number.isFinite(drainingSeconds) && drainingSeconds > 0 ? drainingSeconds : 0
  const delay = Math.max(seconds - 10, 0) * 1000
  if (!active.size) return
  logger.info(
    { running: active.size, releaseInSeconds: delay / 1000 },
    'Shutdown signal received; waiting for running jobs before handing them back'
  )
  const timer = setTimeout(() => {
    void releaseActiveLeases().catch((error) =>
      logger.error({ err: error }, 'Could not hand running tasks back before shutdown')
    )
  }, delay)
  timer.unref()
}
