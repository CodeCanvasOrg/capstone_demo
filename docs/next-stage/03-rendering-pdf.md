# 03 — Private rendering, measured fit and PDF quality

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

Proposed 14 November 2026. Covers RND-01A/01B/02/03. Depends on client projection, TPL pilot/registry/brand and QA-01 fixtures. Use [architecture](architecture.md), M3 bundles/exports and M5 collection artifacts in [data model](data-model.md).

## Current state, decisions and defects

`DocumentExportService` already authorizes requests, uses safe client projection, supports private previews/queued PDFs, and rechecks access/version/approval on download. `ExportPdfService` has base/pilot CSS and native Playwright output. Extend them with the layout-plan adapter instead of another export route. Current render publication writes storage inside the task-finish transaction; move it to private staging before the short final commit. New native tests import missing `layout_renderer`/`pdf_inspector`; don't claim them implemented.

Resolve D4/D6/D7 before acceptance. Layout estimate is not measured PDF fit. Pin exact print/browser/fonts/assets/renderer settings in the review bundle; preview and approved final use that same bundle, with only draft labeling different. No model call during render.

## RND-01A — Pilot through the real private route

**Implement:** finish integration of fixed pilot via existing preview HTML/PDF controller actions and `PUBLICATION_LAYOUT=pilot`, captured current saved version, safe DTO and registered assets. Refuse unknown custom nodes with a field issue. Preserve draft watermark and access checks before/after renderer. Empty unsaved document returns useful save-first state, not empty successful PDF.

**UI:** existing preview action + skeleton/status/retry in `layout_preview.tsx`; actual generated pages, accessible titled viewer and external-open fallback. **Schema:** none for fixed pilot. **Acceptance:** authenticated real-entry HTML and native PDF; no image/no metric; custom image/sourceCitation nodes; user with no resource permission denied; mid-render version change returns conflict. No unauthenticated debug endpoint.

## RND-01B — One frozen render adapter

**Files/interfaces:** new `app/services/exports/layout_renderer.ts` exports test-facing `renderLayoutHtml(plan,brand,{preview?})`; new `render_bundle_service.ts` resolves frozen brand definitions/fonts/assets and assembles LayoutPlan; extend `pdf_service.ts` `html/generate(data,{preview?,publication?,layout?})`. Verify supplied LayoutPlan was server-derived from matching validated client data; external request must not submit a trusted arbitrary plan. Revalidate DTO even when layout supplied so added reviewerNotes cannot bypass privacy. Keep old method compatibility until callers migrate.

Render all supported client nodes/marks with HTML escaping and safe links. No raw user HTML/CSS/JS. Inline allowlisted static font files and approved bounded data-image derivatives; block external browser fetches, local file navigation and unexpected protocols. Registered asset resolution checks workspace/source access and exact checksum; no client path or arbitrary remote endpoint. `await document.fonts.ready`, decode/check images and fail on missing/broken required assets before PDF. Browser/context/page close in finally; bounded rendering deadline, content/image/page limits and worker concurrency protect memory. Reuse browser infrastructure if safe; avoid leaking contexts between tenants.

Explicit print settings: page size/margins, print media, `printBackground`, CSS page-size preference, deterministic locale/timezone and animation-off. Print settings/versions enter bundle/cache key. Prevent watermark from changing pagination: fixed overlay, not an extra flow paragraph that pushes content. Compare layout/text/asset positions after removing draft overlay; PDF byte identity is not required. Cache only by full frozen bundle and render mode; recheck access on every retrieval. Cache may store bytes but never authority.

Storage workflow: private attempt-specific staged key -> compute checksum/inspection -> short DB transaction checks live access/lease/current approval/bundle -> accepted artifact row/result -> cleanup orphan keys. Use immutable key per task/lease attempt; expired worker cannot delete a newer successful key. Never publish before bytes exist. Failed commit produces no download pointer; task reconciler/GC removes unreferenced staged objects with age bounds. Download streams accepted private key only after current checks. Reuse document exports M3 and collection exports M5; preserve current solo task path pending D-SOLO.

**UI/API:** safe failure codes mapped to font unavailable/image unavailable/render timeout/stale preview; no filesystem paths in response. **Acceptance:** same bundle twice same structural layout, static embedded fonts, hostile links/HTML/fetches blocked, missing assets visible, mid-render content/layout/access changes prevent final publication, failed audit/storage/DB commit recover safely. `layout_renderer.spec.ts`, publication export and document export suites.

## RND-02 — Measured page fitting

**Files/interfaces:** `shared/layout/fit.ts`: test-facing `fitPlan`/`inspectPages`; `shared/layout/plan.ts`; server measurement in render adapter; new `app/services/exports/pdf_inspector.ts`. Define `LayoutFinding {code,severity,page?,blockId?,suggestedAction}` and inspection schema. Measured browser block rects and page containers plus final PDF page/text bounding boxes detect overflow/clipping/orphan headings. A character/line model is an estimate only. Calibrate geometry checks against actual PDF pages; fail with `not_measured` when browser/inspector unavailable, never return fabricated success.

