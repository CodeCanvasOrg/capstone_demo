# HTML exports implementation plan

2026-11-07. Proposed; no application code changed.

## Decisions and current-state audit

| Current location | Finding | Proposed decision |
| --- | --- | --- |
| `app/services/exports/document_export_service.ts:18` | Request snapshots have no format | Optional HTML format; absent format means PDF |
| Same service, `render` and `download` | Generator, storage MIME, suffix are PDF-only | Select from trusted task format |
| `app/controllers/export_pdfs_controller.ts:69` | Download headers hardcode PDF | Format-aware attachment response |
| `app/services/exports/pdf_service.ts:65` | Full HTML renderer already embeds font | Reuse renderer and add standalone metadata |
| `app/services/workspaces/task_service.ts:289` | Polling returns a download URL | Include safe format metadata |
| `inertia/pages/documents/edit.tsx:158` | Requests and feedback are PDF-specific | Download menu with PDF and HTML |

## Defects and compatibility constraints

No independent blocking defect was established. Preserve legacy PDF payload shape so outstanding tasks and replay fingerprints continue working. Record `format: 'html'` for HTML tasks; treat missing format as PDF throughout. Formats must participate in replay identity so a reused mutation ID cannot silently return another format.

## Target architecture and data model

```mermaid
flowchart LR
  UI[Download menu] --> Route[Format-specific authenticated POST]
  Route --> Task[Existing snapshot and render task]
  Task --> Content[Normalize and hydrate authorized content]
  Content --> Renderer[HTML or PDF renderer]
  Renderer --> Store[Snapshot recheck and private storage]
  Store --> Download[Scoped attachment download]
```

Use existing task JSON payload/result fields. No migration, new table, infrastructure, or dependency. Reuse current controller/service boundaries; no new framework scaffold is needed. A separate architecture document is unnecessary because module relationships remain unchanged.

## API contract

- Preserve `POST /workspaces/:workspaceId/documents/:documentId/exports/pdf`.
- Add the equivalent `/exports/html` route. Route selects format; body cannot override it.
- Both accept required UUID `mutationId`, optional UUID `approvalId` and `baseVersionId`, and return existing `202 { data: { id, status } }`.
- Preserve task polling and download URLs. Add `result.format` to successful render task responses, with PDF fallback for legacy tasks. Never expose storage keys.
- HTML download returns `text/html; charset=utf-8`, `.html` attachment filename, private/no-store caching, and nosniff. Add restrictive meta CSP to downloaded markup to block scripts and external asset loading.
- Preserve workspace authentication, CSRF, 404 scoping, validation, and 409 stale/replay conflicts. Recheck membership, version, approval, and source snapshots at existing lifecycle boundaries.

## Phases and acceptance

### 1. Backend and contract

Implement in `/private/tmp/capstone-html-exports`, branch `feature/html-exports`, already created from current HEAD. Update routes, existing export controller/services, task serialization, and `docs/solo-export-contract.md`.

Acceptance: HTML request/render/download uses real HTML serialization without Chromium, embeds authorized images/font, omits the preview warning for final exports, preserves preview warnings for previews, and retains PDF behavior, cleanup, and snapshot checks.

### 2. Editor

Update `inertia/pages/documents/edit.tsx` using existing shadcn DropdownMenu and Button components. Offer PDF and HTML under Download. Use per-format mutation intents and keep format attached to task labels. Preserve unsaved-draft guards, readiness gates, disabled/loading states, poll retry, and uncertain-response identity.

Acceptance: keyboard/pointer choice works on desktop and mobile; preparing, ready, error, and retry feedback identify the format; editor content survives requests and conflicts.

### 3. Verification

Extend export tests and add `tests/functional/html_exports.spec.ts` as needed. Test real HTML bytes and headers with controlled storage/dispatch; solo/team success, missing approval, stale versions/sources, membership/approval changes during render and before download, workspace isolation, replay and cross-format conflicts, legacy PDF tasks, embedded images, hostile text/URLs, and preview labels.

Functional tests require disposable `TEST_DB_URL` pointing to database `capstone_tenancy_test`; fixture reset truncates data. Confirm CLI flags before running:

```sh
node ace test --help
node ace codegen
npm run typecheck
npm run lint
node ace test functional --files='tests/functional/*export*.spec.ts'
npm test
npm run build
git diff --check
```

Run the app with `./bin/run-dev.sh` when services/browser are available. Download each format, open HTML offline, inspect layout/font/images/citations and absence of external asset requests, and check mobile/keyboard interactions. Report unavailable checks explicitly; static checks do not prove browser behavior.

## Risks and open questions

Keep existing image size limits and cleanup. Validate safe serialization and URL protocols; source navigation can still require authentication. Preserve PDF fingerprint shape with regression coverage. Bind retry identity and labels to the selected format. No unresolved policy decision is needed; scope is case-study document exports. Implementation awaits plan agreement.
