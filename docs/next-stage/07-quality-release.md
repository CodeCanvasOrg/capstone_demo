# 07 — Regression evidence, model evaluation and internal release

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

Proposed 14 November 2026. Covers QA-02/03, REL-01 and deferred EXP-01. QA accompanies each delivery slice; this is not a final phase that postpones verification. [Index](implementation-plan.md) maps every output to its story plan. Tests under active development are preserved; missing tests are coordination items, not a request to replace that work.

## Decisions and current state

Existing Japa unit/functional/browser suites cover document/workspace/evidence/editor/export foundations. New layout tests target many missing production modules; no suite pass is claimed here. `pdf_native_layout.spec.ts` is opt-in (`LAYOUT_NATIVE_PDF=1`), so default skipped tests cannot satisfy PDF acceptance. Existing OUT-01 native Chromium failure is historical and real entry full acceptance remains incomplete. Release needs a compatible verified renderer runtime, actual artifacts, measured results and stakeholder sign-off.

## QA-02 — Continuous publication regression

**Implementation and files:** retain existing tests/fixtures, add story-specific acceptance with authors. Pin CI OS/browser/font files/package lock/locale/timezone/source fixtures and explicit mock provider responses. Reuse Japa runner (`adonisrc.ts` unit/functional/browser suites), `tests/helpers/workspaces.ts`, layout/publication fixtures and baseline tooling. Version reviewed baseline images intentionally; mask volatile times/IDs only, never content or error banners. No automatic baseline update in CI. New content/fit checks also compare claim/reference inventories and actual extracted text.

| Lane                | Existing/new coverage                                                                                                                                           | Required evidence                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Fast contract       | publication_content/mapping/projection/consumers, footnotes, registry/brand, layout_plan/fit, content_checks, approval_bundle, job_stages, portfolio_collection | Sanitized deterministic inputs, invalid/hostile cases, policy assumptions explicit                                                       |
| DB/HTTP             | publication/content/review/exports, layout_selection/routes/presets, collections, workspace_tasks/isolation/workflows, revisions/conflicts                      | Scoped authorization, replay/no-op, concurrent writes, audit rollback, actual migrations/constraints; mocked browser/provider is labeled |
| Browser             | existing publication/change_requests/UI/project/image suites; add layout selection, candidates, collections/provider settings                                   | Desktop + 360px, keyboard/focus, light/dark, 200% zoom, refresh, loading/empty/error/retry/conflict/revoked session                      |
| Native artifacts    | pdf_native_layout plus new collection artifact/contents/font/image checks                                                                                       | Real Chromium/PyMuPDF, 1/2-page cases, readable images, embedded fonts/text, actual destination pages and reference collection size      |
| Failure injection   | task/validation/render/export/credential restart suites                                                                                                         | Expired lease, cancelled/late worker, lost response, storage/DB failure, bounded calls across restart, no duplicate acceptance           |
| Controlled provider | existing adapters + Jev/candidate per selected model                                                                                                            | Explicit account/model identity, settings, usage/latency and safe evidence; separate from routine CI mocks                               |
| Internal staging    | REL-01 UAT/restore                                                                                                                                              | Real authenticated downloads, approved bundles, scoped access, deployment/rollback backup proof                                          |

Add missing negative tests: same-workspace user lacking document access; same filename/page different source revision; modified bytes under same asset ID; validation crash after accepted draft; stale selection while preview renders; collection owner-approval bypass; actual internal PDF destination rather than URL regex; full collection size rather than one tiny PDF. Use native lane as required in release workflow, no `continue-on-error` that turns unavailable tooling into pass.

**Acceptance:** demonstrate intentional citation/qualifier/layout regression is caught; remove deliberate fault and retain meaningful assertions. Report pass/fail/skipped/blocked separately, exact test names/commit/environment, retries separately from successful first attempts, and unresolved defects with owners. A screenshot doesn't prove source support or PDF embedded fonts. No universal accuracy/availability claim from reference results.

