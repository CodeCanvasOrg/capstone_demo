# 01 — Content, evidence and baseline implementation

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

Proposed 14 November 2026. Covers AG-01, OUT-01–05, QA-01. Depends on [research](research.md); schema M4 in [data model](data-model.md). Existing per-story documents remain detailed references; this plan defines their remaining integration work.

## Decisions and current state

Reuse `shared/publication/{content,client,tiptap_extension}.ts`, `PublicationContentService`, `PublicationProjectionService`, `PublicationDiagnosticService`, `PublicationReviewService`, `EvidenceService`, `ClaimEvaluationService`, `ClaimReviewService`, and baseline command/services. Current version saves already reconcile publication metadata. Jev review is present, best effort, capped and nonblocking; comprehensive coverage, persisted reports and final sign-off policy remain incomplete.

Resolve D1, D7 and D8 before quality/footnote integration. No new editable schema or fresh provider call during render. Architecture: accepted TipTap -> authorized evidence hydration -> private stable identity map -> allowlisted client projection -> deterministic checks/footnotes -> render; private report retained separately.

## AG-01 — Scope closeout

**Paths/actions:** retain [AG-01 plan](../ag-01-scope-reconciliation-implementation-plan.md), `release-scope.md`, `decision-register.md`. Correct the touched AG-01/EXP-01 and release-format rows in the older backlog when agreed, linking D-PDF-EXPORT and preserving historical FR-EXP-05. Record actual team review/owners and refreshed targets for unresolved decisions; elapsed date never accepts a decision. Confirm current requirement mapping against formal sources when editing those mappings; do not invent FR IDs.

**UI/API/schema/CLI:** none. No issue tracker or remote source publication implied.

**Acceptance:** PDF-only scope visible across touched local documents; each unresolved policy has status/owner/next review; accepted user decisions remain accepted; no claim of fulfilling all historical 68 Must requirements. This planning package documents the discrepancy but does not silently amend source requirement documents.

## OUT-01 — Close the real-entry trace

**Paths/actions:** extend `docs/out-01-generation-export-audit.md` with new evidence only after running it. Follow one authorized real case study through saved editor mutation, evidence endpoint, watermarked preview, required review/owner approval and actual downloaded PDF. Capture immutable IDs/hashes, environment/browser/font identity, output bytes/pages and failures. Use disposable copies when action would alter an existing approved record. Reuse `commands/qa_output_baseline.ts`, export controller/service and existing workflow routes.

**UI:** existing editor, inspector, review dialog, preview and download actions; no audit admin screen. **Schema:** none for the spike. **CLI:** `node ace list:routes --jsonl`; inspect baseline command help before running. No benchmark provider calls needed to prove stored-output rendering.

**Acceptance:** real save/approval/download trace with extracted PDF text and inspected pages; forbidden user evidence/preview/download denied. If native renderer unavailable, preserve missing proof and arrange compatible runtime in REL-01; do not close based on stubbed PDF tests.

## QA-01 — Freeze and reproduce the baseline

**Paths/actions:** follow [existing QA-01 plan](../qa-01-output-fixtures-implementation-plan.md), `commands/qa_output_baseline.ts` and existing `output_fixture_contract`/`output_baseline_service` tests. Resolve the actual baseline service/fixture locations via imports rather than creating a duplicate quality folder. Link sanitized `tests/fixtures/layout/entries.ts` to source-aware fixture manifest; distinguish fabricated CI data from real-entry measurements.

Record first five supported case studies, source file/revision/run identities, model/prompt/settings when known, expected claims/qualifiers, author labels, measured pages/bytes/stages, reviewer S/C/U labels and missing data. Add long title, absent figure/result, estimates/targets, contradictory evidence, long references, repeated entry and dense chart cases. Unknown historical model/latency stays unknown. Reference collection explicitly declares entries, wrapper and target budget; original 173-page report remains reported feedback until remeasured.

