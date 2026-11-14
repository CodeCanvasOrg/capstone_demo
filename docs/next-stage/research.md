# Next-stage implementation research

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

14 November 2026. Planning only, based on the current `dev` checkout. Test authors are working concurrently; this is a source inspection, not a frozen test or deployed-database audit. No application code, tests, dependencies, migrations, or remote documents are changed by this planning package.

## Problem and source precedence

The [next-stage plan](../capstone-next-stage-plan.md) describes output goals; the [agile backlog](../capstone-agile-development-backlog.md) splits them into deliverable stories. Later accepted decisions in the [register](../decision-register.md) override stale scope statements: final PDF only; `typesafe/jev-1.13` selected for AI evidence evaluation. PPTX, final HTML, DOCX/summary and CMS remain deferred. Internal HTML preview is retained.

Read the [release scope](../release-scope.md), [OUT-01 audit](../out-01-generation-export-audit.md), and existing AG-01, QA-01, OUT-02 and OUT-03 plans alongside this package. The release matrix remains draft pending team acceptance; accepted individual user decisions are still binding. D-CLAIMS, D-COLLECTION, D-BRAND, D-CREDENTIALS and D-SOLO remain proposed. Their old 13 November target is not evidence of a completed review.

## Current-state evidence

Locations are inspection anchors; line numbers can move as concurrent work lands.

| Responsibility       | Inspected location                                                                                                                            | Finding / implementation consequence                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publication contract | `shared/publication/content.ts:1`; `publication_content_service.ts:129`                                                                       | v1 metadata lives in saved TipTap JSON; case study enabled, other types reserved. Extend this rather than revive a second canonical body.                                                                                 |
| Safe client output   | `shared/publication/client.ts:56`; `publication_projection_service.ts:46`                                                                     | Allowlisted client DTO exists; reviewer diagnostics separate. Preserve this boundary in layout/render work.                                                                                                               |
| Legacy mapping       | `publication_content_service.ts:518`; `commands/map_publication_document.ts`                                                                  | Deterministic mapper exists. Review loss/provenance reporting before adding another migration tool.                                                                                                                       |
| Manual save          | `version_service.ts:19`; `inertia/components/documents/editor.tsx`                                                                            | Base version, mutation replay, authorship reconciliation and local recovery exist. Extend and verify their coverage.                                                                                                      |
| AI revisions         | `revision_service.ts:9`; `inertia/components/documents/change_request.tsx`                                                                    | Returned proposal is applied in the editor; durable explicit confirm/reject is still needed.                                                                                                                              |
| Jev                  | `claim_evaluation_service.ts:36`; `claim_review_service.ts:29,75`                                                                             | Adapter is present. Current extraction checks cited blocks, caps at 40, and creates nonblocking issues. Do not describe the adapter as absent or its coverage as exhaustive.                                              |
| Generation           | `generation_service.ts:133,262,295`                                                                                                           | Saves draft before best-effort claim review; task completion and validation completion are distinct. Durable validation recovery needed.                                                                                  |
| Approval             | `workflow_service.ts:53`; `readiness_service.ts:28`                                                                                           | Current content approval exists; full layout/assets/renderer bundle is missing on active path.                                                                                                                            |
| PDF                  | `document_export_service.ts:24,74,165,209`; `pdf_service.ts:133,255`                                                                          | Pilot switch exists, same privacy projection for previews and export. No shared layout-plan adapter yet. Snapshot checks focus on version/approval/pins. Storage put currently occurs inside task completion transaction. |
| Tasks                | `task_service.ts:126,176,201,294`; `task_dispatch_service.ts`; `config/queue.ts`                                                              | PostgreSQL task/lease authority, dispatch intent, Redis default transport, sync adapter. Reuse; do not replace with a second queue. `show` exposes limited safe status.                                                   |
| Historical schema    | `database/migrations/1792984351178_create_template_generations_table.ts:10-22`; `1793006927296_create_template_snapshot_integrities_table.ts` | Brand/template versions, candidates, validation, evidence, exports and immutable triggers already declared. Presence does not prove active use or deployed state.                                                         |
| New layout work      | `shared/layout/{brand,templates}.ts`; new layout tests                                                                                        | Two code-owned presets/brand scaffolds exist in untracked work. Layout selection, renderer, fit, bundle and collections services imported by tests are absent at inspection. Preserve this work.                          |
| UI identity          | `inertia/css/app.css:7,42,82`; `inertia/components/ui/`                                                                                       | Current UI uses Manrope, rounded controls/cards and semantic tokens. Old skill's sharp-corner/DM Serif statements are stale; follow live CSS.                                                                             |

Service paths without prefixes above are under `app/services/documents/`, exports under `app/services/exports/`, tasks under `app/services/workspaces/`.

## Options and disposition

