# 02 — Templates, branding and selection UI

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

Proposed 14 November 2026. Covers TPL-01/02/03/04A/04B/05/07/08. Dependencies: OUT-02/03/04 and pilot fixtures; RND adapter/measurement in plan 03; exact approval in plan 04. M1/M2/M3 in [data model](data-model.md).

## Decisions and current-state audit

Preserve untracked `shared/layout/brand.ts` and `templates.ts`; they are starting code, not accepted marketing assets. `BRAND_KITS` uses `confirmedBy:null`, contact empty and text wordmark; `validateBrandKit` correctly warns. Reconcile D2 before enabling final brand selection. Existing `outline_picker.tsx` chooses content outlines, not PDF geometry: keep its role; do not confuse it with the new output selector.

Current UI tokens/components are in `inertia/css/app.css` and `inertia/components/ui/`. Use current Manrope/rounded controls, semantic colors and light/dark tokens. Do not impose older skill typography/sharp corners. Publication print design has independently pinned static fonts/brand tokens. No template authoring screen or custom canvas.

## TPL-04A — Fixed branded pilot

**Implement:** promote existing flagged `PUBLICATION_LAYOUT=pilot` CSS in `pdf_service.ts` into the shared planner/renderer as it stabilizes; one final implementation, no permanent parallel pilot renderer. Render hero, qualified result row, challenge/solution, selected capabilities, optional provided CTA and compact sources. Omit absent image/result blocks without placeholder numbers. Use only approved available assets, label current unconfirmed kit as provisional internal preview.

**UI/API/schema:** existing editor preview action; no new page or DB row needed for fixed pilot. Existing private preview/PDF routes. **Acceptance:** entry 01 and no-image/no-metric/sparse cases through actual app, before/after pages and recorded marketing feedback. Visual direction approval does not approve factual content. Complete with RND-01A.

## TPL-01 — Versioned brand kit

**Implement:** keep code-owned `getBrandKit/validateBrandKit/checkBrandSpelling` and frozen versions. New `app/services/layout/brand_kit_service.ts` resolves actual static fonts/registered logo assets and existing `workspace_brand_versions` for authorized workspace brands. Typed resolver normalizes code and workspace refs; immutable definitions/checksums form bundle inputs. Separate registry publication state from recorded D-BRAND marketing confirmation. Required approved logo/contact/font configuration for a chosen final contact layout cannot be inferred from a syntactically valid asset ID.

Canonical name/glossary must match confirmed assets. Report spelling variants with ranges; do not globally rewrite other proper nouns. Confirm fonts/license and company contacts; keep missing contacts absent in pilot. Draft editing/publishing only via existing brand policy after D-BRAND authority acceptance; no broad branding CMS in this release. New published version leaves prior pins resolvable.

**UI:** BrandSelect: Select + Label + brief version/approval Badge inside layout dialog, disabled unavailable versions with reasons. Provisional badge on internal previews. **Schema:** reuse historical workspace brand versions; code kit uses key/version/hash, never UUID forgery. **Acceptance:** approved fixture vs unconfirmed kit findings; missing font/logo/unauthorized asset fails; old version reproduces after new publication; code/version ID forgery denied; no font filesystem path in catalog DTO.

## TPL-02 — Template registry and selection

**Implement:** extend existing registry `getTemplate/listTemplates/checkCompatibility/resolveOptions`, two initial IDs `case_study_standard` and `case_study_concise`, v1. Resolve exact pinned version; enabled list includes implemented content types only. A disabled template cannot receive a new selection; retained approved artifact/history remains addressable, subject to access/policy. No silent upgrade to latest during rerender.

New `LayoutSelectionService` implements test-facing `resolve(context,documentId)`, `save(context,documentId,{templateId,templateVersion?,brandId?,brandVersion?,options?,baseRevision})`, `applyPreset(context,documentId,presetId,baseRevision)`. Resolve default returns `{saved:false,revision:0,...exact effective versions}`. Save validates full normalized options, type and published versions on server, locks document, compares base revision and effective normalized hash, writes M1 and invalidates workflow atomically only on change. No-op retains revision/review. Every read/write verifies document access, not membership alone.

