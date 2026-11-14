# Implementation overlap at planning handoff

14 November 2026 · Read this before executing any scaffold/migration command in the plans. Source changed concurrently while these documents were written. Initial research captures the opening checkout; this closing read identifies new overlaps. Code presence below is not a verified behavior or test pass. This task changed documentation only.

## Existing work to extend, not recreate

| Planned responsibility        | Observed current implementation                                                                                              | Handoff action                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure layout contracts         | `shared/layout/{checks,footnotes,fit,plan,collection,bundle,hash}.ts`, brand/templates                                       | Use these exact paths. In particular checks live in `checks.ts`, not a new content_checks module. Resolve D1–D8 in existing helpers.                                                                                   |
| Operations helpers            | `shared/ops/{stages,provider}.ts`                                                                                            | Verify server persistence/credential integration separately; don't duplicate helper implementations.                                                                                                                   |
| Selection/presets             | `app/services/layout/{layout_selection_service,layout_preset_service,layout_validation}.ts`; corresponding models            | Extend current methods and audit transaction/access/no-op semantics before adding anything.                                                                                                                            |
| Bundle                        | `app/services/layout/bundle_service.ts`; `shared/layout/bundle.ts`                                                           | Extend existing BundleService rather than create competing documents/review_bundle_service. Current bundle has asset IDs, not byte checksums/projection/source/validation hashes or frozen payload record. D4 remains. |
| Renderer/analyzer             | `app/services/exports/{layout_renderer,client_blocks,pdf_inspector}.ts`; `python/pdf_worker/inspect_pdf.py`                  | Inspect actual readiness/geometry/font/checkpoint behavior and use existing analyzer; no duplicate Python tool. No native acceptance run by this task.                                                                 |
| Catalog/selection controllers | `layout_catalog_controller.ts`, `document_layouts_controller.ts`, `layout_presets_controller.ts`, `app/validators/layout.ts` | Keep split current controllers; don't scaffold a new overlapping LayoutsController. Add safe transformer/policy only for verified gaps.                                                                                |
| Layout UI                     | `inertia/components/documents/{layout_picker,fit_report}.tsx`, inspector/layout integration                                  | Extend current components after browser verification; plan component names are responsibilities, not mandatory duplicate files.                                                                                        |
| Collections                   | `collection_service.ts`, model/controller, current routes                                                                    | Reconcile current mutable manifest/approval implementation with immutable history, approved dependencies and policy-specific final export requirements.                                                                |

## Migration reconciliation

Four new migration files appeared during planning:

- `1794700000001_create_layout_presets_table.ts`
- `1794700000002_create_document_layouts_table.ts`
- `1794700000003_create_portfolio_collections_table.ts`
- `1794700000004_alter_document_approvals_add_bundle_hash.ts`

Do not generate another create-table migration for these tables. Read migration status/catalog before choosing a correction: edit a never-applied pending migration only when coordinated with its author; otherwise use an additive forward migration. This task did not inspect applied status or change these files.

| Shared model proposal                                               | Observed difference                                                                                     | Remaining design/acceptance                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 scoped layout FKs, positive versions/revision, definition hashes | New table has separate document/workspace FKs, no composite scope constraint/hash fields                | Add only missing scoped constraints/checks/hash inputs after audit; existing service authorization remains required.                                                                                                                         |
| M2 preset revision/name normalization/scoped provenance             | Current name limit 80, lower(name) uniqueness, no revision                                              | Use actual 80-character API limit or deliberately amend both validator/schema; trim before store/unique check; plan conflict-safe revision before multi-editor UI.                                                                           |
| M3 authoritative frozen bundle, historical snapshot_hash reuse      | New nullable approvals.bundle_hash column                                                               | Do not delete/rename another contributor's column. Agree one authoritative accessor/field, compatibility mapping/backfill rules and immutable frozen bundle; avoid two writable divergent hashes. New schema never fabricates old approvals. |
| M5 immutable collection manifests/review/approval history           | Current portfolio_collections stores mutable manifest + approved_hash/by/at, status draft/approved only | Extend existing table as collection root and add append-only revisions/reviews/artifact links if required, rather than replace it or assert history already present.                                                                         |

## Remaining release-sensitive gaps visible in this read

Current BundleService computes content/version/template/brand/options/asset IDs/renderer version only. Complete bundle inputs, immutable bytes and review snapshot still need plan 04. `CollectionService.approve` checks current entry revision and stamps collection actor; `assertPublishable` checks membership/current manifest/revision state. This read did not find per-entry owner approval/bundle/quality checks or accepted collection-authority policy there. Treat these as internal mechanics until PRT-04 requirements are implemented and decisions recorded.

Routes currently include catalog/layout/preset apply/CRUD and collection list/create/show/update plus singular `/collections/:collectionId/approval`. Plan 05's review/preview/PDF/task/download routes are additions; preserve current route naming compatibility while extending. `CollectionsController.index` renders `collections/index`; verify the page has been created before considering HTML route acceptance complete. Current controller queries saved workspace documents; audit capability filtering before exposing document choices. Source may change again after this note.

## Verified command/path corrections

Registered command names from source: `qa:output-baseline`, `publication:map-document`, `convert:template-documents`, `workspaces:dispatch-tasks`, `workspaces:reconcile-tasks`. Baseline service is `app/services/qa/output_baseline_service.ts`, fixture manifest defaults `tests/fixtures/output/qa01-v1/manifest.json`. Mapping defaults dry-run, with actor/workspace/document/base-version required and mutation ID for `--apply`. Use command help to confirm installed flags.

## Readiness rule

Before starting a slice, update its current-state row against the live working tree and agree tests/contracts with the contributor. Keep all work on current branch per user instruction. No test, implementation file or migration from this concurrent work was edited by the planning task. A fresh functional/native/browser run is required to assess implementation completion.
