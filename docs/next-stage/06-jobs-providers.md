# 06 — Durable jobs, recovery and user provider settings

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

Proposed 14 November 2026. Covers OPS-01A/01B/02/03. Dependencies OUT-01/05 and policy-specific decisions. Reuse `TaskService`, `TaskDispatchService`, jobs, scheduler and current Redis/sync queue configuration. M6 in [data model](data-model.md); no replacement queue or mandatory new infrastructure.

## Current state and decisions

Database tasks already claim/renew/fence/finish/reconcile and dispatch intent exists. `workspace_tasks` has stage/error/checkpoint/telemetry/repair_count/provider_attempts. `show` returns limited safe status but only workspace scopes lookup at inspection; verify actor/resource capability on every task read. `config/queue.ts` defaults Redis, concurrency 5; `config/workspaces.ts` has 120s leases/30s heartbeat/three task attempts. Persisted provider-call/content/evaluator budgets must be distinct from worker attempt count. Existing readiness percentage represents review prerequisites, not generation completion; keep those concepts separate.

Current provider keys come from server config; per-user credential resolver absent. Tests of pure `maskKey` and `runWithRetry` do not prove secret isolation, durable budgets or restart recovery. Resolve D1/D5/D8 before those consumers.

## OPS-01A — Durable stages and progress

**Files/interfaces:** new browser-safe `shared/ops/stages.ts` exposes `PIPELINE_STAGES`, `StageTracker`, `checkpointKey`, `classifyFailure`, `runWithRetry` as imported by tests. Pure tracker accepts injected clock, snapshot/restore validates stage/error codes and schema version; server persists task identity/clock timestamps. Persist stage changes via lease-token-conditional TaskService method; fence stale worker telemetry too. Rehydrate current stage/status after refresh from DB, not local tracker memory.

Stages: preparing, retrieving, drafting, validating, rendering, ready_for_review where applicable. Generation needn't pretend rendering happened; export needn't pretend drafting happened. Durable validation status distinct from accepted draft generation. Save per-stage durations, attempts, actual provider/model/usage and missing fields explicitly; safe enum errors only. Never serialize task payload/provider key/evidence excerpts/stack traces or fake percentages to status DTO. Bounded telemetry prevents unbounded task rows.

**API:** preserve GET `/workspaces/:workspaceId/tasks/:taskId`; add `{stage,stageStatus,timings,errorCode,retryable,attempts,validationStatus,result}` fields selected by transformer. Authorize actor/session/resource, active workspace epoch, document/collection access; document link scoped to task workspace. Unknown/foreign task ID 404. Add authorized cancel/retry actions with mutation key and captured task state only if not already present; new credential wait status declared consistently across DB/service/UI. Return safe route to document/collection result, never storage key.

**UI:** new `inertia/components/jobs/task_status.tsx` shared by editor/preview/collections; extend existing polling hook rather than duplicate loops. Named stage and elapsed time, Spinner/Badge/Alert, Cancel when valid, Retry if bounded, reconnect credential action. Poll one active task with backoff; stop/abort on unmount/workspace switch/terminal/access denial, ignore stale responses. Refresh reattaches same task ID from server page props/resource active-task pointer. Offline/status lookup error shows last known state plus retry; never start a new job because response is uncertain. `aria-live=polite`, no looping status announcements each poll, reduced motion support.

**Schema:** reuse stage/checkpoint/telemetry; add fields only if missing per M6. **Acceptance:** job_stages helpers plus DB lease-conditioned persistence/HTTP restart, forbidden same-workspace task, refresh in generation/render, safe errors redacted, no percent field on execution progress, failed validation distinct from draft saved.

## OPS-01B — Recovery, checkpoints and budgets

**Implement:** persist every reservation before outbound provider call in short transaction conditioned on lease/current input/deadline/cancel state. Initial content limit two completed attempts, one corrective, four outbound calls; provider retries consume same total. Worker restarts/transport redelivery/credential reconnect never reset counters. Jev claim checks have independent configurable per-task limit and total task deadline/call ceiling; choose against reference workload with explicit incomplete coverage on cap. Existing database provider_attempts <=6 may require separate evaluator counter, never silently reinterpret it to authorize dozens of calls. Confirm tests and semantics before altering constraints.

Retry only transient timeout/429/selected 5xx with bounded backoff/jitter/Retry-After clamped to remaining deadline. Auth/malformed unsupported options fail or wait for credential, not indefinite retry. Pure helper uses injected sleep/time in tests; durable server orchestration persists next retry/checkpoint and does not hold DB locks while waiting. Cancellation checks before each stage/call, after remote call and before acceptance; in-flight billing may still occur. No exactly-once provider-billing promise.

Checkpoint key includes version/content hash, evidence source pins, prompt/model/rubric, template/brand/assets/renderer when relevant, and entry identity. Reuse only exact-input completed result. For collections checkpoint each rendered entry so one failure doesn't regenerate/re-render completed inputs; no generation during composition. Persist accepted output identity once via task finish/unique task/outcome key. Lease heartbeat survives long provider/render calls; expired worker must not commit content, candidate, report, counters or artifact pointer. Stage/checkpoint writes fence by same token. Source/access revocation checked on resumed work.

Fix validation recovery: generation currently marks task succeeded before best-effort `reviewClaims`. Store separate durable validation task/checkpoint/dispatch intent in the acceptance transaction, or explicitly keep parent task incomplete until checkpoint finishes without accepting draft twice. Prefer child validation task so draft appears immediately while recoverable quality state remains pending; extend task kind and linkage through additive migration. Child intent in same transaction as accepted draft, dedupe by version/input hash. `ready_for_review` requires policy-defined checks complete, not just no thrown exception. Lost lease/unchecked cap recorded incomplete.

