# 04 — Editing, migration and exact approval

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

Proposed 14 November 2026. Covers EDT-01/02/03, APR-01. Depends on OUT-02/05, shared renderer and source-aware fixtures. M3/M4 in [data model](data-model.md); transaction boundaries in [architecture](architecture.md).

## Decisions and current-state audit

`VersionService.save` already checks base/mutation, accepts normalized content and invalidates workflow for changes. Editor has debounced save/local recovery; `PublicationContentService` maps/reconciles anchors and authorship. Preserve these implementations and tests. `RevisionService.revise` returns unsaved revised content, but current editor applies it immediately; durable inspect/confirm/reject is missing. Historical candidate table exists with immutable payload and restricted kinds. `WorkflowService` binds version review/owner approval, while full render bundle is still absent. No approval policy is inferred from a helper test.

## EDT-01 — Adopt publication metadata safely

**Files/actions:** extend `publication_content_service.ts` mapper, `legacy_template_service.ts`, existing `commands/map_publication_document.ts` and `convert_template_documents.ts` as necessary. Do not confuse converting old canonical templates with adding publication metadata to ordinary documents. Inspect command signatures before use. Default dry-run report shows before/after text/sections/images/authorship/evidence counts, unknown nodes, unresolved anchors and unavailable provenance. Deterministic identities derive from source version and mapping version. Repeat dry-run identical; repeated apply no duplicate version.

Preserve original immutable content/version/assets/tasks. Apply reviewed mapping as a new normal version through VersionService, against captured base/mutation and current permission; meaningful semantic change clears review/approval. Never infer user/AI authorship or source evidence for unknown legacy blocks. Unknown custom nodes cannot be silently dropped; retain raw original and return actionable mapping finding. First migrate a small reviewed subset, then opt-in expansion behind flag. Export old pinned bundles through compatible renderer; legacy approval remains explicitly unverified if complete bundle absent.

**UI:** `PublicationMigrationNotice` Alert in editor when relevant; “Preview mapping” Dialog shows counts/findings; explicit “Apply mapping” only when authorized, no automatic bulk rewrite on open. Existing version history links original. **Schema:** none for metadata mapping; M3 bundle snapshots created on new review only. **Acceptance:** real representative round-trip retains text/figures/source identities, unknown node reported, missing provenance stays unknown, stale apply 409, rerun idempotent, old versions rerender. No production-wide migration without reviewed dry-run.

## EDT-02 — Manual authorship and save conflicts

**Files/actions:** extend `version_service.ts`, publication reconciliation, editor and local-recovery controls only for verified gaps. The server derives changed subtrees/ranges as user-authored from accepted base; unchanged AI text retains evidence only when exact text/range identity matches. Mixed paragraphs require range-aware provenance or explicit conservative split into separate claims, not tagging an entire mixed paragraph as user to evade AI validation. Structure/assets/source authorization still validate manual text. A failed AI check cannot be bypassed by re-saving unchanged model text.

Version save transaction: current access -> locked document -> mutation-key request hash/replay -> base match -> canonical no-op comparison -> append content/version acceptance and event -> invalidate workflow on meaningful change -> commit. Keep external hydration/provider I/O outside locks, then recheck trusted captured inputs before commit. Expose a transaction-aware acceptance method for candidate confirmation; all writes share caller transaction. Avoid creating a second writer while refactoring generation acceptance: characterize current generation tests first.

**API:** existing `{baseVersionId,mutationId,content}` POST versions; repeated same mutation returns original version; changed body same key conflicts; equal normalized content creates no version/invalidation. Fresh mutation with stale base returns 409 even if UI would like a retry. A lost response is retried with the same key, never new acceptance by accident.

**UI:** reuse editor debounce/serial save. States: saved/saving/offline/failed/conflict. On 409 pause autosave, preserve local content and captured base, offer review current saved content/copy local draft/reload with explicit discard confirmation. No automatic retry against newest base. Local cache scoped by workspace/document/user; clear or quarantine on revoked access/logout so another session cannot load private draft. Refresh restores unsaved state without overwriting server content. Dialog/Alert/Button and existing history; no concurrent editor framework added.

**Schema:** reuse `version_acceptances`, accepted versions and workflow events. No extra autosave table. **Acceptance:** simultaneous two saves one accepted/one conflict; replay after lost response; true no-op preserves approval; manual/AI mixed ranges; changed result anchor needs review; pending local save then workspace switch cannot target wrong document; no stale autosave after conflict.

## EDT-03 — Explicit AI proposals

**Files/actions:** new `document_candidate_service.ts`, candidate controller/validator/transformer, reuse `document_generation_candidates`, durable task store and current `RevisionService` provider adapter. Capture saved `baseVersionId/baseHash`, scoped section/node IDs, evidence pins and instruction. Flush pending manual save before proposal or require explicit saved-base choice; no unseen local content added to provider request. A generated candidate is not accepted content. Candidate payload retains AI authorship/evidence, original proposal and quality report; no full provider response or credential serialized to UI.

**Proposed routes** under workspace/document auth boundary:

| Route                                       | Contract                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| POST `/documents/:documentId/candidates`    | `{baseVersionId,mutationId,instruction,sectionId?,kind}` -> 202 task/candidate reference; allowed kinds server enum |
| GET `/documents/:documentId/candidates/:id` | authorized safe diff, state/base/quality/evidence-change summary                                                    |
| POST `/:id/confirm`                         | `{baseVersionId,mutationId}` -> accepted version, or replay; 409 stale/decided mismatch                             |
| POST `/:id/reject`                          | mutation key -> terminal rejection, no version                                                                      |

