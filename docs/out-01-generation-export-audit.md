# OUT-01 — Generation-to-export implementation audit

12 November 2026 · P0 · 2 points · Lead: John · Type: spike

**Outcome:** extend the existing Adonis/React/TipTap/Playwright path. The smallest branded pilot is a versioned, code-owned publication projection and layout inside the current private preview/PDF adapter. Do not replace the framework, editor, evidence service, task store or saved body.

**Audit status: partial acceptance.** Repository map, live catalog inspection, real-entry evidence/HTML preview and before samples are complete. The selected real entry has never been saved through the editor or approved, and current native PDF rendering cannot start Chromium here. Existing automated workflow tests provide separate evidence, not a claim that this real entry completed every stage. Close the remaining runtime acceptance steps below before marking the entire spike implemented.

## Scope and evidence boundaries

Source: [Capstone Project | CodeCanvas](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4/edit), fetched during this audit; provider modified time `2026-11-12T05:07:56.376Z`. Used P-HLD v1.1 §§2–3 (especially §3.1), P-LLD v1.0 §§1.5–1.6, 3.4–3.7, and the refined output-quality backlog. This is an implementation delta, not a replacement HLD. [Release scope](release-scope.md) and [decision register](decision-register.md) record the accepted **PDF-only** release amendment; the shared source still contains historical PPTX requirements.

Checkout: branch `feat/ag-01`; initial application inspection at `f104617`, subsequently `2f25f83` (Added tests), then `711657b` (Tests passed) during the audit. The latter concurrently included the captured audit artifacts and local verification scripts; this audit did not make Git commits. Three pre-existing modified files at entry were `claim_evaluation_service.ts`, its unit test, and `pdf_only_export_routes.spec.ts`; they became clean through concurrent work. No application edits were made by this audit. Findings include the current Jev adapter rather than repeating the older AG-01 statement that it is absent.

Working database: PostgreSQL, inspected without DML; SQL inventory queries used `BEGIN READ ONLY`. Service/HTTP reads were also performed. Existing documents, versions, source selection, tasks and approval pointers were preserved. The missing separate `capstone_tenancy_test` database was created and the existing migrations applied there for destructive fixture tests. No working database migrations were applied.

Status vocabulary: **implemented** = inspected active implementation with relevant verification; **partial** = some behavior exists but story acceptance is incomplete; **missing** = no active implementation found; **unverified** = acceptance cannot be established from this audit. These are local assessments, not updates to an external tracker.

## Repository map against P-HLD §3.1

All paths below are relative to the repository root.

| HLD responsibility | Actual implementation / integration point | Assessment |
| --- | --- | --- |
| Identity and Access | `start/routes.ts`, `start/kernel.ts`, `resolve_workspace_middleware.ts`, `app/services/workspaces/access_service.ts`, Bouncer policies | Session/auth middleware and resource/workspace checks are active. Foundation tests below cover isolation; not a complete OAuth/security audit. |
| Workspace | `app/services/workspaces/{workspace_service,project_service,invitation_service}.ts`, workspace controllers and policies | Membership epoch/context participates in task authorization. Project creation and document creation are currently separate operations. |
| Project Input | `creation_service.ts`, `document_service.ts`, `source_selection_service.ts` under `app/services/documents/`; document/project controllers | Brief, rich project information, selected files, source/input-only mode; creation commits generation intent with document. |
| Files Library | `app/controllers/{files,uploads,file_projects,assets}_controller.ts`, `app/services/upload_service.ts` | Private originals, file revisions, project links and per-document selection. Preserve independent library ownership. |
| Processing | `app/jobs/process_file.ts`, `processing_service.ts`, `files_service.ts`, `chunking_service.ts`, Python worker | Parse → canonical blocks → chunks/context → embeddings → guarded ready publication. Input format gaps remain below. |
| Retrieval and Evidence | `retrieval_service.ts`, `evidence_service.ts`, `chunk_metadata_service.ts`, `assets_controller.ts` | Same-scope dense + lexical/RRF search, pinned runs, trusted metadata hydration and historical lookup. Valid source IDs do not prove factual support. |
| Generation | `generation_service.ts`, `app/services/open_router_service.ts`, `structured_model_output_service.ts`, `outline_template_service.ts` | Current flow produces editable TipTap JSON using code-owned outline files. Historical canonical services are not the active generation acceptance path. |
| Document and Version | `document_service.ts`, `version_service.ts`, models and transformers | UUID current-version pointer; append versions, mutation replay/no-op handling, stale-base conflicts. Generation also writes an accepted version directly within task finish; LLD's single VersionService writer is not literal implementation. |
| Editing | `inertia/components/documents/{editor,change_request,image_upload}.tsx`, `revision_service.ts` | Autosave, local recovery, images and AI revision exist. AI response is applied immediately with undo, rather than a separately confirmed durable proposal. |
| Review and Approval | `workflow_service.ts`, `readiness_service.ts`, `document_reviews_controller.ts`, workflow UI | Exact current review/version, owner approval, warning acknowledgments and invalidation. Full brand/layout/validation bundle is not yet bound on active path. |
| Output | `app/services/exports/{document_export_service,pdf_service}.ts`, `export_pdfs_controller.ts` | Shared content hydration/embedding for private HTML/PDF previews and queued final PDFs; final download rechecks eligibility. No final HTML/PPTX/DOCX/CMS path. |
| Operational Diagnostics | `app/services/workspaces/{task_service,task_dispatch_service}.ts`, `start/scheduler.ts`, jobs, `config/{queue,workspaces}.ts` | Durable tasks/dispatch intent and lease fencing exist. Durable detailed stage/usage/budget reporting is incomplete. |

