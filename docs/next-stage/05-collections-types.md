# 05 — Collections, selected work and additional content types

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

Proposed 14 November 2026. Covers PRT-01/02/03/04, TPL-06A/B/C. PRT-01/04 are P0; PRT-02 and types P1; PRT-03 P2. Depends on shared renderer and exact entry bundle/approval. Use M5 in [data model](data-model.md). No active collection service, manifest tables or UI found at inspection; new tests are proposed contracts.

## Decisions and defects first

Reuse accepted entries; no regeneration during assembly. Start with supported case-study subset, not an asserted fully supported 41-entry corpus. Resolve D3: current collection tests exercise manifest approval without entry-owner approval in solo workspaces; that is not a final publication policy. D-COLLECTION and D-SOLO must be recorded before enabling public/final collection export. Internal manifest/version/preview work proceeds independently.

Architecture: authorized selected IDs -> pinned immutable manifest -> deterministic wrapper/entry render -> bounded contents-pagination convergence -> private draft PDF -> collection review of complete manifest -> entry/dependency eligibility checks -> final PDF task/publication/download. Entry owners keep their authority.

## PRT-01 — Wrapper, manifest and composition

**Files/interfaces:** new `shared/layout/collection.ts` contains test-facing manifest hashing, budget/contents helpers, selection/summary functions (use current test import names); new `app/services/layout/collection_service.ts` implements `create/list/update/budget/contents/state/approve/assertPublishable`. New collection render orchestration in `app/services/exports/collection_export_service.ts`, reusing render adapter/task authority and M5 persistence. Return service DTO `{id,status,manifest,manifestHash,...}` independent of physical normalized schema.

`create(context,{name,entryIds,wrapper,brand?,options?})` validates nonempty unique accessible saved entries and all refs before any insert; one inaccessible/unknown entry rejects the whole request. Manifest pins ordered document/version/bundle/template/brand/options/asset/renderer identities and explicit wrapper content. Names/cover/about/contact must be provided/reviewed; never invent contacts/statistics. Append immutable manifest revision on meaningful `update(context,id,{baseHash,...})`; stale hash 409, normalized no-op preserves approval. Current functional rename test expects changed hash; include displayed collection name in cover/manifest identity. Do not re-pin entry versions on unrelated wrapper/order change; explicit refresh action shows changes and requires review.

Render cover, short about, category-aware contents, entries, contact/back cover. Two-pass-or-bounded-repeat contents: render entries, measure page counts; render contents, recalculate offsets including wrapper and contents length; repeat to fixed point with small configured cap. Actual rendered page counts override estimates. Fail `contents_not_converged` instead of misleading page numbers. Group dividers included in budget; categories retain deliberate order. Namespaced per-entry footnote and contents anchors; inspect final PDF link destinations after composition. No PDF concatenation approach that drops links or accessibility/text without detection.

Company statistics from explicit deduplicated evidence/defined period only; never equate entry count with delivered projects. Exclude an unsupported content type with clear error; do not force research/news through case-study headings. P1 news can later share pages under versioned packing rules.

**UI:** new Inertia pages `collections/index.tsx`, `collections/edit.tsx`; accessible workspace nav item only when flag enabled. `CollectionList` Table/Card/Empty, `CollectionWrapperForm` Field/Input/Textarea, `CollectionEntries` Table/Checkbox/Select and keyboard Move up/down Buttons (drag optional only with keyboard equivalent), `CollectionPreview` actual PDF viewer, `CollectionBudget` Alert/Badge. Title search/category filters over authorized server results. For P0 simple ordered selection first; PRT-02 adds richer filters/budget target. Distinguish saved manifest from local unsaved wrapper/order.

**Schema:** M5 immutable revisions, dependency index, review/approval/export. **Acceptance:** exact selected IDs/order/version pins, no partial insert on inaccessible item, missing selection error, wrapper rendered, actual contents offsets after entry length/order change, >1 contents page converges, deliberate nonconvergence error, extracted PDF contains wrapper/entry text but no private notes. Real collection artifact required beyond pure arithmetic tests.

## PRT-04 — Collection review and final publication