Confirm locks candidate/document in consistent order, rechecks pending state/base/hash/authority/authorized pins, applies proposal through transaction-aware VersionService, records accepted version + candidate state + event atomically. Reject conditional pending->rejected, repeat same mutation replays. Accept/reject racing yields one outcome. Stale candidate remains inspectable, never auto-rebases; user may request a new proposal. Section-only changes preserve untouched subtrees/claims/evidence byte identity. Layout shortening uses same candidate flow. Cancellation stops further stages and cannot accept later completion.

**UI:** evolve `change_request.tsx` into instruction submission plus `candidate_review.tsx` Dialog/Sheet. Side-by-side or stacked accessible text diff, additions/removals, section scope, evidence changes, quality findings, Confirm/Reject, saved-base identity. Existing content stays visible until confirm. Loading/cancel/provider error/retry/stale base/candidate expired and uncertain confirm-response states; re-fetch outcome using mutation key. Read-only users may inspect permitted proposal but cannot confirm. Focus moves to changed section after accepted refresh; mobile stacked view, keyboard actions and screen-reader diff labels.

**Schema:** M4 candidate kinds/decision replay fields; use existing task/checkpoint/intent. **Acceptance:** no saved change before confirm, reject no version, accept once on replay, two concurrent confirmations, reject vs confirm, late worker after cancel, stale base, section-only preservation, AI authorship not converted to user, revoked evidence/access denied. A unit diff check alone cannot prove acceptance transaction behavior.

## APR-01 — Exact review and owner approval

**Files/actions:** new `review_bundle_service.ts`, browser-safe `shared/layout/bundle.ts` for `bundleHash/approvalState/canExport` test-facing helpers, extend existing WorkflowService/ReadinessService/review controller/transformers/DocumentExportService. Hash server-trusted content version/projection, source/validation identity, layout/template/brand definitions, immutable asset bytes/config, renderer/settings. A user-supplied hash is optimistic input, recomputed server-side. Asset ID sorting only for unordered set; section/order arrays stay ordered. Exclude keys and reviewer-note text, preserve private immutable report references.

Review captures bundle/validation/render findings against exact current saved state; approved action compares owner capability, base version, current review ID, bundle hash, required warnings/claim policy, source access and severe render issues. Persist snapshot/bundle row + review/approval pointer + workflow event in one transaction. Audit insert failure rolls whole transition back. New no-op selection/content save does not invalidate. Content, projection, layout options, brand/assets/checksums or renderer settings change makes approval stale. Published definition edits forbidden; changed asset bytes require a new checksum/version.

Use existing snapshot_hash columns and `bundleHash` accessor (M3), no divergent writable duplicate. Old reviews without bundle remain historical/unverified; require renewed review for new-flow final output. Final export checks bundle/access at request, after rendering before accepted artifact, and again on download. An owner approval cannot grant source/library access or override severe layout/security failure. D-CLAIMS controls unsupported AI-claim handling; D-SOLO controls solo draft/final distinction. Until resolved do not silently remove existing solo route behavior or claim approved-final compliance.

**API:** existing reviews/approvals routes accept captured bundle hash/review identity alongside current version/mutation; typed stale conflict includes safe reason and refresh instruction, no private source body. **UI:** enhance existing review/approval dialog in edit page with saved version, template/brand revision, preview link, quality/coverage status and permitted warning acknowledgments. `ReviewBundleSummary` uses Description text/Badge/Alert, not raw hashes as primary user copy. Disabled final action explains concrete unresolved finding; owner approval visibly separate from automated checks. Late preview/approval response invalidated when local content/config changes.

**Schema:** M3 frozen bundle + nullable refs; reuse existing approval/review/version/audit rows. **Acceptance:** approval_bundle helper tests plus DB/HTTP: changed bytes same asset ID, changed config/projection/renderer/evidence, stale review, denied owner spoof, failed audit rollback, no-op stays current, render race edit/access revoke, download stale rejection. Test with shared workspace so solo exception cannot hide approval failure. Store old artifact but prevent new unauthorized download under current policy.

## Phases, commands and rollback

1. Characterize existing save/mapping behavior; additive migration dry-run and manual authorship gaps.
2. Durable candidates with safe confirm/reject, integration tests and browser diff.
3. Exact bundle review/approval -> staged render publication -> download checks; native artifact/UI acceptance.

```sh
node ace make:service documents/document_candidate_service
node ace make:service documents/review_bundle_service
node ace make:controller document_candidates store show confirm reject
node ace make:validator document_candidates
node ace make:transformer document_candidate
node ace test functional --files='tests/functional/document_revisions.spec.ts'
node ace test functional --files='tests/functional/generation_conflicts.spec.ts'
node ace test functional --files='tests/functional/workspace_workflows.spec.ts'
node ace test unit --files='tests/unit/approval_bundle.spec.ts'
node ace test functional --files='tests/functional/layout_selection.spec.ts'
node ace test browser --files='tests/browser/change_requests.spec.ts'
```

Add missing candidate/race tests with test author; do not scaffold over existing specs. Common codegen/typecheck/lint applies. Use actual mapping command `--help` before dry-run, not guessed mutation flags. Rollback disables new candidate creation but leaves pending/history intact and retains bundle-compatible reads; never undo accepted content by deleting version/candidate/audit rows.