Service names without a directory in this table live in `app/services/documents/`.

## One real entry: observed trace

Entry 01: **Automating Customs Documentation with Local AI and Computer Vision**.

- Document `08499636-03de-4b76-a7ee-82d5f663a0e6`, workspace `ab6b13a5-514c-4849-96d2-cd4008c5c310`.
- Current version `0a2822cc-9035-4514-89dc-a212fe034e08`, version number 1.
- Generation task `971a7779-7477-4700-a194-0483f91d669c`: succeeded, **2 task attempts**, result points to that version. This is historical execution evidence, not a newly billed provider call.
- Source pin: file `a148ec5e-40dc-4ac4-9c64-1812afd15948`, revision `ed8dd931-b54d-486e-8ad5-d318125f95e9`, run `f1b2131e-8556-4eaf-a2d8-d3063eb75e6b`, pipeline `1`, embedding model `perplexity/pplx-embed-v1-4b`.

| Stage | Real-entry observation | Active code / missing proof |
| --- | --- | --- |
| Generation | Accepted TipTap body, 25 citations and one image; 10 unique evidence chunk IDs. Task timestamps span about 592 seconds across attempts; this is not provider latency. Stage null, telemetry empty, provider_attempts 0 despite task attempts 2. | `GenerationService.request/execute` snapshots source pins/base/input hash, retrieves, calls provider, normalizes and commits only if current task/base/input still match. Historical task lacks persisted generation model/usage identity. Local entry-state artifact reports `openai/gpt-6-luna`, but task alone cannot prove it. |
| Editor open/save | Authenticated edit GET returned 200. No `version_acceptances` rows for this entry and no second version. | `editor.tsx` sends `{content, baseVersionId, mutationId}` after 1,000 ms debounce, one request at a time. `VersionService.save` enforces replay hash, stale base and no-op behavior, hydrates evidence and invalidates approval on changed content. Real browser save remains unverified; disposable workflow test covers save. |
| Evidence lookup | All 10 distinct chunk lookups resolved through service and authenticated HTTP (200), including the image. | `EvidenceService.chunk` checks current selected evidence then authorized historical version references. Original storage paths are not accepted from model output. |
| Preview | Current `DocumentExportService.preview(..., 'html')` produced 680,731 bytes with embedded image/font and preview warning; authenticated preview GET returned 200. | Saved version is rechecked after rendering. PDF preview failed with `E_PDF_UNAVAILABLE` because Chromium could not start. HTTP success is not browser layout proof. |
| Review/approval | Both active pointers null; working database contains zero reviews and zero approvals. Required project-information fields are incomplete. | `WorkflowService.transition` would require readiness/review and owner approval for reviewed final export. **No review or approval was invented.** Tests verify this branch separately. |
| Export | No render task for this entry. Its solo workspace reports `reviewRequired=false`, `canExport=true`, `approved=false`. | Intentional solo draft export can bypass the checklist. Reviewed/team final export requires active approval. This is D-SOLO, not approved-only compliance. |