**Implement:** collection policy validates live workspace/resource capabilities, D-COLLECTION authority and individual entry approvals. Proposed authority is designated collection reviewer for wrapper/manifest, with each entry owner independently approving its exact bundle; keep it proposed until accepted. Internal `approve` mechanics in tests must not grant publication; either explicitly model internal review or revise tests with product/test author when policy is accepted.

Review manifest hash plus dependency bundle hashes. Changed wrapper/order/selection/config invalidates collection approval. Saved newer entry revision makes collection stale per current tests; no silent pin update. Show staleEntries with authorized safe labels. Before final request, after render before publishing, and on download, revalidate current manifest/approval, entry revisions/bundles/owner approvals/required quality and actor's access. A deleted/revoked entry blocks publication; prior ability to view or collection approval grants no source access. Use consistent lock ordering from architecture to avoid multi-entry deadlocks. Entry edit during long render produces stale failure, no accepted final pointer.

**UI:** `CollectionReviewDialog` Dialog/Alert/Checkbox acknowledgments/Badge with current manifest and entry readiness; separate internal preview vs final Download labels. Show which accessible entries need review or repinning, wrapper changes and overall fit findings. Avoid exposing inaccessible entry titles after revocation. State changes preserve local unsaved edits; 409 offers compare/reload, never auto-replace.

**Routes** under workspace auth/resolveWorkspace and CollectionPolicy:

| Method/path                                     | Contract                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| GET/POST `/collections`                         | authorized list / `{name,entryIds,wrapper,...}` -> 201 draft                      |
| GET/PATCH `/collections/:id`                    | safe manifest/state / `{baseHash,mutationId,...changes}` -> new revision or no-op |
| GET `/collections/:id/budget`                   | estimated/measured page arithmetic with target, no false actual-page claim        |
| POST `/collections/:id/reviews`                 | `{baseHash,mutationId}` -> frozen reviewed manifest                               |
| POST `/collections/:id/approvals`               | `{baseHash,reviewId,mutationId}` -> authorized policy-bound approval              |
| GET `/collections/:id/preview`                  | actual private draft PDF, safe diagnostic report on failure                       |
| POST `/collections/:id/exports/pdf`             | `{approvalId,baseHash,mutationId}` -> 202 task                                    |
| GET `/collections/:id/exports/:taskId/download` | recheck live authority/dependencies, stream private accepted PDF                  |

Task polling reuses workspace tasks endpoint, returning correct collection download route. Extend task resource binding/transformer for collection IDs rather than pretending task.documentId is an entry. Deny foreign workspace/missing IDs uniformly, field 422, stale 409. Unselected inaccessible documents never reach filtering output.

**Schema:** M5 review/approval/export and nullable scoped collection reference on task if needed; extend task-kind constraint only after inspection. **Acceptance:** owner approvals cannot be bypassed, revoked member/source/entry denied, wrapper/order changed after review, entry edited during render, stale download, audit rollback and concurrent approve/update, test internal review vs final publication separately.

## PRT-02 — Selected work and budgets

**Implement:** P1 selection/filter/reordering over existing accessible entries; persist exact ordered manifest, not a saved search that changes silently. Budget accounts cover/about/contents/contact/dividers and actual or clearly estimated entry pages. Target suggested by feedback 6–10 entries / 12–20 pages; ten two-page entries plus four wrapper pages is 24, so visibly offer fewer entries or explicit concise layout pins. Never rewrite entry facts or change their approval when merely selecting. A changed entry projection/layout requires its normal review path.

**UI:** search Input, category Select, Checkbox selection, keyboard ordering, budget arithmetic text and warning; “Clear selection” confirmation only where loss matters; selected rows persist across filters and show count. Empty/no results and inaccessible/deleted entry recovery distinct. **Schema:** existing M5 manifest options/selection; no table for filter state needed. **Acceptance:** deselected entry absent from output/contents, ordering survives reload, empty selection 422, stale manifest 409, wrapper-page arithmetic and 20-page target, actual final measurement reconciles estimate. `portfolio_collection` helpers + `collections` DB specs and browser flow.

## TPL-06A — Product profile

**Implement:** P1 after case-study required path. Extend discriminated publication/client contract with product-specific audience, features, workflow, optional approved screenshots, sourced availability and provided CTA; reuse shared text/evidence/figure/brand blocks. New compatible product registry definition only when schema/planner/renderer tests pass. Reserve type already exists; don't enable by merely adding it to a list. Type suggestion editable before generation; changing an existing document type is explicit confirmed revision with new approval.

