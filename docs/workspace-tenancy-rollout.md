# Workspace tenancy rollout and recovery

Implementation: `codex/workspace-tenancy`, isolated worktree `/private/tmp/capstone_demo_workspace_tenancy`. The original checkout and existing database were not modified. This runbook describes operator commands; production execution has not occurred.

## Preparation

Keep the service in maintenance mode from the baseline audit until finalization finishes. Stop every old HTTP process and queue worker; take and rehearse a database backup and preserve private originals/derived assets and the current APP_KEY. Review the Redis `documents` queue's old payloads using the installed queue administration tooling. Drain with the old release or quarantine/export old pending records and recreate attributable requests after cutover. Do not execute unattributed old payloads with the new runtime, or delete an entire shared Redis instance. New workers reject old payload shapes.

Verify the actual storage bucket is private, including existing objects and CDN/public routes. Changing `config/drive.ts` alone cannot revoke historical public links or CDN caches. Disable those public routes and invalidate cached exposure before admitting tenants. Keep original object keys; authorized application routes now deliver bytes. The migration audit reports legacy locator counts without printing their values.

Configure PostgreSQL/pgvector, Redis, private Drive/S3, APP_URL, APP_KEY, authenticated SMTP identity and provider credentials. `.env.example` documents names without secrets. Production uses `QUEUE_DRIVER=redis`; `sync` is for controlled local work. Reinstall from the committed Bun lockfile on Node 24+.

```bash
bun install --frozen-lockfile
node ace migration:status
node ace migration:run
node ace workspaces:audit --output=tmp/workspace-baseline.json
```

Securely review the audit. Preserve this original baseline through finalization. Create `tmp/workspace-mapping.json` with its exact `fingerprint` as `auditFingerprint`:

```json
{
  "auditFingerprint": "COPY_THE_64_CHARACTER_BASELINE_FINGERPRINT",
  "resourceWorkspaces": { "documents": {}, "files": {} },
  "shareResolutions": {},
  "quarantineChunks": []
}
```

Keys and destinations in resource mappings are UUIDs. Every legacy share requires an explicit resolution keyed by share UUID, for example `{ "action": "retire", "reason": "Reviewed loss of document-only access" }`. A `membership` resolution requires already-authorized target membership; it never creates membership. Backfill creates each account's initial workspace but does not add collaborators to other workspaces. Conflicting attachment owners must be mapped to an explicitly reviewed existing workspace whose owners already have active memberships. Resolve duplicate normalized emails manually. Quarantine only explicitly reviewed chunk IDs; their rows and descendants remain preserved and excluded from retrieval. Do not invent empty mappings to suppress conflicts.

## Backfill and cutover

```bash
node ace workspaces:backfill --mapping=tmp/workspace-mapping.json --dry-run
node ace workspaces:backfill --mapping=tmp/workspace-mapping.json --apply
node ace workspaces:verify
node ace workspaces:finalize --baseline=tmp/workspace-baseline.json --mapping=tmp/workspace-mapping.json --dry-run
node ace workspaces:finalize --baseline=tmp/workspace-baseline.json --mapping=tmp/workspace-mapping.json --apply
node ace migration:status
node ace schema:generate
node ace codegen
node ace list:routes --jsonl
```

Dry runs roll back database mutations. Backfill checks the full audit fingerprint under table locks, preserves original IDs/counts, records a one-time legacy migration marker and makes old approvals require new review. Finalization compares original table counts and ID hashes to the saved pre-backfill baseline, requires clean operational tenancy, then enforces NOT NULL tenant keys, operational evidence checks/triggers and normalized email uniqueness. Additive migrations deliberately precede these gates. Repeated backfill needs a new audit fingerprint because the data changed; keep the original pre-backfill baseline and corresponding reviewed mapping for finalization. Do not admit new writes between baseline and finalization: changes invalidate the identity gate.

Run typecheck, lint, tests and build in a separate disposable environment. Functional tests must never target the rollout database. Before opening traffic, smoke-test root resolution, workspace switching, an authorized private download, a denied cross-workspace request, review/owner approval, and final PDF rendering with production-like private storage and a working Chromium installation.

## Workers and recovery

Run HTTP and the queue worker under the deployment's normal supervisor, plus a scheduled bounded recovery pass:

```bash
node ace queue:work --queue=documents,mail
node ace workspaces:reconcile-tasks
node ace workspaces:dispatch-tasks
```

Schedule the last two commands sequentially every minute in the deployment scheduler; do not run an unsupervised shell loop. Reconciliation reopens queued or expired task intents and repairs terminal generation/ingestion status; dispatch processes at most 100 eligible intents per pass. Monitor backlog age and run additional bounded passes if needed. At-least-once transport is safe because PostgreSQL leases fence accepted publication. Revocation or source/input/version conflicts terminate stale work; do not manually reset a revoked task. Create a fresh authorized request instead. Defaults are centralized in `config/workspaces.ts`: 120-second leases, 30-second heartbeats, three attempts and seven-day invitations.

Failed mail delivery retains the invitation and an owner-visible retry action. Resending rotates the token, making older queued deliveries harmless. A workspace owner must still be authorized before mail disclosure. No scheduler automatically emails arbitrary historical recipients.

## Rollback limits

Before cutover writes, restore the rehearsed database snapshot with its matching application/queue/object state if rollback is necessary. Dry-run finalization leaves constraints unchanged. After finalization or new tenant writes, do not start the old user-scoped runtime or blindly roll back migrations: it cannot interpret workspace collaboration, private assets, version approvals or attributed tasks. Use a forward repair or coordinated full restore, accounting for data written since backup. Object storage writes and delivered email cannot be rolled back by a database transaction.

The local rehearsal used disposable PostgreSQL and transactionally rolled back finalization DDL. Production conflict mapping, bucket policy, queue draining, real provider transport and real Chromium rendering remain operator/environment verification inputs. No production cutover or deployment was performed.
