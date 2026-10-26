# Worker lifecycle implementation plan

Status: proposed; no implementation, migration, or process termination performed.
Research: [worker-lifecycle-research.md](worker-lifecycle-research.md).

## 1. Decisions

- Default to two concurrent document tasks per process; configurable positive integer.
- Reuse queue execution slots and keep one document consumer alive to receive new work.
- Destroy each task's OCR thread after extraction; await thread exit before releasing capacity.
- Enforce minimum five-second task, delivery, manual-preparation, generation, and embedding retries.
- Keep existing authorization, source pins, idempotency, lease fencing, and attempt limits.
- No new frontend, endpoint, infrastructure dependency, or deployment-wide semaphore.

## 2. Current-state audit

| Recommendation | Current evidence | Status |
| --- | --- | --- |
| Reuse bounded queue slots | `config/queue.ts:15`, installed Worker pool | Adopted; reduce default 5 to 2 |
| Cover sync execution | Sync dispatch bypasses queue Worker pool | Adopted; shared job execution gate |
| Cleanup OCR workers | `files_service.ts:218`, `:351`, `:483` | Adopted; verify failures and actual thread exit |
| Persist cooldown | `task_service.ts:247`, `task_dispatch_service.ts:43` immediately reset delivery | Adopted; timestamp guards |
| Five-second provider base | 250 ms chat / 500 ms embedding | Adopted; central retry policy |
| Preserve invitation retries | `send_workspace_invitation.ts:10` already uses 5 s base | Adopted; leave its existing policy |
| Automatic consumer shutdown on idle | No restart mechanism exists | Rejected |
| Deployment-wide capacity | Current pool is per process | Deferred; document replica multiplication |

## 3. Defects to fix first

- D1: Immediate task/delivery retries can recur every scheduler pass. Add durable not-before guards.
- D2: Manual retry with a fresh mutation ID can start immediately. Schedule new retry tasks no sooner
  than five seconds after acceptance; replaying the same mutation returns its original task.
- D3: Provider retry bases are below five seconds. Apply a shared minimum without increasing attempts.
- D4: Queue concurrency does not bound sync job execution. Share a process-local gate across all jobs.
- D5: Public OCR termination does not await Node exit; initialization failures may never return a handle.
  Verify raw-thread ownership and bounded initialization cleanup before claiming lifecycle guarantees.
  Do not ship an implementation that releases capacity on a timeout while its old thread still runs.

## 4. Target architecture

See [worker-lifecycle-architecture.md](worker-lifecycle-architecture.md).
Controllers authorize and delegate; scheduling and worker ownership live in services/configuration.

## 5. Data model and contract

Add nullable `timestamptz` columns with null meaning immediately eligible:

| Table | Column | Meaning |
| --- | --- | --- |
| `workspace_tasks` | `available_at` | Earliest execution time, checked under the task claim lock |
| `task_dispatches` | `available_at` | Earliest queue delivery retry |

Index pending delivery eligibility and queued task eligibility using the actual PostgreSQL query
plan. Existing rows remain eligible; no task status or lease schema changes are required.

Automatic transient failures atomically requeue the task at database time + five seconds and reset
its dispatch marker. Delivery exceptions retain their intent with a five-second delivery delay.
Dispatch selects only due task/intents; claim independently refuses early execution without consuming
an attempt. Early duplicate delivery must retain or restore a pending intent for eventual execution.
Reconcile and wake may reset dispatch markers but cannot erase a future cooldown.

For `POST /workspaces/:workspaceId/files/:id/retry`, keep the current authorization, validation,
response `{ data: { saved: true } }`, and HTML redirect. Accept the request immediately, persist the
new task for execution at least five seconds later, and remove synchronous dispatch from the
controller. Initial uploads remain immediately eligible. Existing pending-task conflicts and mutation
idempotency are preserved. No browser countdown or new public status is needed for this scope.

## 6. Phases

### Phase 0: Persist retry scheduling (D1, D2)

Scaffold migration through Ace; update models/schema through the repository's schema generation
workflow. Add scheduling guards to create/claim/fail/dispatch/reconcile/wake. Distinguish manual
retry requests from initial preparation; keep retry timing in services, with no sleep in HTTP handlers.

Acceptance: fake-clock DB tests show no claim or delivery at 4,999 ms and eligibility at 5,000 ms;
restart/reconciliation/wake and new mutation IDs cannot erase the window. Delayed work remains
deliverable after an early queue message. Concurrent manual retry requests preserve existing deduplication.

### Phase 1: Bound execution and cleanup (D4, D5)

Add a shared execution service, generated by Ace, with default capacity two. All three document jobs
acquire capacity before claiming a lease and release it only after processing/cleanup settles.
Queue config uses the same positive integer setting. Pending work starts when a slot is released;
failed claims release slots immediately. Ensure shutdown stops admission and drains running work.
Retain existing heartbeat cleanup. Verify OCR creation failure ownership against installed Tesseract;
if a raw thread cannot be reliably owned, update the design before adding a containment process.

Acceptance: ten blocked tasks never exceed two executing callbacks; success and exceptions release
capacity; queue timeout cannot create a third still-executing callback. OCR success, recognition
failure, initialization failure, and shutdown leave no owned idle threads after cleanup. Run an
integration probe with real local OCR/language data and confirm actual thread exits.

### Phase 2: Align provider retry timing (D3)

Use a shared configurable minimum of 5,000 ms for generation and embedding retry bases; retain
exponential backoff and nonnegative jitter, existing retryability classification, and attempt budgets.
Provider-requested longer `Retry-After` delays take precedence where exposed. Recheck task access
after waits before another external request. Keep SDK retries disabled to avoid stacked hidden attempts.

Acceptance: controlled-clock tests prove no second invocation before five seconds, permanent failures
do not retry, and exhausted attempts terminate. Mocked HTTP verification covers 429/5xx recovery
without using production provider credits.

## 7. Risks and mitigations

- Consumer idleness is expected. Killing it removes processing capacity until restarted.
- A queue timeout may race work without cancelling it. Keep local admission occupied until actual
  work settles; terminate owned OCR on cancellation. Never use low CPU as an idle-work signal.
- Two-second polling means a five-second minimum can become roughly five to seven seconds.
- Long provider cooldowns retain task capacity; task-level failure delays release it back to the queue.
- A local gate is not a cluster cap. Deploy one Redis document consumer; document additional capacity
  when adding processes or using sync. Revisit distributed admission before promising a global limit.
- This session has read-only Git metadata and `.agents/`; docs are placed in existing writable `docs/`.
  Implementation requires a writable isolated checkout; do not claim a branch/worktree/commit was made.

## 8. Open questions

Agreement needed on proposed defaults: two tasks per process and a five-second minimum retry.
OCR initialization ownership must be resolved by the lifecycle probe in Phase 1 before shipping.

## 9. Verification

After agreement, inspect installed CLI help before scaffolding:

```sh
node ace make:migration --help
node ace make:service --help
node ace make:test --help
node ace schema:dump --help
node ace queue:work --help
```

Use a dedicated disposable PostgreSQL test database for migrations/functional tests. Never reset the
configured development database. Scaffold meaningful lifecycle/retry tests with Ace; run them by their
generated paths using the installed runner's filters. Then run the required project checks:

```sh
node ace codegen
npm run typecheck
npm run lint
npm test
git diff --check
```

Manual proof: enqueue a batch through the application; observe at most two active jobs in one consumer,
subsequent assignment on completion, termination of OCR threads, delayed failure/manual retries, and
graceful consumer shutdown. Separately report unit, database, mocked HTTP, and actual runtime evidence.