A separate historical portfolio document `269a7c4d-3529-44b2-af2d-294f84fd9286` has succeeded render task `dd4ffe49-1dde-41eb-98db-d6878c595524`, mode `solo`, approval null, version `7d250e60-d5a4-4063-920e-6ae493d901e0`. This confirms an existing recorded PDF artifact outcome, not this entry's approval or a current successful download. See [historical export trace](audits/out-01/historical-export-trace.json).

### Saved before samples

| Artifact | Provenance and use |
| --- | --- |
| [before.content.json](audits/out-01/before.content.json) | Current real version body; preserve source IDs and qualifiers for later mapping comparison. |
| [before.trace.json](audits/out-01/before.trace.json) | Capture time, task/result/pins, evidence excerpts, readiness and body hash. Internal audit data, not a client render DTO or sanitized CI fixture. |
| [before.preview.html](audits/out-01/before.preview.html) | Newly generated by the active service, self-contained image/font; explicitly preview-only. Contains internal citation metadata and authenticated evidence links; not a public HTML deliverable. |
| [before.historical.pdf](audits/out-01/before.historical.pdf) | Byte-for-byte copy of existing `output/pdf/humblebee-entries/01-case-study--customs-document-automation.pdf`. Four pages, 594,766 bytes; SHA-256 `1ea8fdbc31bb14efc5c55629d75675ef07f4c63a18a7c77b55027b79a15a8129`. Not regenerated today; exact content equality to the current body is unverified. |
| [http-check.json](audits/out-01/http-check.json) | Authenticated editor/preview and 10 evidence endpoint statuses; credentials/cookies omitted. |
| [catalog.json](audits/out-01/catalog.json), [indexes.json](audits/out-01/indexes.json) | Read-only applied migration, key/constraint/index and extension evidence. |

Historical PDF first page was rasterized and visually inspected: long three-line title; repeated filename/chunk/page citations occupy several prose lines; no branded hero/result row/CTA. Preview warning is visible. Four-page count was independently measured with installed PyMuPDF; no full-page-fit or factual certification is claimed. No 173-page collection claim is reused as current acceptance evidence.

## Runtime, adapters and installed versions

Resolved from installed package manifests, not caret ranges. `bun.lock` is committed. Node `24.19.0`, Bun `1.4.3`, Python `3.13.16`, PyMuPDF `2.0`.

| Area | Installed packages |
| --- | --- |
| Backend | `@adonisjs/core 7.5.2`, Lucid `22.4.2`, queue `0.6.2`, Drive `4.0.0`, Adonis Inertia `5.0.1` |
| Frontend | React `19.3.0`, Inertia React `3.7.1`, Vite `8.3.1`, TypeScript `6.0.3` |
| Editor/HTML | TipTap core/react/html/starter-kit `3.31.4` |
| Generation | `@langchain/openrouter 0.4.15`, `@langchain/core 1.2.13`, Zod `4.6.5` |
| PDF/image/data | Playwright `1.63.0`, Sharp `0.35.5`, pg `8.23.1`, installed PostgreSQL vector extension `0.8.7` |
| Input adapters | Mammoth `1.13.0`, Tesseract.js `7.0.0`, pdf-parse `2.4.5`, Python PyMuPDF `2.0` |

Actual local config: queue **sync**, Drive **supabase** (private S3-compatible); configured queue default when unset is Redis. Concurrency setting 5 applies to queue workers; it does not make sync mode a separate worker. Generation uses the default `openai/gpt-6-luna` when `OPENROUTER_MODEL` is unset; embeddings use OpenRouter `perplexity/pplx-embed-v1-4b`, 1,024 dimensions, pipeline `1`. No new provider calls were made. Provider availability/compatibility and accuracy are unverified by this audit.