Fitting sequence: omit empty optional blocks; measure normal; try one approved compact variant within template min sizes; retain compact only if it improves and fits; otherwise report overflow and offer explicit standard-layout switch for concise. Further shortening uses EDT-03 proposal, preserves qualifiers/citations and requires review. No silent third page, tiny type, hidden overflow or deleted evidence. Compare claim/reference inventory before/after deterministic fitting.

Group heading with following text, list lead with list, result label/value/qualifier, caption/figure. Count footnotes/sources in page budget. Near-empty page <120 words and no figure is warning candidate; explicit cover/contact/divider/news blocks exempt. Inspect unexpected blank pages, clipping, overlap and detached heading with page/block context. A giant figure should scale with preserved aspect ratio within bounds or fail; never make chart text unreadable to pass.

**UI:** `layout_findings.tsx` uses Alert/List/Badge and “Use standard,” “Edit content,” “Propose shorter copy,” “Retry render” according to findings. Distinguish estimated pages from measured pages, show saved version/config identity and stale result state. Severe render findings block final export, while a safe watermarked diagnostic preview remains inspectable. If invalid structure/assets make preview impossible, show report with no fake artifact. Reconcile pure test wording that “draft export is blocked” with internal diagnostic preview availability.

**Schema:** measurement report linked to bundle/export in existing validation/metadata records, immutable report hash; no mutable fit status on accepted content. **Acceptance:** dense footnotes, long headline, oversized image, isolated conclusion, intentional sparse wrapper, normal/compact/suggested-standard paths, same claim/qualifier inventory. Real concise reference = 1 page, standard <=2; known oversized fixture reports overflow. Missing inspection fails required native lane.

## RND-03 — PDF production quality

**Files/actions:** new `image_derivative_service.ts` wraps existing Sharp; keyed derivatives by source checksum, purpose, dimensions, encoding/quality and renderer config. Never replace originals. Photos may use controlled lossy encoding; diagrams/screenshots need readable labels and suitable lossless/high-quality choice. Preserve aspect ratio and captions. Embed static WOFF2/other supported pinned files; inspect PDF font records rather than assuming CSS declaration proves embedding. Verify selectable text, expected glyphs, no unexpected Type3 fonts, source footnotes, safe external and actual internal links.

`inspectPdf(path)` returns `{pages,text,fonts,links,pageStats,bytes?,toolVersion}` as expected by native tests, with scoped temp-file lifecycle and safe subprocess invocation. Reuse the existing Python environment/PyMuPDF dependency after checking `python/pdf_worker/pyproject.toml`/lock; add a small inspection entry point there if none exists, invoked by fixed executable/arguments, not shell interpolated user text. Include page word count, figure rectangles, clipping/heading evidence; report unsupported measurements explicitly. Unit tests may use analyzer fixture output; real artifact acceptance must exercise installed analyzer. Caller cleans temp dirs even on failure.

Email target: declared selected-work reference collection <8 MB (choose and record threshold unit; current tests use `8*1024*1024` bytes). Record entry/page counts, exact bytes and visual readable-figure review. A single tiny PDF below threshold does not satisfy collection target. Separate explicit high-resolution preset with estimated vs measured size; no silent figure degradation. Verify internal contents destinations after collection composition, not just URL protocol regex.

**UI:** output quality Select only if both presets implemented, page/byte results and actionable too-large finding; preserve required figure quality. **Schema:** derived keys/checksums/config in bundle/assets/report; no new source file rows for duplicates unless existing asset registry requires it. **Acceptance:** charts/screenshots readable, source originals unchanged, all fonts embedded/no unexpected Type3, selectable text/Unicode, contents link destination correct, full reference collection <8 MB. Native tests + manual page inspection; PNG browser snapshots alone insufficient.

## Phases, CLI and verification

1. Pilot native-route proof.
2. Shared frozen renderer and private staging publication; adverse browser/asset tests.
3. Measurements and deterministic compact pass; actual fit failures plus UI recovery.
4. Derivatives/inspection and collection reference size/link/font evidence.

```sh
node ace make:service exports/layout_renderer
node ace make:service exports/render_bundle_service
node ace make:service exports/image_derivative_service
node ace make:service exports/pdf_inspector
node ace test unit --files='tests/unit/layout_renderer.spec.ts'
node ace test unit --files='tests/unit/layout_fit.spec.ts'
node ace test functional --files='tests/functional/document_exports.spec.ts'
npm run python:setup
npm run python:test
LAYOUT_NATIVE_PDF=1 node ace test unit --files='tests/unit/pdf_native_layout.spec.ts' --timeout=120000
```

`make:service` emits class stubs; `layout_renderer/pdf_inspector` may export named adapter functions in addition to a service facade to match current tests. Install Chromium only in the chosen verified rendering environment using the locked Playwright CLI (`bunx --no-install playwright install chromium`, or equivalent local binary); Linux images may also need OS libraries. Do not claim a managed macOS crash is solved by API tests; use a compatible renderer runtime and record it. Run common static checks and real browser walkthrough after changes.

## Risks and rollback

PDF and browser pagination can differ; both geometry and artifact inspection are required. Pinned fonts/static definitions and artifact retention preserve old outputs. Disable new renderer entry points if necessary but keep bundle-compatible old artifacts, private access checks and diagnostics. A new renderer version cannot silently replace previously approved bytes.