**API:** workspace-scoped catalog and document layout routes below. **Schema:** M1 + bundle snapshot M3. **Acceptance:** registry and layout_selection tests, forged key/version/path options 422, stale 409 no write, default no-op, audit actor, denial across workspaces and denied same-workspace document capability. Code-owned definitions immutable; no executable user layout strings.

## TPL-03 — Publication blocks

**Implement:** new browser-safe `shared/layout/plan.ts` exposes `planLayout(ClientRenderData,template,brand,options)` -> safe typed LayoutPlan. Stable render-block IDs derive from public render positions/keys, while private node/claim/evidence maps remain server-side. Do not include chunkId/nodeId/claimId in public plan. New `app/services/exports/layout_renderer.ts` consumes typed blocks.

Extract only blocks used by current presets: hero, results, narrative/steps/capability grouping, figure/caption, supplied CTA, sources; roadmap only once semantically supported. Never infer semantic section type from loose heading substring alone when metadata is available. Render nested TipTap public block types including lists/code/quotes/rules/links/images. Unsupported bindings fail with field issue; no silent body section loss. Optional blocks collapse; required empty hero is a finding. Figure aspect ratio/caption stays together; no brand-mark crop. Each rule declares size limits/min type/break grouping/variant.

**UI:** print blocks are server output, not shadcn cards. React `LayoutSummary` uses Badge and concise preview button. **Schema:** none. **Acceptance:** layout_plan/layout_renderer fixtures: long heading, no image/result, estimates/targets with units/context, hostile text, deeply nested lists, long footnotes, dense figure and stable block IDs. Switching presets preserves claim/reference inventory.

## TPL-04B — Standard two-page preset

**Implement:** versioned definition with two-page maximum including sources, normal/compact spacing above declared minimum type, image/no-image variants. Hero, qualified results, challenge, solution/steps and sources; optional capabilities/figures/roadmap only when present. Ship definition only with renderer/measurement compatibility. Existing line-capacity estimates guide preview, actual PDF/geometry is the gate.

**UI/API/schema:** selection option with “Up to 2 pages”; pinned M1 refs; no content mutation on switch. **Acceptance:** first five supported entries and QA-01 edges render within budget or show honest unresolved fit failure. No silent third page, hidden source, missing section or invented proof. Test standard path in native PDF lane.

## TPL-08 — Concise one-page preset

**Implement:** one-page max including citations; same accepted version/projection where content already fits, no provider call just to switch. Omit only declared optional presentation material without dropping material claims/qualifiers; required shortening is a durable EDT-03 projection/content proposal, reviewed before adoption. Preserve original standard version. Offer explicit switch to standard when content cannot fit; never automatically change the selected output.

**UI:** fit Alert with “Use standard layout” and optional “Propose shorter copy”; neither action auto-confirms rewritten text. **Schema:** same selection/bundle records; new accepted content only on confirmed change. **Acceptance:** identical qualified metrics/source bindings across both presets, one-page real PDF for reference cases, overflow remains visible, new approval after semantic shortening. Distinct from deferred one-page summary export FR-EXP-04.

## TPL-05 — Selection and actual output preview

**Files/components:** add `inertia/components/documents/layout_picker.tsx`, `layout_preview.tsx`, `layout_findings.tsx`; integrate into existing `inertia/pages/documents/edit.tsx` inspector/actions. LayoutPicker uses Dialog, Select, Label, Field, Button, Badge; imageMode Select (auto/with/without), provided CTA text/link inputs only when supported. No large creation-page gallery. Preview uses existing authenticated HTML/PDF endpoints in sandboxed frame/object or new-tab action with accessible title and fallback download/open link. Any frame CSP/sandbox must allow required rendering without allowing arbitrary scripts/navigation. Preview content is server-escaped and asset allowlisted.

**Routes** (all under `/workspaces/:workspaceId`, auth + resolveWorkspace, current document policy):

| Method/path                                                      | Input / output                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET `/layout/catalog?docType=case_study`                         | `{data:{templates,brands,presets}}`, safe descriptors/options/page budgets; unsupported reserved type empty list |
| GET `/documents/:documentId/layout`                              | `{data:{selection,compatibleChoices,fit}}`; unsaved document fit is `not_measured`, not a fake render            |
| PUT `/documents/:documentId/layout`                              | selection payload with baseRevision; 200 selection, 422 fields, 409 stale, scoped 404                            |
| GET existing `/documents/:documentId/preview` and `/preview/pdf` | captured exact version/layout/brand identity; draft watermark and current fit/quality status                     |