`config/pdf_worker.ts` defaults to PyMuPDF in development and pdf-parse in production; do not infer production extraction from the development setting. `files_service.ts` actively dispatches PDF, DOCX, TXT, Markdown, JPG/JPEG/PNG. No active PPTX or SVG input branch was found; these remain baseline input gaps even though PPTX **output** is deferred. PDF licensing/production gate already exists in config and is not resolved here.

### Provider output and editor contracts

- `OpenRouterService` uses `ChatOpenRouter` with SDK retries disabled and `withStructuredOutput(..., {method: 'functionCalling'})`. Freeform output is a recursive Zod TipTap document. Outline output is `{sections:[{key,content}]}`; the application inserts headings and rejects duplicate section keys. Neither is the proposed publication DTO with stable claim/result identities.
- Provider IDs are strings copied from supplied chunk IDs; they are not validated UUIDs at the provider schema boundary. `attachChunkMetadata` only retains IDs in the trusted chunk map, discards unknown citation/image references and supplies authoritative excerpt/name/page/URL metadata. Structural repair is not factual validation and silently dropped evidence must be surfaced by OUT-05.
- Current editor extensions: StarterKit (headings 1–4, including its standard marks/link support), custom `SourceCitation`, custom `ImageExtension`, Placeholder. Do not add a duplicate Link/Underline extension merely because standalone packages are installed.
- Current server HTML extensions: StarterKit, plain TipTap Image, server `SourceCitationExtension`. **Parity gap:** editor image width/height/alignment/custom identities are not rendered by that plain Image extension. Citation label is `filename · chunk N · page N`; HTML includes `data-source-chunk-id` and authenticated relative links. These must not become the proposed public reference contract.
- `ClaimEvaluationService` and `config/claim_evaluation.ts` now exist with the chosen Jev decision model. No caller from active generation/readiness/workflow was found. Adapter presence and unit fixtures do not establish persisted claim results, policy enforcement or a verified live provider contract.

### Job behavior and LLD deltas

`workspace_tasks` is authoritative; `task_dispatches` is transactional delivery intent. Queue payload is `{version:1,taskId}`. Task creation keys actor/workspace/kind/mutation, rejects conflicting replay, and binds membership ID/epoch. Claim/renew/finish guard live access and lease token. Lease duration 120 seconds, heartbeat 30 seconds, maximum 3 task attempts. Generate job timeout 10 minutes; render timeout 5 minutes. Web scheduler reconciles/distributes every 2 seconds; `workspaces:dispatch-tasks` also exists. Redis mode requires `bun run queue:work` for queue `documents`.

OpenRouter call loop has at most 3 in-memory attempts with exponential jitter; a timeout gets one extra full deadline. Generation call deadline defaults to 180 seconds, title to 60 seconds. Task-level retries are separate. No durable total provider billing/usage/corrective budget is enforced by this active flow. `stage`, `checkpoint`, `telemetry`, `repair_count` and `provider_attempts` columns exist but sampled generation has no meaningful recorded values. Source-wait deferral releases the lease and refunds a task attempt. Recovery resets dispatch markers for old queued/expired-running tasks; it does not prove exactly-once provider billing or process-restart acceptance.

LLD proposes PostgreSQL polling initially; current code uses a PostgreSQL outcome/lease store with sync/Redis delivery. Preserve the suitable existing adapter. P-HLD itself specifies Redis. These differences do not require a framework change.

## Actual route contract

All current resource routes below are under `/workspaces/:workspaceId`, require authentication and resolved workspace access. `:d` means document ID, `:c` chunk ID, `:t` task ID.