**UI/schema:** no new app UI or DB table; versioned sanitized JSON/CSV plus actual artifact checksums in ignored evidence output. **Acceptance:** another contributor reproduces baseline without private secrets; manual labels separate from automated verdicts; current provider and native/browser evidence identified independently. Expanded type fixtures added only when each type is enabled.

## OUT-02 — Retain the publication contract

**Paths/actions:** [existing OUT-02 plan](../out-02-publication-content-implementation-plan.md), `shared/publication/content.ts`, `publication_content_service.ts`, `version_service.ts`, `generation_service.ts`, editor extension. Keep schema version 1 and `content.attrs.publication` authoritative. Review current implementation-status section before changing anything. Stable nodes/claims anchor ranges with text hashes; result context retains value, units, comparison, qualifier, scope, baseline/period and methodology. Unknown authorship remains unknown; do not regenerate historical evidence.

**API:** reuse POST document versions and existing field-level 422 envelope. Trust only server-resolved asset/evidence identities. **UI:** reuse `content_validation.tsx` and inspector to locate metadata errors; optional absent content collapses. **Schema:** none; metadata already fits saved content JSON. Additional type contracts are P1 in plan 05.

**Acceptance:** malformed/unsupported metadata 422 without saved mutation; lost-response replay identical; unchanged AI anchors/evidence retained, changed manual text reconciled, old immutable version untouched, one round-trip real entry. Run existing publication content/mapping/consumer tests, not a rewritten suite.

## OUT-03 — Retain client/reviewer separation

**Paths/actions:** [existing OUT-03 plan](../out-03-client-reviewer-separation-implementation-plan.md), projection/diagnostic/review services, exports adapter, inspector. All renderers accept ClientRenderData only. Private reference mapping, task details, reviewer notes and source paths never enter LayoutPlan or HTML/PDF. Material factual limitations and estimated/design-target labels remain public.

**UI:** existing issue inspector; reusable `PublicationFindings` only if needed by layout/candidate views: Alert + Badge + field links, no source excerpts in toasts. **Schema:** reuse version-bound issues and validation reports. **API:** no full model serialization; transformers select fields explicitly.

**Acceptance:** clean client DTO, hostile/custom-node coverage, reviewer sentinel absent in extracted PDF text and HTML, caveats preserved; check legacy and new layout paths. Diagnostic lint reports exact fields; no regex globally deletes words such as “source.” Cross-workspace diagnostics/evidence requests denied.

## OUT-04 — Stable footnotes and evidence inspection

**Paths/actions:** new `shared/layout/footnotes.ts` exposes test-facing `renumberFootnotes`, `reorderSections`, `validateFootnotes`. Extend projection server private mapping to retain immutable file/revision/run/chunk/page tuple and range bindings. Walk actual reading order (hero summary, result references where supported, then sections); dedupe trusted identity and locator before removing private IDs. Distinct revisions/files with identical display label/page stay distinct; filename change does not break identity. Same file different pages remain distinct notes. Per-entry numbering in collections; HTML anchors namespaced with entry/bundle key to prevent collisions.

Client source v1 currently has number/label/page only, and ClientResult has no citation field. Preserve contract compatibility: retain result-to-reference relation in private projection mapping and add a validated optional public numeric `references` field only if the render requires one, with an explicit client schema-version transition/test vectors. Do not accept arbitrary internal IDs or unknown new DTO keys merely to satisfy fixtures. Reordering helper returns a new projection, never mutates accepted content. Summary/body citations continue to use existing ClientInline reference nodes.

**API:** reuse `/workspaces/:workspaceId/documents/:documentId/evidence/:chunkId` for authorized evidence; map clicked display number to trusted private reference endpoint server-side. No source URL synthesized, no public private-source URL. Persisted evidence identity owns provenance, current display map owns numbers.

**UI:** extend current citation controls/inspector with `EvidenceReference` Button/Tooltip and evidence Sheet/Dialog on mobile; source title/page/excerpt, explicit unavailable/revoked state and retry. Keyboard operable references, return focus on close, `aria-describedby` source descriptions. Client PDF footnotes link to local source anchors; full excerpt remains internal.

