import workspaceConfig from '#config/workspaces'
import TaskConflictException from '#exceptions/task_conflict_exception'
import { createHash, randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import WorkspaceTask from '#models/workspace_task'
import TaskDispatch from '#models/task_dispatch'
import AccessService, {
  conflict,
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'

export type SourcePin = {
  fileId: string
  revisionId: string
  runId: string
  pipelineVersion: string
  embeddingModel: string
}
export type TaskPayload = {
  approvalId?: string
  versionId?: string
  brandVersion?: string
  pins?: SourcePin[]
  inputHash?: string
  baseVersionId?: string | null
  selectionRevision?: number
}
export type TaskLease = { task: WorkspaceTask; context: WorkspaceAccessContext; token: string }
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonical(item)])
        )
      : value
export const fingerprint = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
export default class TaskService {
  private async publishTerminal(task: WorkspaceTask, trx: TransactionClientContract) {
    if (task.kind === 'generate')
      await trx
        .from('documents')
        .where({
          workspace_id: task.workspaceId,
          id: task.documentId!,
          generation_task_id: task.id,
        })
        .update({
          generation_status: 'failed',
          generation_error: task.safeError ?? 'Generation could not finish',
          generation_lease_at: null,
        })
    if (task.kind === 'ingest')
      await trx
        .from('processing_runs')
        .where({ workspace_id: task.workspaceId, id: task.runId! })
        .whereNot('status', 'ready')
        .update({
          status: 'failed',
          error: task.safeError ?? 'Source preparation could not finish',
          completed_at: DateTime.utc().toSQL(),
        })
  }
  async create(
    context: WorkspaceAccessContext,
    input: {
      kind: 'ingest' | 'generate' | 'render'
      documentId?: string
      fileId?: string
      runId?: string
      mutationId: string
      payload: TaskPayload
    },
    trx: TransactionClientContract
  ) {
    await new AccessService().lock(context, trx)
    const hash = fingerprint(input)
    const previous = await WorkspaceTask.query({ client: trx })
      .where({
        workspaceId: context.workspaceId,
        actorId: context.actorId,
        kind: input.kind,
        mutationId: input.mutationId,
      })
      .first()
    if (previous) {
      if (previous.requestHash !== hash) throw conflict('This request identity was already used')
      return previous
    }
    const task = await WorkspaceTask.create(
      {
        ...input,
        workspaceId: context.workspaceId,
        actorId: context.actorId,
        membershipId: context.membershipId,
        membershipEpoch: context.membershipEpoch,
        requestHash: hash,
        status: 'queued',
        attempts: 0,
        result: {},
      },
      { client: trx }
    )
    await TaskDispatch.create({ taskId: task.id, attempts: 0 }, { client: trx })
    return task
  }
  context(task: WorkspaceTask): WorkspaceAccessContext {
    return Object.freeze({
      actorId: task.actorId,
      workspaceId: task.workspaceId,
      membershipId: task.membershipId,
      membershipEpoch: task.membershipEpoch,
    })
  }
  async claim(id: string): Promise<TaskLease | null> {
    if (!uuid(id)) return null
    const found = await WorkspaceTask.find(id)
    if (!found) return null
    const context = this.context(found)
    return db.transaction(async (trx) => {
      try {
        await new AccessService().lock(context, trx)
      } catch {
        await WorkspaceTask.query({ client: trx })
          .where('id', id)
          .whereIn('status', ['queued', 'running'])
          .update({
            status: 'cancelled',
            leaseToken: null,
            leaseExpiresAt: null,
            safeError: 'Access was revoked',
          })
        return null
      }
      const task = await WorkspaceTask.query({ client: trx })
        .where('id', id)
        .forUpdate()
        .firstOrFail()
      if (!['queued', 'running'].includes(task.status)) return null
      if (task.status === 'running' && task.leaseExpiresAt && task.leaseExpiresAt > DateTime.utc())
        return null
      if (task.attempts >= workspaceConfig.maximumAttempts) {
        task.merge({
          status: 'failed',
          leaseToken: null,
          leaseExpiresAt: null,
          safeError: 'Processing reached its retry limit',
        })
        await task.save()
        await this.publishTerminal(task, trx)
        return null
      }
      const token = randomUUID()
      task.merge({
        status: 'running',
        attempts: task.attempts + 1,
        leaseToken: token,
        leaseExpiresAt: DateTime.utc().plus({ seconds: workspaceConfig.leaseSeconds }),
        safeError: null,
      })
      await task.save()
      return { task, context, token }
    })
  }
  async lock(lease: TaskLease, trx: TransactionClientContract) {
    await new AccessService().lock(lease.context, trx)
    const task = await WorkspaceTask.query({ client: trx })
      .where('id', lease.task.id)
      .forUpdate()
      .firstOrFail()
    if (
      task.status !== 'running' ||
      task.leaseToken !== lease.token ||
      !task.leaseExpiresAt ||
      task.leaseExpiresAt <= DateTime.utc()
    )
      throw new TaskConflictException('lease_lost')
    return task
  }
  async check(lease: TaskLease) {
    await db.transaction((trx) => this.lock(lease, trx))
  }
  async renew(lease: TaskLease) {
    await db.transaction(async (trx) => {
      const task = await this.lock(lease, trx)
      task.leaseExpiresAt = DateTime.utc().plus({ seconds: workspaceConfig.leaseSeconds })
      await task.save()
    })
  }
  async finish(
    lease: TaskLease,
    callback?: (trx: TransactionClientContract) => Promise<Record<string, unknown>>
  ) {
    return db.transaction(async (trx) => {
      const task = await this.lock(lease, trx)
      const result = callback ? await callback(trx) : {}
      task.merge({ status: 'succeeded', result, leaseToken: null, leaseExpiresAt: null })
      await task.save()
      return result
    })
  }
  async fail(lease: TaskLease, stale = false, safeError?: string, permanent = false) {
    await db.transaction(async (trx) => {
      const task = await WorkspaceTask.query({ client: trx })
        .where('id', lease.task.id)
        .forUpdate()
        .first()
      if (!task || task.status !== 'running' || task.leaseToken !== lease.token) return
      if (task.kind === 'ingest' && task.attempts >= workspaceConfig.maximumAttempts)
        await trx
          .from('processing_runs')
          .where({ id: task.runId!, workspace_id: task.workspaceId })
          .update({
            status: 'failed',
            error: 'Processing reached its retry limit',
            completed_at: DateTime.utc().toSQL(),
          })
      task.merge({
        status: stale
          ? 'conflict'
          : permanent || task.attempts >= workspaceConfig.maximumAttempts
            ? 'failed'
            : 'queued',
        leaseToken: null,
        leaseExpiresAt: null,
        safeError:
          safeError ??
          (stale
            ? 'Inputs changed. Start a new request.'
            : 'Processing failed. Retry is available.'),
      })
      await task.save()
      if (['failed', 'conflict', 'cancelled'].includes(task.status))
        await this.publishTerminal(task, trx)
      if (!stale && !permanent && task.attempts < workspaceConfig.maximumAttempts)
        await TaskDispatch.query({ client: trx })
          .where('taskId', task.id)
          .update({ dispatchedAt: null })
    })
  }
  async defer(lease: TaskLease) {
    await db.transaction(async (trx) => {
      const task = await this.lock(lease, trx)
      task.merge({
        status: 'queued',
        attempts: task.attempts - 1,
        leaseToken: null,
        leaseExpiresAt: null,
      })
      await task.save()
    })
  }
  async wake(workspaceId: string) {
    await db.rawQuery(
      `UPDATE task_dispatches d SET dispatched_at = NULL FROM workspace_tasks t WHERE t.id = d.task_id AND t.workspace_id = ? AND t.kind = 'generate' AND t.status = 'queued'`,
      [workspaceId]
    )
  }
  async reconcile() {
    await db.rawQuery(
      `WITH pending AS(SELECT d.id,t.safe_error FROM documents d JOIN workspace_tasks t ON t.id=d.generation_task_id AND t.workspace_id=d.workspace_id WHERE d.generation_status='processing' AND t.status IN('failed','conflict','cancelled') LIMIT 100) UPDATE documents d SET generation_status='failed',generation_error=COALESCE(p.safe_error,'Generation could not finish'),generation_lease_at=NULL FROM pending p WHERE p.id=d.id`
    )
    await db.rawQuery(
      `WITH pending AS(SELECT pr.id,t.safe_error FROM processing_runs pr JOIN workspace_tasks t ON t.run_id=pr.id AND t.workspace_id=pr.workspace_id WHERE pr.status IN('queued','processing') AND t.status IN('failed','conflict','cancelled') AND NOT EXISTS(SELECT 1 FROM workspace_tasks active WHERE active.run_id=pr.id AND active.workspace_id=pr.workspace_id AND active.status IN('queued','running')) LIMIT 100) UPDATE processing_runs pr SET status='failed',error=COALESCE(p.safe_error,'Source preparation could not finish'),completed_at=CURRENT_TIMESTAMP FROM pending p WHERE p.id=pr.id`
    )
    await db.rawQuery(
      `UPDATE task_dispatches d SET dispatched_at = NULL FROM workspace_tasks t WHERE t.id = d.task_id AND ((t.status = 'queued' AND d.dispatched_at < CURRENT_TIMESTAMP - INTERVAL '30 seconds') OR (t.status = 'running' AND t.lease_expires_at < CURRENT_TIMESTAMP))`
    )
  }
  async show(context: WorkspaceAccessContext, id: string) {
    if (!uuid(id)) throw missingResource()
    const task = await WorkspaceTask.query()
      .where({ id, workspaceId: context.workspaceId })
      .firstOrFail()
    return {
      id: task.id,
      kind: task.kind,
      status: task.status,
      error: task.safeError,
      result:
        task.kind === 'render' && task.status === 'succeeded'
          ? {
              downloadUrl: `/workspaces/${context.workspaceId}/documents/${task.documentId}/exports/${task.id}/download`,
            }
          : task.kind === 'generate' && task.result.versionId
            ? { versionId: task.result.versionId }
            : {},
    }
  }
}