| Method/path after prefix | Handler / role |
| --- | --- |
| `POST /documents` | `Documents.store` → creation + generation intent |
| `GET /documents/:d/edit` | `Documents.edit` → document/workflow/editor props |
| `POST /documents/:d/generation` | `DocumentTasks.generate` |
| `PUT /documents/:d/sources` | `DocumentTasks.sources` → source selection |
| `POST /documents/:d/versions` | `DocumentVersions.handle` → `VersionService.save` |
| `POST /documents/:d/revisions` | `DocumentRevisions.handle` → unsaved AI revision response |
| `GET /documents/:d/evidence/:c` | `Assets.evidence` → authorized excerpt |
| `GET /documents/:d/evidence/:c/asset` | `Assets.asset` → authorized private bytes |
| `POST /documents/:d/images`; `GET /documents/:d/images/:imageId` | document image upload/read |
| `GET /documents/:d/preview` | `ExportPdfs.htmlPreview` → private, no-store, restricted CSP |
| `GET /documents/:d/preview/pdf` | `ExportPdfs.preview` → watermarked PDF or renderer-unavailable 503 |
| `POST /documents/:d/reviews`; `POST /documents/:d/approvals` | `DocumentReviews.store/approve` → exact-version transitions |
| `POST /documents/:d/exports/pdf` | `ExportPdfs.handle` → 202 task identity; `{mutationId,approvalId? ,baseVersionId?}` |
| `GET /documents/:d/exports/:t/download` | guarded succeeded artifact stream |
| `GET /tasks/:t` | `DocumentTasks.show` → authorized status; actual equivalent of proposed `/jobs/:id` |
| `GET /files/:id/download`; `POST /files/:id/retry` | private original/recovery |

`GET /documents/:d/versions/:versionId/preview/:format` redirects to the current preview, not an immutable version-specific preview. Legacy unscoped GETs redirect through resource authorization; retired unscoped mutations do not bypass workspace contracts. Routes are defined in `start/routes.ts`; do not implement proposed HLD/LLD example URLs as duplicate endpoints.

## Tables, pointers and preservation

43 applied migrations were observed. [Catalog](audits/out-01/catalog.json) includes 95 constraints for the selected tables; [index inventory](audits/out-01/indexes.json) includes 26 selected indexes. This is a focused catalog audit, not an assertion that every database object matches every migration.

| Tables | Actual responsibility / key detail |
| --- | --- |
| `users`, `workspaces`, `workspace_memberships`, `workspace_invitations`, `projects`, `project_files` | Actor, tenant, access epoch and organization. Users use int4 IDs; domain resources UUID. |
| `documents`, `document_versions`, `version_acceptances` | Current editable TipTap body + append history + save replay. `documents.current_version_id` is a deferrable same-workspace/document composite FK. |
| `files`, `document_files`, `file_revisions`, `processing_runs` | Persistent file library and selected immutable generation inputs; legacy attachment column is still **files_id**. `document_files.id` int4. |
| `document_blocks`, `chunks`, `chunk_blocks`, `chunk_embeddings` | Source locators, text/image evidence, lineage mapping and vector data. Chunk UUID → file/revision/run; `chunk_blocks.id` int8. Vector column is width-agnostic with configured-width query/index casts. |
| `document_images` | Uploaded document-owned images, separate from evidence chunk identity. |
| `document_issues`, `document_reviews`, `document_approvals`, `workflow_events` | Blockers, review source pins/input hash, owner warning acknowledgment and audit. `active_review_id` / `active_approval_id` are deferrable composite scope FKs, not boolean approval flags. |
| `workspace_tasks`, `task_dispatches` | Durable execution, lease, result/artifact key and dispatch intent. Active PDF path writes artifact identity in task result. |
| `document_templates`, `document_template_versions`, `workspace_brand_versions` | Historical versioned template/brand foundation; current company outlines instead live in `resources/document_templates/{portfolio,technical,vision}.md`. Catalog table presence is not active registry selection. |
| `document_generation_candidates`, `document_validation_reports`, `document_evidence_references`, `document_media_bindings`, `document_claim_reviews`, `document_exports` | Historical canonical/publication foundation; inspect and reuse compatible contracts, but do not claim active path writes these. |

Migrations `1792984351178_create_template_generations_table.ts` and `1793006927296_create_template_snapshot_integrities_table.ts` already add canonical envelopes, snapshot fields and immutability/scope triggers. Current catalog has **zero** canonical versions, brand versions, review/approval records and `document_exports` rows. Do not insert duplicate tables or backfill false provenance. Current final exports use `workspace_tasks.result.artifactKey`, not `document_exports`.