| Option                                                  | Disposition           | Reason                                                                                                   |
| ------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| Extend TipTap metadata + derived publication DTO        | Adopt                 | Already active; keeps one editable source and evidence ownership.                                        |
| Revive historical canonical-template pipeline           | Reject                | Competes with active editor/contracts; legacy conversion explicitly retained ordinary editable versions. |
| Code-owned registry + bounded selection controls        | Adopt                 | Small compatible presets; arbitrary template authoring is unnecessary and was previously removed.        |
| General visual template designer                        | Defer                 | No current release need, executable-template risk and large UI scope.                                    |
| Reuse workspace task/dispatch/lease services            | Adopt                 | Durable authority and transport already exist.                                                           |
| New PostgreSQL polling queue                            | Reject for this slice | Backlog allows reuse of a suitable audited adapter. Existing Redis/sync path must be hardened first.     |
| Persist new credential table immediately                | Defer                 | Retention policy unresolved; session-bound reference store proposed first.                               |
| Implement PPTX to satisfy older table                   | Reject for release    | D-PDF-EXPORT explicitly defers it.                                                                       |
| Rebuild embeddings / new duplicate-detection embeddings | Reject                | Embedding model fixed; duplicates start with title/source overlap.                                       |

## Installed stack and compatibility

`package.json` declares Node >=24, Adonis core ^7.5.0, Lucid ^22.4.2, Inertia ^5.0.1 / React ^19.2.8, TipTap ^3.31.3, Playwright ^1.63.0, Sharp ^0.35.5, queue ^0.6.2, Zod ^4.6.5, shadcn ^4.21.0. These are declared ranges, not a claim of exact installed versions. Pin the resolved lockfile/browser/font identities in release evidence; `package.json` and `bun.lock` already have unrelated edits.

Local `node ace ... --help` checked for service/controller/migration/page/policy/validator/transformer/test. Custom controller actions, `make:migration --alter`, `make:page --react`, and `test --files` are supported. Generator blocks in plans are future commands, run once for missing files without `--force`.

Official references checked for design boundaries:

- [Lucid transactions](https://lucid.adonisjs.com/docs/transactions): managed transactions can group writes; all participating queries must use their client. Lock order and idempotency are application contracts.
- [Playwright PDF](https://playwright.dev/docs/api/class-page#page-pdf): PDF uses print CSS; explicitly select print dimensions/background handling. Measured fit still needs application checks.
- [TipTap HTML utility](https://tiptap.dev/docs/editor/api/utilities/html): server rendering needs a server-compatible utility and the complete extension list. Unknown custom nodes must not disappear.
- [Sharp output controls](https://sharp.pixelplumbing.com/api-output/): derivative encoding controls are available; readable-chart quality must be measured separately.

No new library selected. Provider alpha API/SDK contracts must be rechecked against official docs before extending the existing Jev adapter or enabling additional providers.

## Gaps to reconcile with test authors

| ID  | Evidence                                                                                                                              | Required reconciliation                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `content_checks.spec.ts` says two automatic repair attempts; backlog OUT-05 says two completed content attempts total, one corrective | One corrective attempt; four outbound content calls initially, including retries. Separate evaluator budget and total deadline. Update expectation by agreement; do not expand runtime budget to pass a test. |
| D2  | Brand fixture marked published with `confirmedBy:null`, no contact; brand test expects no findings                                    | Registry-published is not marketing-approved. Test valid approved fixture separately; retain warnings for shipped unconfirmed data.                                                                           |
| D3  | `collections.spec.ts` approves entries in solo workspace without individual approvals                                                 | Distinguish internal manifest review mechanics from final publication. D-COLLECTION/D-SOLO remain unresolved; no inferred publication authority.                                                              |
| D4  | `approval_bundle.spec.ts` includes asset IDs only                                                                                     | Add immutable asset checksums, projection identity/hash, evidence/validation identities and renderer settings to server bundle; IDs alone cannot detect replaced bytes.                                       |
| D5  | `job_stages.spec.ts` restore comment claims durable identity; pure tracker snapshot only tests stage                                  | Add DB/HTTP/restart checks. Pure helpers cannot prove persistence, fencing or authorization.                                                                                                                  |
| D6  | Native PDF tests opt in; one-entry size check described as email preset                                                               | Keep separate real collection <8 MB acceptance and required native CI lane; skipped tests are unverified.                                                                                                     |
| D7  | Footnote fixture deduplicates by label/page; DTO lacks stable private source identity                                                 | Deduplicate by trusted file/revision/run/page identity before stripping private IDs; same labels can refer to different sources.                                                                              |
| D8  | Current validation is best effort after task success, capped cited-block extraction                                                   | Persist incomplete/unchecked status, schedule recovery with fencing/budget, and never report full factual coverage.                                                                                           |

## Open questions and proof limits

Policy decisions only gate their affected final publication/settings path; semantic fixtures, layout helpers and internal preview proceed. No current application tests, configured-DB migrations, native Chromium, live provider billing, browser UX, asset approval or staging acceptance were executed for this planning task. Repository source was refreshed; older audit evidence remains historical.