**Paths/UI:** `shared/publication/content.ts`, `client.ts`, new typed product adapter in `publication_projection_service.ts` or focused service, `shared/layout/templates.ts`, `plan.ts`, outline catalog and existing creation form with small type Select. `ProductFields` uses existing Field/Input/Textarea when product-specific manual metadata is needed; no fabricated deployment/client/result fields. **Schema:** metadata JSON version transition, no product table. **Acceptance:** two reference products, one missing availability/screenshots; no invented deployment metrics, wrong layout rejected, preserved source identity and confirmed type conversion.

## TPL-06B — Research brief

**Implement:** research title, sourced authors/venue when available, plain-language summary, findings, explicit limitations and optional approved key figure. Every metric retains dataset, baseline, units/conditions; relative benchmark gain cannot become realized commercial impact. Add research-specific schema/projection/block binding and registry definition; paper/page/figure references stay pinned. No live metadata lookup during export.

**UI:** existing type/layout selection + `ResearchFields` for optional publication metadata and structured metric-context fields; missing values remain absent/internal finding. **Schema:** versioned metadata/client discriminant, no publication-author table unless a later requirement warrants it. **Acceptance:** two papers including no business results and relative benchmark improvement, missing venue/author, figure source lookup denied where unauthorized, consistent qualifier/context in PDF and across regeneration.

## TPL-06C — News/partnership

**Implement:** headline, sourced event date (separate publication date), short summary, optional approved photo/partner marks and CTA. Dedicated short layout/packing variant; no mandatory challenge/solution/results. Deterministic collection packing can share news page while preserving reading order/captions/uncropped marks; count final pages accurately and honor explicit breaks. Enable news type only with independent schema/visual fixtures.

**UI:** optional date fields with clear labels, photo/mark selection using existing authorized assets, same type/layout controls. **Schema:** metadata JSON only, no news table. **Acceptance:** two examples, one missing photo/date, source/event-date mismatch handled accurately, no invented metrics, multi-news packing without blank page or orphan headline, PDF contents links still point to correct page.

## PRT-03 — Duplicate and family suggestions

**Implement:** P2 deterministic normalized title/source overlap candidates with visible reason; no new embeddings. Add shared pure helper expected by portfolio tests; server filters permitted documents first. Reviewer chooses keep separate/group/exclude; curation choice recorded in manifest, changes require manifest review. Similar title is not evidence of duplicate delivery/client. Never automatic merge/delete; later actual merge needs separate version/provenance design.

**UI:** `DuplicateSuggestions` Collapsible/List/Badge and linked accessible entry titles; Button actions with explanation, reversible before save. **Schema:** manifest curation JSON, no duplicate table. **Acceptance:** similar customs/product entries suggested with reason, false positive retained, inaccessible entry never suggested, explicit choices survive reload, accepted source/version rows unchanged.

## Phases, commands and verification

1. Shared manifest/contents helpers plus scoped M5 draft CRUD; private wrapper preview.
2. Exact collection review/dependency checks after D-COLLECTION; queued final PDF and download.
3. PRT-02 targeted collection with measured full reference size/navigation.
4. Types sequentially (A then B then C, or stakeholder-selected order), each behind capability flag; PRT-03 last.

```sh
node ace make:service layout/collection_service
node ace make:service exports/collection_export_service
node ace make:controller collections index store show update budget preview review approve export download
node ace make:validator collections --resource
node ace make:policy collection view create update review approve export
node ace make:transformer collection
node ace make:page collections/index --react
node ace make:page collections/edit --react
node ace make:model PortfolioCollection
node ace make:model PortfolioCollectionVersion
node ace test unit --files='tests/unit/portfolio_collection.spec.ts'
node ace test functional --files='tests/functional/collections.spec.ts'
```

Generate additional M5 models only where used, using Ace, and migrations from shared data-model plan without duplicates. Existing Japa tests don't yet cover full HTTP/collection-PDF/browser/types; coordinate missing suites with test author. Run codegen/static checks, render actual PDF, inspect contents/link targets and mobile ordering. Rollback disables new collection/type creation; preserve versioned manifests and compatible reads/artifacts, never downgrade a saved product to case study silently.