**UI:** resume/retry action explains remaining budget, waiting credential vs failed provider vs cancelled vs stale inputs. Cancelled job can't later flash success. **Schema:** M6 checkpoints/counters/deadline/cancel/linkage, reuse dispatch intent. **Acceptance:** restart before/after provider result/candidate/version acceptance, post-draft validation crash, lost HTTP response, stale worker finishes late, duplicate queue delivery, checkpoint mismatch, exhausted budget after restart, revoked credential/source/access, cancel during render, storage success/DB failure orphan cleanup. Test failure injection against actual task store, not just retry helper.

## OPS-02 — User-provided credentials

**Decision boundary:** D-CREDENTIALS unresolved; proposed initial actor/session-scoped protected storage with TTL and revocation, no durable SQL key table. Infrastructure env keys remain separate. Do not write a user's key to `process.env` or global provider singleton. Server adapter receives resolved request/task credential for that actor only. Record explicit expiry/logout/restart/revoke semantics and allowed destination before enablement. Persistent retention/encryption/master-key rotation is a separate accepted design if later selected.

**Files:** new `app/services/providers/credential_service.ts`, `provider_settings_service.ts`, credential validator/controller/safe transformer, server config provider allowlist. New browser-safe `shared/ops/provider.ts` exposes provider descriptors, mask/redact/check helpers with no secret storage. Apply redaction centrally to logs/errors/telemetry, nested objects and bearer headers; never put key into query URL/trace/page props/localStorage/export/task payload/immutable snapshot. One-time submit input password, clear after accepted write. Server stores random opaque ref bound to actor + server session ID + allowed provider; task binding reference only, resume may replace ref with explicit same-actor authorization without changing content intent/budgets.

Only OpenRouter generation path initially enabled; direct provider descriptors may exist as disabled informational capabilities. Allowlist fixed server origins/paths/models; no arbitrary user endpoint, redirects to unknown host or automatic private-source fallback. Connection test is bounded/minimal and may use provider validation mechanism; do not imply success proves every model/schema capability. Live test only with authorized configured account; record usage if billed. Never log raw provider validation response.

**Routes:** proposed actor settings under authenticated `/workspaces/:workspaceId/provider-settings`: GET masked metadata only, PUT credential submit (CSRF protected), POST `/test`, DELETE `/credential`; use session auth + workspace access, no other member key visibility. Add refresh/reconnect task action through TaskService with binding ownership checks. D-CREDENTIALS must decide whether session expiry cancels or waits; display accepted behavior explicitly.

**UI:** new `inertia/pages/settings/providers.tsx` reached by account/settings action; `ProviderSettingsForm` Field/Select/Input(type=password)/Button/Alert/Badge. Masked server metadata (suffix only if accepted), test/save/revoke status, no re-populating full saved value. Pending duplicate submits disabled, invalid key safe message, expired session reconnect, revoke AlertDialog if jobs affected. No source excerpts in errors. Cross-tab revoke should invalidate next task credential resolution.

**Schema:** M6 opaque binding/protected TTL store; no key in DB unless retention design accepted. **Acceptance:** two users/sessions/jobs cannot read/overwrite each other's config, another workspace membership grants no key access, revoke while queued/running, logout/restart expiry, blocked arbitrary URL/redirect, log/nested error redaction, reconnect preserves budget and no silent provider switch. Pure helper tests plus HTTP/store/provider adapter injection required.

## OPS-03 — Additional provider adapters

P1; no direct provider selected yet. Keep parent as plan, refine a separate OpenAI/Google/Anthropic adapter only after explicit selection. Interface: validated input + credential ref + deadline/cancel -> typed output + actual model/provider/usage or safe classified error. Wrap SDK behind server adapter, use same schema/evidence/prompt/candidate acceptance and cumulative budgets. Embedding config unchanged. Recheck selected official provider docs/installed SDK compatibility before choosing dependency; no assumption that OpenAI-shaped endpoint handles structured output/images/cancellation identically.

**UI:** only enabled/tested provider-model pairs selectable; unsupported parameters show fields errors, no auto fallback. **Schema:** normalized provider identity in task/report/snapshot JSON, no per-provider document table. **Acceptance per adapter:** structured output success/refusal/invalid JSON, image access constraints if supported, usage absent/present, timeout/cancel/auth/429, redaction, stale acceptance, mocked common contract and one controlled live call. Model evaluation in QA-03 is separate from transport compatibility.

## Phases and CLI

1. Named stage snapshot -> lease-conditioned DB persistence -> safe polling DTO/browser refresh.
2. Atomic call reservation/checkpoints + durable validation child -> crash/retry/cancel acceptance.
3. D-CREDENTIALS accepted -> protected resolver/settings -> two-user isolation/revoke proof.
4. Selected adapters one at a time after common contract stable.

```sh
node ace make:service workspaces/task_progress_service
node ace make:service providers/credential_service
node ace make:service providers/provider_settings_service
node ace make:controller provider_settings show update test destroy
node ace make:validator provider_settings
node ace make:transformer provider_settings
node ace make:page settings/providers --react
node ace test unit --files='tests/unit/job_stages.spec.ts'
node ace test functional --files='tests/functional/workspace_tasks.spec.ts'
node ace test functional --files='tests/functional/workspace_provider_transport.spec.ts'
node ace queue:work --help
node ace list
```

Scaffold progress service only if TaskService would otherwise grow excessively; one authoritative reservation/fencing implementation. Existing `npm run queue:work` starts documents queue; use staging/test worker with correct isolated Redis namespace. Inspect registered dispatch/reconcile commands before running. No dependency install assumed. Rollback disables new submissions while preserving task outcomes, checkpoint/budget history and secret revocation; no second worker bypassing DB leases.