**UI/schema:** no new QA dashboard or SQL test-results table. Keep machine-readable run manifest (commit, fixture/model/renderer/font hashes, counts/artifact checksums) plus Markdown release report under versioned sanitized evidence; bulky/private artifacts stored in approved private location. Avoid committing user drafts, credentials and source excerpts without sanitization.

## QA-03 — Model comparison

P1 after QA-01/OUT-05. Build repeatable evaluation on frozen sources/prompts/settings. Compare current generation model against one or two selected candidates, three trials per reference prompt initially. Jev evaluator model remains accepted `typesafe/jev-1.13`; generation model choice is a separate decision and must not silently swap evaluator/embeddings. Record actual provider/resolved model IDs, settings, schema success, human S/C/U and manual-authored counts, qualifier retention, latency, usage/cost when available, and every corrective/retry call in totals. Missing usage/cost stays unavailable, never zero.

**Paths:** extend existing baseline/evaluation command/service if suitable; otherwise new `commands/evaluate_publication_models.ts` and `app/services/evaluation/publication_model_service.ts`, sanitized fixture manifest and result JSON/CSV. Do not perform this experiment during rendering or on production queue. Provider calls need explicit configured test account/consent to evaluated source set; approved scope does not authorize sending evidence to unselected providers. Routine runner supports deterministic mock adapter for format checks, controlled live run separately.

**UI/schema:** no app UI or migrations; default model change via existing config after recorded measured decision. **Acceptance:** reproducible raw trials and decision, false “supported” cases visible, model/quality/latency/cost dimensions separate, no tiny-sample universal claim. Three retries do not count as three independent trials.

## EXP-01 — Deferred PPTX and other formats

D-PDF-EXPORT overrides old backlog's required PPTX path for this release. No PptxGenJS dependency, slide schema, slide preview, exporter, CLI install or migration now. Keep historical FR-EXP-05 and EXP-01 visible as deferred, not completed. Final HTML/DOCX/summary/CMS also deferred; existing internal HTML preview remains.

If explicitly reactivated later: first confirm slide/brand assets and projection/approval scope, audit provider-free PPTX adapter compatibility with installed runtime, freeze reviewed slide projection in bundle, inspect actual file in supported viewer for clipping/fonts/links and stale approval, and write an amended implementation plan. Do not execute those future steps in the PDF-only release. No placeholder download buttons for unavailable formats.

## REL-01 — Controlled internal release

**Files/artifacts:** inspect current Docker/build/deploy/CI files before edits; extend existing assets rather than create a competing deployment setup. Target additions: `docs/next-stage/release-runbook.md`, reviewer guide, acceptance report and environment example additions when implementations land. These are later release deliverables, not claimed present now. Use locked package manager/runtime, locked Python environment, browser build, pinned fonts/approved assets and hashes. Include `shared/layout`/publication code, code-owned definitions and required fonts/assets in production bundle; verify Adonis metafiles/build packaging and runtime resolution, not just dev success.

**Deployment sequence:**

