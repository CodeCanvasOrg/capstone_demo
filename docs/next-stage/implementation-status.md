# Implementation status

14 November 2026 · Branch `feat/out-03`. Evidence: `node ace test unit functional browser` → 450 passed, 8 skipped (opt-in native/live suites), 0 failed; native PDF suite passes with `LAYOUT_NATIVE_PDF=1`; `tsc` clean for server and client. "Done" means built and tested at the level stated, not UAT-accepted.

## Built

| Backlog | What exists | Where |
| --- | --- | --- |
| TPL-01 | Frozen brand kit v1 (static Manrope 400/600/700/800), validator, spelling check. Logo is a text wordmark and contact is empty: nothing invented. | `shared/layout/brand.ts`, `node ace brand:validate [--strict]` |
| TPL-02/05 | Template registry (concise 1 page, standard 2 pages), compatibility gate, per-document pinned selection with compare-and-set, no-op detection, approval invalidation + audit event | `shared/layout/templates.ts`, `app/services/layout/layout_selection_service.ts`, `document_layouts` |
| TPL-03/04B/08 | Layout plan (hero, stat row, text, figure, CTA, sources); empty blocks collapse; qualifiers stay beside values | `shared/layout/plan.ts`, `app/services/exports/layout_renderer.ts` |
| TPL-07 | Workspace presets (create/update/duplicate/delete/apply), pinned versions, workspace isolation | `layout_preset_service.ts`, `layout_presets` |
| RND-01/02 | One render path for preview and final (banner only differs); estimate-based fitting (compact → suggest template → unresolved); measured-page inspection | `shared/layout/fit.ts`, `pdf_service.ts` |
| RND-03 | PyMuPDF inspector: fonts (embedded, no Type 3), links, size, page stats | `python/pdf_worker/inspect_pdf.py`, `node ace pdf:inspect FILE --budget N --max-mb 8` |
| OUT-04 | Reading-order renumbering, dedupe by label+page, reorder, dangling/uncited detection | `shared/layout/footnotes.ts` |
| OUT-05 | Schema/citation/title/brand/commentary/unsupported-number checks; qualifier preservation; ≤2 targeted repairs keeping the original | `shared/layout/checks.ts` (not yet wired to a model call) |
| APR-01/EDT-02 | `bundle_hash` on approval = content + template + brand + options + asset ids + renderer + definition hashes; export/render/download refuse on mismatch; final export refuses error-severity findings | `bundle_service.ts`, `document_export_service.ts` |
| PRT-01/02/03/04 | Collection manifest (hashed, name included), budget arithmetic with suggestions, contents with converging page numbers, selection/filter, duplicate suggestions, approval bound to manifest + pinned revisions, membership rechecked at publish | `shared/layout/collection.ts`, `collection_service.ts`, `portfolio_collections`, `/collections` page |
| OPS-01A | Durable named stages + timings on `workspace_tasks`, lease-fenced; status DTO has `stage`/`timings`, no percentage; render task records them | `TaskService.recordStage` |
| OPS-01B/02 (helpers only) | Bounded retry/backoff/budget/cancel, checkpoint key, provider allowlist, key masking, secret redaction | `shared/ops/*` (not yet wired to persistence or a settings UI) |
| UI | Layout and branding picker with fit report in the inspector; Collections page | `layout_picker.tsx`, `fit_report.tsx`, `pages/collections/index.tsx` |
| CLI | `brand:validate`, `layout:report`, `pdf:inspect`, `collection:budget` | `commands/` |

## Not done (still open in the plans)

- No collection **composed PDF** (cover/about/contents/back-cover rendering, link audit); only manifest, budget and approval exist. Entry pages use each layout's maximum, not a rendered count.
- PRT-04 does not require per-entry owner approval: D-COLLECTION is unresolved.
- Steps/capability/proof/roadmap blocks, image derivatives/compression (RND-03 size work), asset byte checksums in the bundle.
- EDT-01 migration UI, EDT-03 AI proposals, OUT-05 repair is not connected to a provider call.
- OPS-01B persistence of retry budgets/checkpoints, OPS-02 BYOK settings and session credential store, OPS-03, QA-03, REL-01 (Docker, backup/restore, UAT).
- TPL-06A/B/C product, research and news types stay unavailable by design.
- Brand values, logo and contact still need marketing confirmation (D-BRAND); `brand:validate --strict` fails until then.

## Operating notes

- Run `node ace migration:run` against the development database; migrations `17947000000{01..04}` were applied only to the disposable test database.
- `PUBLICATION_LAYOUT=templates` renders every document through the template system; otherwise only documents with a saved layout selection use it.
- Opt-in native PDF checks: `LAYOUT_NATIVE_PDF=1 [LAYOUT_PDF_OUT=dir] node ace test unit --files tests/unit/pdf_native_layout.spec.ts`.
- Preset management is open to any active workspace member until D-BRAND decides who may publish shared presets.
