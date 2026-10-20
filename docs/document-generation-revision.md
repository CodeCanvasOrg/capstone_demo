# Immediate creation and generated document pages

Submit one brief, open the document immediately, and generate automatically. Creating a project also creates its first case study from the project brief. Existing workspace policies and exact-version approval remain in force.

## Findings and decisions

- Development inherited a dummy OpenRouter key. Restore the original checkout's key into ignored `.env`; `.env.test` uses a synthetic key.
- Development and tests also shared the disposable `capstone_tenancy_test` database. A test run reset local demo records before this was caught. Development now uses a separate `capstone_tenancy_dev` database with the same migrations; tests refuse to start when their database URL equals development. Existing Supabase storage was untouched. Restart the server and register a local demo account in the fresh development database.
- The synchronous queue runs provider calls inside HTTP requests. Persist creation and generation intent atomically, then let the web scheduler deliver the outbox independently. Redis still requires the queue worker. Reconcile deferred, interrupted and failed delivery each pass.
- Mark delivery before execution so synchronous failures cannot have their retry intent overwritten. Durable execution leases continue fencing duplicate delivery and revoked actors.
- Case-study creation uses one chat composer with optional library/upload evidence. Submitting opens the canonical document immediately. Without attached sources, identify writing from the supplied brief.
- Project creation creates a first input-only case study in the same transaction. Updating a project does not create another document.
- Restore a wide paper surface, border, generous padding and stable focus appearance. Reveal newly generated content with a short, skippable writing animation preserving structured nodes and marks. Never save partial animation frames or steal focus. Reduced motion shows the full result immediately.
- Provider authentication, credits, model and rate errors have safe, actionable messages. Do not expose credentials, prompts, evidence or provider response bodies in logs.

## Verification

Verify atomic creation, project linkage, authorization, immediate redirects and queued intents through HTTP tests. Execute durable generation with controlled provider adapters. Reuse the existing Postman transport fixture if local dataset access permits. Distinguish provider configuration checks, synthetic tests and live generation. Run typecheck, lint, tests, production build and diff checks. Browser verification remains unavailable in this session.

Live verification succeeded with the restored key: the application's embedding client returned 1,024 dimensions and its structured generation client returned two valid document blocks using only a synthetic connectivity brief. No customer files or private evidence were used. The Postman simulation remains unavailable due to the previously recorded local dataset permission failure; controlled-adapter workflow tests and live-client verification are distinct evidence.

Restart development from `/private/tmp/capstone_demo_workspace_tenancy` with `npm run dev`. The web scheduler dispatches committed tasks every two seconds. For `QUEUE_DRIVER=redis`, also run `npm run queue:work`. Operators may use `node ace workspaces:reconcile-tasks` and `node ace workspaces:dispatch-tasks` for manual recovery. `node ace verify:openrouter` shows provider configuration without a network call; `node ace verify:openrouter --live` explicitly sends a synthetic chat and embedding probe and consumes provider credits.

Creation contracts: `POST /workspaces/:workspaceId/projects` atomically persists a project, its first input-only case study, and a generation task, then redirects to the document editor. `POST /workspaces/:workspaceId/documents` atomically persists the supplied brief, authorized sources and generation task, then redirects immediately. Neither waits for provider output. Project updates use the existing `PATCH` endpoint and create no additional document. Source-mode validation or authorization errors roll back the whole creation.

Verification results: 67 tests passed; two optional tests skipped (SMTP and Postman transport). Typecheck, lint, production build, route generation and `git diff --check` passed. A separate local web-server smoke check returned the expected root redirect. Writing-prefix tests cover nested blocks, formatting, Unicode and atomic evidence nodes. HTTP tests cover immediate creation, atomic rollback, project linkage, single accepted generation, transient delivery retry and safe terminal provider errors. The animation suppresses autosave events and history entries, never moves focus, offers “Show full draft”, and honors reduced motion. Browser visual verification remains unperformed.
