# Workspace tenancy implementation status

Approved scope: the three workspace architecture/backend/UI plans in this directory.

Implementation branch: `codex/workspace-tenancy` in `/private/tmp/capstone_demo_workspace_tenancy`.
This is a dedicated Git worktree of an isolated local clone, because the session cannot write to the managed worktree location. The original checkout and its database are unchanged.

## Verified foundation

- Added workspaces, memberships, invitations and projects through Ace-generated models/migrations/factories.
- Added nullable tenant keys throughout the existing evidence graph and composite constraints rejecting mismatched parents, plus editor metadata/current-version references.
- Signup now commits the account, initial workspace and owner membership atomically. Duplicate provisioning locks the account and never restores revoked access.
- Added `workspaces:audit`, `workspaces:backfill` and `workspaces:verify`. Backfill supports rollback-only dry runs, fingerprint checks and reviewed legacy share/resource mapping; it never automatically grants collaborators workspace access.
- Unverified historic approvals preserve their original status and require new review. Invalid legacy evidence is retained/excluded pending repair.
- Created a disposable PostgreSQL/pgvector container (`capstone-tenancy-pg`, localhost 55433, `capstone_tenancy_test`). No existing database was migrated. Functional tests require an explicit disposable TEST_DB_URL.
- Fixed the pre-existing OpenRouter assertion to compare the released secret value. Regenerated/formatted schema classes from actual migrations.

Checks: typecheck passed; lint passed; 26 tests passed (19 existing unit and 7 new functional); migration run/schema generation and audit command passed; diff whitespace check passed.

## Remaining implementation

Request tenancy and canonical routes; scoped lists/services; private storage and retrieval; durable actor/workspace tasks and revocation; SMTP invitation flow; metadata/issues; exact-version review/approval/export; complete HumbleBeeAI redesign; browser and end-to-end cutover verification. Nullable tenant columns are intentionally additive until migration audit/cutover gates are complete.

Production conflict mapping, SMTP identity/credentials, bucket policy and artwork remain rollout inputs. This file records actual work, not a claim that the entire feature is ready.