Active generation/save accepts `document_versions.content` with null `content_schema_version`; sampled entry is this legacy/editable shape. Historical canonical validators, projection and approval columns do not automatically govern it. Review stores `version_id`, `input_hash`, `source_pins`; approval stores `review_id`, `version_id`, `approved_by_id`, warning acknowledgments. Active renderer uses `brandVersion: 'humblebee-1'` as a task label but does not resolve it into an approved brand version/layout hash. Updating renderer CSS could change the output for the same approval; APR-01 must bind the actual bundle before new branded final export acceptance.

## Backlog status matrix

This covers every item in the refined output backlog. A partial row is not closed merely because similarly named tables or a standalone artifact exist. PDF-only deferral takes precedence for output formats.

| Item | Status | Evidence / smallest remaining gap |
| --- | --- | --- |
| AG-01 | partial | Local release scope/decisions exist; recorded team acceptance and formal-source corrections remain. |
| OUT-01 | partial | This map and samples delivered; real entry editor-save/approval/native PDF acceptance remains unverified. |
| QA-01 | partial | Entry-01 baseline captured; full edge reference set, sanitized reproducible fixtures and claim sheet not frozen here. |
| OUT-02 | partial | TipTap + historical canonical schema exist; active versioned publication projection, stable claims/results and round-trip mapping incomplete. |
| OUT-03 | partial | Structured issues exist; arbitrary diagnostic prose and internal citation metadata can still reach render body. Need allowlisted client DTO. |
| OUT-04 | partial | Evidence lookup verified; no per-render superscript numbering/deduplicated source block. |
| TPL-04A | missing | No active hero/results/CTA branded pilot in PDF renderer. |
| RND-01A | partial | Private app preview/PDF endpoints exist; pilot not integrated; current native Chromium unavailable. |
| OUT-05 | partial | Structural/schema checks, guards and standalone Jev adapter exist; active factual evaluation, persisted support results and bounded corrective generation absent. |
| TPL-01 | partial | Brand version table/immutability exists; no approved brand rows or active brand-kit selection. |
| TPL-02 | partial | Company outline catalog and historical template tables exist; publication layout registry/compatibility not active. |
| TPL-03 | missing | Renderer is generic TipTap HTML/CSS, not shared typed publication blocks. |
| TPL-04B | missing | No verified standard two-page preset/page-fit contract. |
| TPL-08 | missing | No verified concise one-page case-study preset. |
| TPL-05 | partial | Outline choice/private preview exist; approved brand/layout selection and pinned output configuration missing. |
| TPL-07 | missing | No active reusable workspace publication presets. |
| RND-01B | partial | Same service handles preview/final assets, blocks network, closes browser; extension parity, bounded browser capacity and deterministic render identity incomplete. |
| RND-02 | missing | No active measured page budgets/overflow diagnostics; historical entry is four pages. |
| RND-03 | partial | Manrope embedded and export images bounded to 20 MB each; no final derivative/image budget/font/link/size acceptance suite. |
| EDT-01 | partial | Legacy template compatibility/normalization exists; publication migration preserving full body/evidence still needs mapping fixtures. |
| EDT-02 | partial | Save replay/conflicts/no-op and local recovery exist; stable per-subtree AI/USER authorship and changed-claim handling incomplete. |
| EDT-03 | partial | AI edit with undo exists; response auto-applies and autosaves, without isolated proposal confirmation contract. |
| APR-01 | partial | Current version/review/owner/invalidation tests pass; complete content/source/brand/layout/validation snapshot identity not active; D-SOLO unresolved. |
| EXP-01 | missing | PPTX renderer absent; deferred for this release by D-PDF-EXPORT. |
| PRT-01 | missing | Standalone prior portfolio artifacts are not an in-app ordered collection manifest/wrapper service. |
| PRT-04 | missing | No collection approval/pinned manifest flow. |
| PRT-02 | missing | No collection selection/order/budget contract. |
| TPL-06A | partial | Product vision outline exists; typed product publication layout/acceptance absent. |
| TPL-06B | missing | No active typed research-brief publication layout. |
| TPL-06C | missing | No active typed news/partnership publication block/packing rules. |
| PRT-03 | missing | No duplicate/product-family curation workflow. |
| OPS-01A | partial | Durable task status/lookup exists; detailed durable output stages/timings incomplete. |
| OPS-01B | partial | Dispatch intent, leases/replay/access checks/reconciliation exist; checkpoint reuse and persistent total budgets/cancellation/credential-expiry behavior incomplete. |
| OPS-02 | missing | Global environment credentials only; no safe actor/session BYOK UX/resolver/revoke contract. |
| OPS-03 | missing | Additional generation adapters not selected/verified; current OpenRouter path is reusable. |
| QA-02 | partial | Regression tests below cover current workflow; no accepted publication visual/page-fit/PDF-quality baseline; one generation-suite mismatch remains. |
| QA-03 | unverified | Local model-related artifacts are not a controlled repeated reference-set comparison with measured usage/cost. |
| REL-01 | unverified | No staging UAT, restore/restart rehearsal or controlled release acceptance performed in this spike. |

