# Worker lifecycle and retry research

Status: researched on 2026-10-24; proposed design, awaiting agreement.

## Problem and observed behavior

The user wants bounded background execution, assignment of queued work to free workers,
cleanup of unused processing workers, and a five-second retry cooldown.

- `config/queue.ts:15` permits five concurrent jobs per consumer process. Its two-second
  `idleDelay` controls polling; it does not terminate the consumer.
- `@adonisjs/queue` 0.6.2 creates one polling `@boringnode/queue` 0.6.0 Worker per
  `queue:work` invocation. Its pool reuses execution capacity. Jobs do not spawn consumers.
- `app/services/documents/files_service.ts:192`, `:271`, and `:466` create OCR workers
  lazily. Each extraction uses at most one worker and calls `terminate()` in `finally`.
  PDF parsing also calls `destroy()` in `finally`. Ordinary completion already has cleanup.
- Tesseract.js 7.0.0 uses Node worker threads. Its public `terminate()` resolves without
  awaiting the underlying Node thread exit. Initialization rejects only some error paths;
  language/initialization failures can leave the creation promise unsettled. A successful
  source inspection does not establish whether any such failure happened in the runtime.
- `app/services/workspaces/task_service.ts:211` makes failed tasks immediately eligible
  for redelivery. `start/scheduler.ts:27` runs dispatch/reconciliation every two seconds.
- `app/controllers/document_tasks_controller.ts:29` creates a new preparation request and
  immediately dispatches it. New mutation IDs must not bypass retry timing for the same file.
- Generation retries start around 250 ms (`open_router_service.ts:130`), embeddings around
  500 ms (`embedding_service.ts:112`). Invitation retries already start at five seconds.
- The sync adapter executes in callers and does not obtain the Redis consumer's pool limit.

The checkout was clean on `main`. Process inventory was unavailable because this session
denies `ps`; no live worker count, memory usage, or leak is confirmed. No process was killed.

## Options and trade-offs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Bounded consumer pool; terminate each task's OCR thread | Existing queue supports reuse; no idle OCR allocation | Consumer remains alive to receive work | Adopt |
| Reusable OCR pool with idle eviction | Avoid repeated language initialization | Retains WASM memory and adds separate lifecycle/race handling | Defer |
| Exit consumer whenever idle | Releases all consumer memory | Requires an external mechanism to start it when new or delayed work arrives | Reject for this change |
| Machine-wide scan and kill of idle processes | Appears to reclaim memory | Low CPU does not prove idleness; cannot attribute ownership safely | Reject |
| Process-local execution gate shared by jobs | Covers sync dispatch and queue timeouts that only race promises | Limit multiplies across app processes | Adopt with explicit deployment scope |
| Deployment-wide execution semaphore | Shared cap across replicas | Requires distributed ownership, recovery, and cancellation guarantees | Defer; single consumer is the initial deployment |

## Recommendation

Default to two active document tasks per process. Reuse queue slots, keep the polling
consumer alive, and terminate task-owned OCR threads after extraction. Use a shared local
execution gate for ingest, generation, and rendering so sync execution has the same bound.
Retain capacity until underlying work and cleanup settle, even if the queue reports timeout.
Await actual OCR thread exit before releasing its task slot; diagnose and contain initialization
failure rather than treating a timeout race as worker termination.

Persist eligibility timestamps for task retries and queue delivery retries. Enforce a minimum
five-second cooldown in dispatch and claim paths. Schedule manual retries of failed preparation
with the same minimum delay. Provider retries use a five-second base with existing bounded
attempt counts. Source readiness deferral remains distinct from a failed attempt.

## Compatibility and sources

Installed source is authoritative for API availability. No new dependency is proposed.
The installed queue CLI exposes only `--queue` and `--concurrency`; do not assume current
online examples' newer flags exist here.

- [AdonisJS queue guide](https://docs.adonisjs.com/guides/digging-deeper/queues)
- [Tesseract API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
- Installed `node_modules/@adonisjs/queue/build/commands/queue_work.js`
- Installed `node_modules/@boringnode/queue/build/index.d.ts`
- Installed `node_modules/tesseract.js/src/createWorker.js` and `src/worker/node/terminateWorker.js`

## Risks and open decisions

Two is a conservative proposed default, not a measured optimum. The cap is per process:
two consumers permit four concurrent tasks; sync web processes add their own capacity.
Keep Redis for normal background operation and deploy one document consumer initially.
Strict deployment-wide limits would require a separate distributed-capacity design.
Hard hangs before OCR initialization returns require explicit ownership of the raw thread
or isolation behind a supervised child process; implementation must verify that boundary.