New `LayoutsController` actions catalog/show/update, `layout` validator and `LayoutSelectionTransformer`; controller delegates business rules to service. Catalog filters workspace brands/presets by authority and strips font paths/bytes. Map mutation errors to field messages. Preview response tied to captured content/selection revision; abort/discard late response when user changes selection. Poll current task endpoint for asynchronous work.

**State/accessibility:** load Skeleton, no compatible templates Empty with reason, save pending disables duplicate submit, preview loading/status, renderer error Retry, stale save preserves chosen unsaved options with Reload/Review choices, forbidden/revoked hides resource data and stops polling. One primary action. Sheet/full-width mobile dialog, labeled inputs, keyboard selection, focus restoration, `aria-live=polite` status, no progress percentages. Check 360px and desktop, light/dark, 200% zoom and long names.

**Acceptance:** layout_routes/layout_selection specs plus browser choose->save->actual preview->reload->same pins; fast switches cannot display stale output; changed selection invalidates approval; no-op does not; unsupported doc type never falls back to case study. Do not claim fit from word-count estimate.

## TPL-07 — Workspace presets

**Implement:** P1 after selector stable and shared-preset authority accepted under D-BRAND. New `LayoutPresetService` create/list/update/duplicate/remove and scoped transformer/policy/validator/controller. Test-facing signatures in `layout_presets.spec.ts` retained, adding optional baseRevision for conflict-safe UI updates. Trim names, enforce case-insensitive DB uniqueness, validate pinned versions/options. Apply copies resolved pins into document; preset update/delete cannot mutate previous selection/bundle. Optional block order only inside permitted slots; always preserve required limitations/sources.

**Routes:** GET/POST `/layout-presets`, PATCH/DELETE `/:id`, POST `/:id/duplicate`; 201 create/duplicate, 204 delete, 409 revision/name conflict, 422 invalid fields, scoped 404. Preset management capability separate from document apply capability.

**UI:** compact preset Select in layout dialog; SavePresetDialog (Dialog/Input/Field/Button), DropdownMenu duplicate/delete, AlertDialog destructive confirmation, inline duplicate-name errors. No new navigation destination required. Read-only users see only permitted choices, no mutation actions. **Schema:** M2; `presetId` informational provenance, values pinned independently. **Acceptance:** two-document apply, update/delete leaves old output intact, two-editor conflict, duplicate name race, cross-workspace read/apply/change/delete denial.

## Phases and CLI

1. Pilot and valid/invalid brand fixtures; confirm D2 findings and current-branch test contracts.
2. Pure registry/blocks + server selection transaction/catalog; preview one real saved entry.
3. Shared standard/concise render and measured findings; browser selection/refresh acceptance.
4. P1 presets after authority recorded; independently verifiable reuse.

Future CLI for missing framework files only:

```sh
node ace make:service layout/brand_kit_service
node ace make:service layout/layout_selection_service
node ace make:controller layouts catalog show update
node ace make:validator layout
node ace make:transformer layout_selection
node ace make:service layout/layout_preset_service
node ace make:controller layout_presets index store update destroy duplicate
node ace make:validator layout_presets --resource
node ace make:policy layout_preset view create update delete
node ace make:transformer layout_preset
node ace codegen
node ace test unit --files='tests/unit/template_registry.spec.ts'
node ace test unit --files='tests/unit/layout_plan.spec.ts'
node ace test functional --files='tests/functional/layout_selection.spec.ts'
node ace test functional --files='tests/functional/layout_routes.spec.ts'
node ace test functional --files='tests/functional/layout_presets.spec.ts'
```

Existing shadcn primitives cover the UI; no install needed. If a truly missing primitive is selected later, use installed shadcn CLI and inspect generated diff. Plain React components/shared helpers have no Adonis generator. Follow common codegen/typecheck/lint and DB safety rules.

## Risk and rollback

Definition edits require a new version even if only typography changes. Disable new selection via feature flag but preserve old renderer definitions/assets and immutable bundles. Unknown brand rights cannot be solved by code-kit `published` status. No final output advertised as approved company branding before D-BRAND evidence is recorded.