Additional baseline Must areas: authentication/workspace authorization, ingestion/file library and retrieval foundations were inspected and exercised selectively below. OAuth/account lifecycle, all input adapters, full file-management acceptance and all original Must requirements are **not** declared complete. PPTX/SVG input gaps are independent of output deferral.

## Pilot implementation slice and needed decisions

**Smallest useful change:** introduce one pure, versioned projection from the saved TipTap body plus authorized evidence into a fixed branded layout, called from the existing `DocumentExportService.content/preview/render` path. No new framework, second editable body, public route or new table is required merely to demonstrate a private pilot. Existing schema constraints must be assessed before enabling canonical persistence.

| Sequence | Concrete extension point | Acceptance / dependency |
| --- | --- | --- |
| 0. Resolve recorded mismatch and freeze fixture | `tests/functional/document_creation_generation.spec.ts:162`, `app/controllers/projects_controller.ts`; QA-01 entry and edge fixtures | Decide whether project creation is separate or atomic story creation; align test with accepted behavior. Preserve current document records. |
| 1. Publication contract | Proposed `app/services/documents/publication_projection_service.ts`; existing `content_service.ts`, `chunk_metadata_service.ts` and canonical service contracts | OUT-02: deterministic mapping from accepted content, stable evidence identity and result qualifiers; no second editable JSON. Round-trip/no-loss test before migration. |
| 2. Safe client copy/references | Projection allowlist + `evidence_service.ts`; renderer reference numbering map | OUT-03/04: remove internal metadata/notes from client DTO; retain measured/estimated caveats; 25 citations resolve to same 10 evidence chunks after reorder. Evidence panel keeps authorized excerpt access. |
| 3. Fixed branded layout | Existing `pdf_service.ts`, proposed server-only pilot layout module and versioned approved asset config | TPL-04A: hero, supported results, challenge/solution, capabilities, approved CTA, sources; no-image/no-metric blocks collapse. Behind a flag, existing renderer remains compatible. Promote shared blocks later. |
| 4. Private app preview first | `document_export_service.ts`, `export_pdfs_controller.ts`; current preview UI | RND-01A: same candidate projection/assets through real HTML/PDF preview; visible preview label, current-version/access guard. No public final export acceptance until actual brand/layout identity is covered by approval. |
| 5. Complete final bundle/verification | `workflow_service.ts`, `readiness_service.ts`, task payload/result and existing snapshot columns | APR-01/RND-01B: pin content/evidence/brand/layout/renderer identity; reject stale review/render/download; preserve old records/solo policy until explicitly reconciled. Render actual PDF in a Chromium-capable runtime. |

No Adonis scaffolding or migration is needed for this audit. Future services belong in services, with thin controllers and existing policies. Reuse existing Button/Dialog/Select/feedback components only if a preview toggle or brand selector is needed; the fixed pilot does not require a generalized template designer. Application implementation should follow the repository worktree/plan workflow.

**Needed decisions (do not re-open accepted PDF-only scope or Jev model selection):**