1. Freeze required story scope and decision state. No critical unresolved factual/layout/security defect on reference set; D-CLAIMS/D-COLLECTION/D-BRAND/D-CREDENTIALS/D-SOLO resolved wherever enabled final paths rely on them. Disable unavailable extensions and record deferred items.
2. Build immutable internal image or Docker fallback. Check production browser/fonts/Python analyzer from image, private object storage, session/Redis/DB routing, outbound allowlist, secret injection and redacted logs. Verify source uploads/ingestion baseline, not just new output slice.
3. Backup DB and private original/artifact inventory; record renderer/font/code versions. Apply additive migrations to staging, inspect catalog/constraints/indexes/triggers and smoke old/new bundles. Bound API/render/provider worker concurrency to measured memory; default five browser workers may be too high. Record measured limit instead of inventing throughput.
4. Deploy flags off, verify authenticated liveness/readiness (DB/queue/storage/renderer appropriate), dispatch/reconcile workers and retry deadlines. Health output excludes secrets and private data. Enable pilot/selection then exact approval/collections only when accepted. Poll queues and stale leases, not just web health.
5. Rehearse interrupted generation/validation/render and access revocation. Final artifact must not publish twice; retained budgets/checkpoints recover. Test server restart/session credentials as accepted D-CREDENTIALS policy.
6. Restore one approved content+source+brand/template+asset+render+approval bundle in isolated environment from backup; verify hashes, authority, artifact bytes/text/fonts/links and safe download. Restore process never overwrites working dataset for demonstration.
7. Rehearse rollback to compatible code with flags disabled for new submissions; preserve accepted versions/manifests/artifacts/migrations. If old binary cannot interpret new bundle schema, roll forward compatible fix, not destructive DB rollback. Resume/deny pending jobs according to versioned task protocol.
8. Stakeholder UAT: first five supported case studies, declared selected-work reference, sparse/long/estimated/contradictory fixtures; actual PDF download, readable citations and source inspection, no notes leakage, owner/collection authority and mobile edit/select flow. Marketing accepts brand/copy/layout; owner remains final content approver.
9. Hand off instructions, known limitations, evidence manifest, open defects and before/after demo. Internal build is not proof of public-scale production readiness.

**Required release output matrix:**

| Output                        | Acceptance owner/evidence                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard/concise case studies | Measured native PDF <=2/1 pages for declared reference cases; qualified facts/citations retained; marketing visual review                               |
| Public vs reviewer content    | DTO/leakage tests plus extracted PDF text; authorized source panel                                                                                      |
| Exact approval                | Shared workspace review/owner sign-off bundle; changed config/bytes/access stale request/render/download denial                                         |
| Portfolio                     | Wrapper+actual contents links/page offsets+exact selected pins; accepted collection authority and all entry eligibility                                 |
| File production               | Fonts embedded/no unexpected Type3, selectable text, readable images, reference collection under declared 8 MB threshold                                |
| Reliability                   | Restart/cancel/late worker/credential expiry; persisted budgets/checkpoints, no duplicate accepted output                                               |
| Internal availability smoke   | If adopted, 19/20 reference export jobs complete without manual restart; report failures/retries independently, no availability guarantee               |
| Deployment                    | Migration/health/worker/private storage smoke, isolated restore, compatible rollback, pinned artifact manifest                                          |
| Broader required baseline     | Existing auth/workspaces/file-library/ingestion/RAG requirements explicitly checked; new output work alone doesn't establish historical Must completion |
| Deferred formats/types        | PDF only final release; type/adapters/extensions not accepted remain disabled and documented                                                            |

**UI:** reviewer guide follows actual existing/new actions; no public readiness dashboard or exposed operational internals. **Schema:** only previously reviewed M1–M6 migrations actually needed; no release tracking table. Readiness endpoint/controller only if existing health route insufficient, generated through Ace.

## Verification commands and release evidence limits

Run from correct checkout/environment; functional fixtures require disposable `/capstone_tenancy_test`. First inspect CI/test bootstrap/environment instead of guessing a production DB override.

```sh
node ace codegen
npm run typecheck
npm run lint
node ace test unit functional
LAYOUT_NATIVE_PDF=1 node ace test unit --files='tests/unit/pdf_native_layout.spec.ts' --timeout=120000
node ace test browser
npm run python:test
npm run build
git diff --check
```

Future evaluation scaffold only if existing command cannot serve:

```sh
node ace make:command evaluate_publication_models
node ace make:service evaluation/publication_model_service
```

Record native checks executed vs skipped, actual browser runtime/environment, provider calls mocked vs live, local vs staging and human acceptance. Run a representative release batch only after the required slice passes; don't repeatedly run unrelated full suites after documentation edits. This planning task validates documents only, not any of the release outputs above.
