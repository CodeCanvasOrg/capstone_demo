import { hashOf } from '../layout/hash.ts'

/**
 * Stage-based progress, bounded retries and checkpoint identity (OPS-01).
 * Stages are named, not percentages: the platform does not know how far along
 * a model call is, so it does not pretend to.
 */
export const PIPELINE_STAGES = [
  'preparing',
  'retrieving',
  'drafting',
  'validating',
  'rendering',
  'ready_for_review',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

const SAFE_CODE = /^[a-z][a-z0-9_]{1,63}$/

export type StageSnapshot = {
  stage?: PipelineStage
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  /** Milliseconds per finished stage. */
  timings: Partial<Record<PipelineStage, number>>
  startedAt?: number
  errorCode?: string
}

export class StageTracker {
  #state: StageSnapshot

  constructor(
    private now: () => number = Date.now,
    state: StageSnapshot = { status: 'queued', timings: {} }
  ) {
    this.#state = structuredClone(state)
  }

  static restore(snapshot: StageSnapshot, now: () => number = Date.now) {
    return new StageTracker(now, snapshot)
  }

  #close() {
    const { stage, startedAt } = this.#state
    if (stage && startedAt !== undefined)
      this.#state.timings[stage] = (this.#state.timings[stage] ?? 0) + (this.now() - startedAt)
    this.#state.startedAt = undefined
  }

  start(stage: PipelineStage) {
    if (!PIPELINE_STAGES.includes(stage)) throw new Error(`Unknown stage "${String(stage)}"`)
    this.#close()
    this.#state = { ...this.#state, stage, status: 'running', startedAt: this.now() }
  }

  complete() {
    this.#close()
    this.#state.status = 'succeeded'
  }

  /** Only a short machine code is stored; free text could carry secrets or excerpts. */
  fail(code: string) {
    if (!SAFE_CODE.test(code)) throw new Error('Error codes must be short snake_case identifiers')
    this.#close()
    this.#state.status = 'failed'
    this.#state.errorCode = code
  }

  snapshot(): StageSnapshot {
    return structuredClone(this.#state)
  }
}

export type FailureKind = 'auth' | 'transient' | 'permanent'

export function classifyFailure(error: unknown): FailureKind {
  const status = (error as { status?: number })?.status
  if (status === 401 || status === 403) return 'auth'
  if (status === undefined) {
    const code = (error as { code?: string; name?: string })?.code ?? (error as Error)?.name
    return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|TimeoutError|FetchError/.test(String(code))
      ? 'transient'
      : 'permanent'
  }
  return status === 408 || status === 425 || status === 429 || status >= 500
    ? 'transient'
    : 'permanent'
}

/**
 * Retries only transient failures, with exponential backoff and a hard cap.
 * `budget` is a persisted allowance shared across runs, so a restart cannot
 * reset it; invalid credentials are never retried.
 */
export async function runWithRetry<T>(
  run: (attempt: number) => Promise<T>,
  {
    maxAttempts = 3,
    baseMs = 500,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    budget,
    signal,
  }: {
    maxAttempts?: number
    baseMs?: number
    sleep?: (ms: number) => Promise<void>
    budget?: { remaining: number }
    signal?: AbortSignal
  } = {}
): Promise<{ value: T; attempts: number }> {
  let last: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('cancelled')
    if (budget) {
      if (budget.remaining <= 0) throw last ?? new Error('retry_budget_exhausted')
      budget.remaining--
    }
    try {
      return { value: await run(attempt), attempts: attempt }
    } catch (error) {
      last = error
      if (classifyFailure(error) !== 'transient' || attempt === maxAttempts) throw error
      if (signal?.aborted) throw new Error('cancelled')
      if (budget && budget.remaining <= 0) throw error
      await sleep(baseMs * 2 ** (attempt - 1))
    }
  }
  throw last
}

/** Identity of one completed unit of work; reused when the inputs still match. */
export const checkpointKey = (parts: {
  collectionId: string
  entryId: string
  inputHash: string
}) => hashOf(parts)