1. **D-BRAND / pilot review — Abu + John:** supply/approve actual logo, fonts/colors, CTA URL/text, rights and one visual reference; identify who signs off. Do not infer a brand kit from the existing Manrope/yellow preview line. A text-only fixed layout can be reviewed internally while assets are pending.
2. **D-SOLO — John + product:** approved-only final PDFs for everyone, a clearly labeled draft-download channel, or an explicit accepted solo exception. Current code intentionally permits unapproved solo downloads. Preserve behavior until the choice is accepted.
3. **D-CLAIMS — Abu + John:** block unresolved AI support flags or allow a specifically authorized audited exception; decide thresholds/uncertainty behavior. Jev selection does not settle these rules or waive human approval/manual-authorship boundaries.
4. **Project creation contract — John:** does creating a project automatically create its first case study? Current controller says no; one existing test says yes. Resolve before repairing code or changing expectations.
5. **Runtime acceptance — John + QA:** select a Chromium-capable environment for actual PDF/visual checks and a disposable copy of entry 01 for save/review/approval/export. Do not approve or rewrite the historical entry merely to make the audit green.

D-CREDENTIALS and D-COLLECTION remain later integration decisions in the existing register; they do not block a fixed private pilot with declared infrastructure credentials and no collection publication.

## Verification and remaining exit checks

Executed on the current checkout; test providers/PDF bytes are mocked where indicated. Functional reset helper refuses databases other than separate `capstone_tenancy_test`.

```sh
node ace test unit --files='tests/unit/content_structure.spec.ts' --files='tests/unit/services/chunk_metadata_service.spec.ts' --files='tests/unit/services/pdf_service.spec.ts'
PORT=3397 node ace test functional --files='tests/functional/document_creation_generation.spec.ts' --files='tests/functional/document_exports.spec.ts' --files='tests/functional/solo_pdf_export.spec.ts'
PORT=3397 node ace test functional --files='tests/functional/workspace_workflows.spec.ts' --files='tests/functional/generation_conflicts.spec.ts'
PORT=3397 node ace test functional --files='tests/functional/workspace_isolation.spec.ts' --files='tests/functional/workspace_preparation.spec.ts' --files='tests/functional/workspace_retrieval.spec.ts' --files='tests/functional/workspace_tasks.spec.ts'
```

- Unit: **7 passed**, including structural repair, trusted reference hydration/removal and mocked PDF generation.
- Creation/export/solo: **16 passed, 1 failed**. Failure: test at `document_creation_generation.spec.ts:162` looks for an automatically created project document and gets `E_ROW_NOT_FOUND`; `Projects.store` currently only saves the project and redirects to it. Export/solo tests passed. Do not delete the test without settling the contract.
- Workflow/conflicts: **21 passed**, including authorized JSON save/review/owner approval/invalidation and stale generation protection.
- Foundation isolation/preparation/retrieval/tasks: **11 passed**. These use controlled fixtures, not a new live extraction/embedding call. See [verification record](audits/out-01/verification.md).
- Existing HTTP editor/preview/evidence: **12/12 returned 200**. This is HTTP proof, not interactive browser acceptance.
- Native PDF attempt: **unverified**, `E_PDF_UNAVAILABLE`; existing PDF unit/functional tests mock the browser/bytes and cannot close this gap.
- First functional attempt hit the existing development listener on 3344; retried on 3397. Then the configured test database was missing; created it separately and applied existing migrations before the recorded runs.

Remaining exit: use a disposable clone of the captured real entry, perform an actual browser edit/save, inspect evidence, preview, complete required review fields, approve as owner, render/download a real PDF; verify a changed source/content/layout rejects stale approval and compare the before artifact. Record exact version/task/approval IDs and environment. A synthetic passing workflow is not substituted for that real-entry acceptance.

### Test correction follow-up — 12 November 2026

The project-creation mismatch above is resolved in `tests/functional/document_creation_generation.spec.ts`. Existing `docs/minimal-creation-revision.md`, project controller and minimal-creation tests establish separate project and case-study creation. The corrected regression verifies rich-description persistence, project-page redirects and no new document/task on project create or rename. Application behavior is unchanged. Reran creation, minimal-creation, approved-export and solo-export suites: **21/21 passed**. This supersedes the earlier failing-test finding and project-creation decision request; real-entry browser/approval/native-PDF limitations remain.