**Schema:** no new table; reuse metadata/evidence references, pinned source manifest. **Acceptance:** footnote suite plus two same-name different-file/revision cases, renamed source, reorder, repeated citation, missing URL, revoked source and two-entry anchor collision checks. Rerender old snapshot retains same source mapping.

## OUT-05 — Quality checks and bounded repair

**Paths/actions:** new browser-safe `shared/layout/checks.ts` supplies `checkContent`, `checkQualifierPreservation`, `repairContent` names if imported by current test (recheck exact exports before implementation); use it for deterministic rules only. Server orchestration belongs in new `app/services/documents/content_quality_service.ts`; extend current Jev and publication review services rather than introduce another factual validator. Inspect existing test adapter argument shapes before writing functions.

Deterministic checks: valid structure/assets; dangling/unused notes; repeated headline/summary; known brand variants; targeted pipeline commentary; numbers lacking result/citation context; changed qualifier/units/baseline/period; citation authorization/membership. Citation presence never yields a supported verdict. Findings include stable code, severity, field/block/claim locator and safe action. Model verdicts use exact authorized evidence, input/rubric/model hashes and explicit unavailable status. Manual authored text is exempt from automated support checks, still subject to structural/security checks. Mixed authorship must survive proposal acceptance.

Add coverage reporting for uncited AI text, capped/skipped claims and unavailable evaluation; expand from cited positional blocks to stable metadata claims. Current 40-claim cap is a budget decision, never a silent “all checked” success. Store complete/incomplete report in existing append-only validation records M4; private issues link version/report. Human reviews stay separate. Safe summary DTO exposes counts without private excerpts.

Repair only affected candidate fields. Keep original candidate and attempt records; schema/citation/qualifier check the entire repaired candidate. Initial rule: at most two completed content attempts total (one correction), four outbound content calls including transient retries, and a persisted deadline. Jev evaluator calls need a separate declared limit plus overall ceiling. Coordinate D1 with test author before changing their “two automatic attempts” expectation. No valid findings means no model call; auth failure no retry; exhausted repair keeps internal preview/error and never overwrites accepted version. Accepted text changes use EDT-03 confirmation.

**UI:** existing `ContentValidation` and inspector findings, with safe field jump, inspect source, request proposed fix, retry evaluation where budget remains. Show checking/unchecked distinctly; no invented accuracy percentage. **Schema:** M4 report reuse, M6 persisted budgets. **Acceptance:** clean/no-call, invalid JSON, invented source, lost “up to,” changed units/baseline, mixed manual/AI, false-supported fixture, unavailable provider, one-correction exhaustion and stale evaluation cannot clear a newer issue. D-CLAIMS decides final sign-off, not these helpers.

## Phases, commands and verification

1. Resolve D1/D7/D8, complete audit/baseline mapping; accept reproducible source/fixture manifest.
2. Reuse verified OUT-02/03, add OUT-04; accept real private citation preview and no leakage.
3. Add deterministic checks/reporting, then bounded server repair and recoverable Jev checks through OPS-01B. Accept failure/cancel/restart behavior before publication integration.

Future scaffolds only if absent:

```sh
node ace make:service documents/content_quality_service
node ace qa:output-baseline --help
node ace publication:map-document --help
node ace test unit --files='tests/unit/footnotes.spec.ts'
node ace test unit --files='tests/unit/content_checks.spec.ts'
node ace test functional --files='tests/functional/publication_content.spec.ts'
node ace test functional --files='tests/functional/publication_review.spec.ts'
```

Check actual registered custom command names with `node ace list`; baseline/mapping command names above were confirmed from their Ace classes; recheck flags before applying. No framework generator is needed for plain shared functions or ordinary React components. Common codegen/typecheck/lint and disposable DB rules are in the index.

## Risks and unresolved policy

D-CLAIMS is still open; current nonblocking Jev behavior is preserved until explicit sign-off handling is accepted. Internal checks remain visible and cannot masquerade as completed factual review. Baseline fixture labels are human evidence, not automated universal-accuracy claims. No code/test change is authorized by this document alone beyond the user's planning request.
