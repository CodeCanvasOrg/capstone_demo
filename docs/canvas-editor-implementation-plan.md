# Canvas editor (GrapesJS): implementation plan

Status: proposed, 21 Nov 2026. Research: `canvas-editor-research.md`.

## Goal

Brochure pages can be laid out freely: move, resize, layer, add and remove boxes on A4 sheets. Text
keeps citations, footnotes, checks and approvals. The PDF matches the editor.

## Decisions

> **Change during build (21 Nov 2026):** the stored format is our own canvas model
> (`shared/canvas/model.ts`: sheets → frames with mm geometry and brand colour references), not
> a GrapesJS project subset. The browser converts to and from GrapesJS at the edge
> (`shared/canvas/grapes.ts`), like `toPaged`/`toFlat`. This makes validation a plain zod schema,
> keeps the renderer and the derived text independent of GrapesJS, and stops an editor upgrade
> from changing stored data. The `project` columns below hold this model. `shared/canvas/grapes_types.ts`
> registers our component types (model only), so a headless GrapesJS can load the project in tests.

1. **GrapesJS core 0.23.9, pinned exactly.** No Studio SDK, no `@grapesjs/react` (its peer range
   excludes 0.23). Mounted with our own hook.
2. **Canvas JSON is the source of truth for layout** when a document is in canvas mode. The flat
   Tiptap document is **derived** from it on every save and stored in `document_versions.content`,
   so checks, evidence, publication `accept`, the web export and RAG keep working unchanged.
3. **Closed component catalog.** Only `sheet`, `text-frame`, `image-frame`, `figure-frame`, `shape`
   and `group`. No raw HTML, no scripts, no custom code components.
4. **Server never trusts client JSON.** A zod allowlist validates every project. Export uses our own
   renderer, never `editor.getHtml()` (see the security finding in the research).
5. **Geometry in mm**, integers in tenths of a mm (`x: 200` = 20.0 mm), stored on the component as
   `attributes['data-geo']` and mirrored to CSS. PDF and editor read the same numbers.
6. **The model never writes canvas JSON.** Generation is unchanged. The composer turns pages + designs
   into a canvas with templates.
7. **Opt-in per document**, behind `CANVAS_EDITOR=pilot` (same pattern as `PUBLICATION_LAYOUT`).
   Flow documents are untouched. A document can go back to flow mode, which discards the canvas.
8. **Autosave goes to a draft.** Saving a version is explicit, like today. GrapesJS emits a change
   per drag step, and one version per step would flood `document_versions` and invalidate reviews
   constantly.
9. **Web export stays on the derived text document** (responsive). The PDF uses the canvas.

## Architecture

```
Browser (inertia/pages/documents/canvas.tsx)
  React shell (shadcn panels) ──events──▶ GrapesJS iframe (sheets + frames)
                                           └─ Tiptap mounted in the active text frame (custom RTE)
  custom storage adapter ── PUT draft (revision CAS) / POST version (mutationId, baseVersionId)
                                   │
Server  DocumentCanvasesController ─▶ CanvasService
          validate (shared/canvas/schema.ts allowlist)
          derive text (shared/canvas/derive.ts) ─▶ VersionService.save (existing pipeline)
          store canvas row 1:1 with the new version
Export  DocumentExportService ─▶ canvas_renderer.ts (validated JSON → HTML) ─▶ pdf_service (Chromium)
Compose shared/canvas/compose.ts: brochure pages + DesignId[] + BrandKit ─▶ project JSON
```

## Database schema

Four migrations. Postgres. Same conventions as `layout_presets` / `document_layouts`: uuid keys,
workspace scoping, timestamptz, compare-and-set `revision`.

### 1. `document_canvases`: one immutable canvas per saved version

```ts
// database/migrations/<ts>_create_document_canvases_table.ts
this.schema.createTable('document_canvases', (table) => {
  table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
  table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
  table.uuid('document_id').notNullable().references('documents.id').onDelete('CASCADE')
  // 1:1 with the version whose `content` was derived from this canvas.
  table.uuid('version_id').notNullable().unique().references('document_versions.id').onDelete('CASCADE')
  table.integer('schema_version').notNullable()           // CANVAS_SCHEMA_VERSION
  table.jsonb('project').notNullable()                    // validated GrapesJS project subset
  table.specificType('project_hash', 'char(64)').notNullable() // hashOf(project), joins the bundle
  table.smallint('sheet_count').notNullable()
  table.string('source', 16).notNullable()                // 'composed' | 'edited' | 'template'
  table.uuid('template_id').nullable().references('canvas_templates.id').onDelete('SET NULL')
  table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
  table.index(['document_id', 'created_at'])
  table.index(['workspace_id'])
})
this.schema.raw(
  "ALTER TABLE document_canvases ADD CONSTRAINT document_canvases_source_check CHECK (source IN ('composed','edited','template'))"
)
```

No `updated_at`: rows are never updated. A change makes a new version and a new row.

### 2. `document_canvas_drafts`: autosave buffer, one per document

```ts
this.schema.createTable('document_canvas_drafts', (table) => {
  table.uuid('document_id').primary().references('documents.id').onDelete('CASCADE')
  table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
  // The version the draft started from; saving fails with 409 if the document moved on.
  table.uuid('base_version_id').nullable().references('document_versions.id').onDelete('SET NULL')
  table.integer('schema_version').notNullable()
  table.jsonb('project').notNullable()
  table.integer('revision').notNullable().defaultTo(1)    // CAS for concurrent tabs
  table.integer('updated_by').nullable().references('users.id').onDelete('SET NULL')
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
  table.index(['workspace_id'])
})
```

### 3. `canvas_templates`: system and workspace page/document templates

```ts
this.schema.createTable('canvas_templates', (table) => {
  table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
  // NULL workspace = system template (seeded from the nine designs).
  table.uuid('workspace_id').nullable().references('workspaces.id').onDelete('CASCADE')
  table.string('name', 80).notNullable()
  table.string('kind', 16).notNullable()                  // 'sheet' | 'document'
  table.string('design_id', 32).nullable()                // DesignId it was seeded from
  table.integer('version').notNullable().defaultTo(1)     // pinned like layout presets
  table.integer('schema_version').notNullable()
  table.jsonb('project').notNullable()
  table.specificType('project_hash', 'char(64)').notNullable()
  table.uuid('thumbnail_image_id').nullable()             // rendered preview in drive
  table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
  table.index(['workspace_id', 'kind'])
})
this.schema.raw("ALTER TABLE canvas_templates ADD CONSTRAINT canvas_templates_kind_check CHECK (kind IN ('sheet','document'))")
this.schema.raw(
  'CREATE UNIQUE INDEX canvas_templates_scope_name_key ON canvas_templates (COALESCE(workspace_id::text, \'system\'), lower(name))'
)
```

### 4. Alter `document_layouts`: editor mode

```ts
this.schema.alterTable('document_layouts', (table) => {
  table.string('editor_mode', 8).notNullable().defaultTo('flow')
})
this.schema.raw("ALTER TABLE document_layouts ADD CONSTRAINT document_layouts_editor_mode_check CHECK (editor_mode IN ('flow','canvas'))")
```

### Approval bundle

`ReviewBundle` (`shared/layout/bundle.ts`) gets an optional `canvasHash?: string`, set from
`document_canvases.project_hash` when the version has one, and `rendererVersion` becomes
`canvas-1` for canvas exports. Bundles without the key hash exactly as before (`canonicalJson` skips
undefined; covered by a test). Moving a box therefore invalidates an approval, as editing text does.

## Shared module (`shared/canvas/`, browser-safe, pure)

| File | Contents |
| --- | --- |
| `catalog.ts` | `CANVAS_SCHEMA_VERSION = 1`. Component types and per-type rules (stylable props, min/max size, allowed children). A4 = 2100 × 2970 tenths of a mm. Single source for editor config, validator and renderer. |
| `schema.ts` | zod allowlist for the stored project: `{ pages:[{ id, component: wrapper }] , styles: [] , assets: [] }`. Wrapper → `sheet[]` → frames. Allowed attributes per type (`data-geo`, `data-order`, `data-role`, `alt`, `src` limited to `/documents/:id/images/:imageId` paths or registered `document_images` ids). Text frames hold `doc` (Tiptap JSON checked with `documentSchema()`). Style values limited to the catalog's props and safe values (colours from the brand palette or hex, lengths in mm/pt/%, no `url()` except approved assets, no `expression`, no `@import`). Unknown keys are **stripped**, unknown types **rejected**. |
| `geometry.ts` | mm ↔ px at the canvas zoom, snapping (1 mm grid, sheet edges, other frames), clamping a frame inside its sheet. |
| `compose.ts` | `composeCanvas({ pages, designs, brand }) → project`. One template function per `DesignId`, each placing frames and filling slots from `parsePages()` sections (title, paragraphs, groups, stats, images). Deterministic, so the same input gives the same JSON (tested by hash). |
| `derive.ts` | `deriveDocument(project) → TipTap doc`. Sheets in order, frames by `data-order` then top-left. Text-frame docs are concatenated, a figure frame becomes a `83% — label` paragraph, images become image nodes, a `horizontalRule` goes between sheets. Output passes `ContentService.normalize`. |
| `fit.ts` | Overflow rules shared by the live badge and the export gate. |

## Backend

### Commands (AdonisJS `node ace`, not NestJS)

```bash
# git worktree first (docs/working-rules.md)
git worktree add -b feature/canvas-editor ../canvas-editor && cd ../canvas-editor

bun add grapesjs@0.23.9 --exact

node ace make:migration create_document_canvases_table
node ace make:migration create_document_canvas_drafts_table
node ace make:migration create_canvas_templates_table
node ace make:migration alter_document_layouts_add_editor_mode
node ace migration:run                      # also regenerates database/schema.ts

node ace make:model DocumentCanvas
node ace make:model DocumentCanvasDraft
node ace make:model CanvasTemplate

node ace make:service canvas/canvas_service
node ace make:service canvas/canvas_draft_service
node ace make:service canvas/canvas_template_service
node ace make:service canvas/canvas_compose_service
node ace make:service exports/canvas_renderer

node ace make:controller DocumentCanvases
node ace make:controller CanvasTemplates
node ace make:validator canvas
node ace make:transformer canvas            # if the installed ace has it; else copy an existing transformer
node ace make:policy CanvasTemplate

node ace make:command canvas/seed_templates   # canvas:seed-templates
node ace make:command canvas/compose          # canvas:compose <documentId> [--dry-run]
node ace make:command canvas/audit            # canvas:audit — revalidate every stored project
node ace make:command canvas/render           # canvas:render <documentId> --out=tmp/x.pdf

node ace make:test canvas_schema --suite=unit
node ace make:test canvas_compose --suite=unit
node ace make:test canvas_derive --suite=unit
node ace make:test canvas_renderer --suite=unit
node ace make:test canvas_bundle --suite=unit
node ace make:test document_canvases --suite=functional
node ace make:test canvas_templates --suite=functional
node ace make:test canvas_export --suite=functional
node ace make:test canvas_editor --suite=browser
```

### Models

- `DocumentCanvas` extends `DocumentCanvasSchema`. `declare project: CanvasProject`, `belongsTo`
  version and document.
- `DocumentCanvasDraft` extends its schema. `selfAssignPrimaryKey = true` (key = document id, like
  `DocumentLayout`).
- `CanvasTemplate` extends its schema, with a `scope` query helper (system + workspace).
- `DocumentLayout` gets `declare editorMode: 'flow' | 'canvas'`.

### Services (`app/services/canvas/`)

| Service | Responsibility |
| --- | --- |
| `CanvasService` | `load(ctx, docId)` → draft if newer than the current version, else the version's canvas. `saveVersion(ctx, docId, { project, baseVersionId, mutationId })`: validate → derive → `VersionService.save({ content: derived, … })` inside the same transaction → insert `document_canvases` → delete the draft. The idempotent `mutationId` and 409 on a stale base are reused from `VersionService`. `enable(ctx, docId, { templateId? })`: compose from the current brochure, set `editor_mode='canvas'`, save version 1 of the canvas (`source='composed'`). `disable(ctx, docId)`: set `editor_mode='flow'`. Canvas rows stay with their versions for history. |
| `CanvasDraftService` | `put(ctx, docId, { project, revision, baseVersionId })`: validate, CAS on `revision` (409 with the current revision), cap the size at 2 MB. |
| `CanvasTemplateService` | List system + workspace templates. Create from a sheet or a whole canvas, rename, duplicate, delete (workspace only). Bump `version` on edit. |
| `CanvasComposeService` | Server wrapper around `shared/canvas/compose.ts`. Resolves designs (`resolveDesigns`), brand (`getBrandKit`) and images. Used by `enable` and `canvas:compose`. |
| `exports/canvas_renderer.ts` | `renderCanvasHtml(project, { brand, sources, images }) → string`. Walks validated JSON only. Escapes every string. Text frames go through the existing `renderBlocks` (`client_blocks.ts`), so citations become footnote markers as in `brochure_renderer.ts`. Brand fonts come from `fontFaces`. Ends with the same sources sheet. `CANVAS_RENDERER_VERSION = 'canvas-1'`. |

`DocumentExportService` branch: if the layout's `editor_mode === 'canvas'` and the version has a
canvas, render with `renderCanvasHtml` for PDF and run the overflow gate. `web` keeps
`renderWebHtml`.

### Routes (`start/routes.ts`, inside the existing authenticated workspace group)

| Method | Path | Handler | Notes |
| --- | --- | --- | --- |
| GET | `/documents/:documentId/canvas` | `DocumentCanvases.show` | Inertia page `documents/canvas`. 404 when the flag is off. |
| GET | `/documents/:documentId/canvas/project` | `DocumentCanvases.project` | `{ project, source: 'draft'|'version', revision, baseVersionId }` |
| PUT | `/documents/:documentId/canvas/draft` | `DocumentCanvases.draft` | Autosave, CAS `revision`. |
| POST | `/documents/:documentId/canvas/versions` | `DocumentCanvases.save` | `{ project, baseVersionId, mutationId }` |
| POST | `/documents/:documentId/canvas/enable` | `DocumentCanvases.enable` | `{ templateId? }` |
| POST | `/documents/:documentId/canvas/disable` | `DocumentCanvases.disable` | Confirmed in the UI. |
| GET | `/documents/:documentId/preview/canvas` | `ExportPdfs.canvasPreview` | HTML preview for the iframe check. |
| GET | `/canvas-templates` | `CanvasTemplates.index` | `?kind=sheet|document` |
| POST | `/canvas-templates` | `CanvasTemplates.store` | |
| PATCH | `/canvas-templates/:templateId` | `CanvasTemplates.update` | |
| POST | `/canvas-templates/:templateId/duplicate` | `CanvasTemplates.duplicate` | |
| DELETE | `/canvas-templates/:templateId` | `CanvasTemplates.destroy` | System templates → 403. |

Authorization: document routes reuse `DocumentPolicy.update` / `view` through `AccessService`, as
`DocumentLayouts` does. `CanvasTemplatePolicy` lets workspace members read and editors write, and
nobody writes system templates.

Validators (VineJS, `app/validators/canvas.ts`): envelope only (`baseVersionId` uuid, `mutationId`,
`revision` int, `project` object). The deep check is the zod allowlist in `shared/canvas/schema.ts`,
so browser and server share it.

Transformer: `CanvasTransformer` returns `{ project, revision, baseVersionId, source, sheetCount,
updatedAt }` and `CanvasTemplateTransformer` returns `{ id, name, kind, designId, version,
thumbnailUrl, system }`.

## Frontend

All GrapesJS code lives in `inertia/components/canvas/grapes/`. Nothing else imports `grapesjs`.
The page is lazy-loaded.

### Editor configuration (`grapes/config.ts`)

```ts
grapesjs.init({
  container, height: '100%', fromElement: false,
  storageManager: { type: 'app', autosave: true, stepsBeforeSave: 5, autoload: false },
  projectData,                                  // from /canvas/project
  dragMode: 'absolute',
  avoidInlineStyle: true,
  selectorManager: { componentFirst: true },
  deviceManager: { devices: [{ id: 'a4', name: 'A4', width: '' }] }, // sheets carry their own size
  canvas: { styles: [brandFontsCssUrl, '/assets/canvas.css'] },       // sheet + tiptap styles
  protectedCss: '',                             // we ship our own reset in canvas.css
  parser: { optionsHtml: { allowScripts: false, allowUnsafeAttr: false, allowUnsafeAttrValue: false } },
  blockManager: { custom: true }, styleManager: { custom: true },
  layerManager: { custom: true }, traitManager: { custom: true },
  panels: { defaults: [] },                     // no default GrapesJS chrome
  plugins: [frameTypes, tiptapRte, appStorage, brandGuard, geometrySync, overflowWatch],
})
```

### GrapesJS plugins (`grapes/plugins/`)

| Plugin | What it does |
| --- | --- |
| `frame_types.ts` | `addType` for each catalog type. `sheet`: not draggable, droppable only for frames, removable only through the page strip, `stylable: ['background-color']`. Frames: `resizable: true`, `stylable` from the catalog, `dmode: 'absolute'`. `figure-frame` and `image-frame` get traits (value, label, qualifier; alt). Views render Tiptap JSON with `generateHTML` (`@tiptap/html`, already a dependency). |
| `tiptap_rte.ts` | `setCustomRte({ parseContent: false, enable, disable, getContent })`. `enable` mounts a Tiptap `Editor` in the frame element, using `documentExtensions()` with the citation and image node views. `disable` writes `editor.getJSON()` to the component's `doc` prop and destroys the editor. Toolbar events are bridged to the React toolbar. |
| `app_storage.ts` | `Storage.add('app', { load, store })`. `store` → `PUT …/canvas/draft` with the current `revision`. On 409, raise a conflict event and the UI offers reload or keep-mine. |
| `brand_guard.ts` | Colour inputs offer only the brand palette. Font family is limited to `brand.fonts`. Blocks images that aren't registered. |
| `geometry_sync.ts` | On drag/resize end: px → tenths of a mm, snap, clamp inside the sheet, write `data-geo` and the `#id` rule in mm. |
| `overflow_watch.ts` | After text edits and resizes, compare `scrollHeight` with `clientHeight` per text frame. Emits `canvas:overflow` with frame ids. |

### React components (`inertia/components/canvas/`)

| Component | Purpose |
| --- | --- |
| `pages/documents/canvas.tsx` | Inertia page: header (title, save status, Save version, Export), three-column layout, conflict dialog. |
| `use_grapes_editor.ts` | Hook: init on mount, destroy on unmount, expose `editor`, re-render on selected events. Replaces `@grapesjs/react`. |
| `canvas_shell.tsx` | Layout: left panel (blocks / layers / templates tabs), centre iframe, right inspector. |
| `canvas_toolbar.tsx` | Undo/redo (`UndoManager`), zoom, snapping toggle, align/distribute, bring forward/back, group/ungroup, delete. Text controls (bold, italic, link, lists, heading level, citation) appear while Tiptap is active. |
| `page_strip.tsx` | Thumbnails of every sheet: add (blank or from a sheet template), duplicate, reorder (drag), delete, with the page budget shown. |
| `blocks_panel.tsx` | Driven by `block:custom`: text, heading, figure, image (from document images), shape, divider, card group. |
| `layers_panel.tsx` | Driven by `layer:custom`: tree per sheet, rename, hide, lock, reorder. |
| `inspector_panel.tsx` | Driven by `style:custom`, limited to the catalog: position/size in mm, brand colour swatches, padding, radius, opacity, font size/weight from the brand scale. A traits section for figure/image fields. |
| `template_gallery.tsx` | System + workspace templates. Apply to the current sheet or the whole document. "Save sheet as template". |
| `overflow_badge.tsx` | Red marker on overflowing frames plus a list in the header that blocks export. |
| `save_status.tsx` | Saved / saving / unsaved (dirty count) / conflict. |
| `editor_mode_switch.tsx` | On the existing document editor: "Open in canvas" (enable + compose) and "Back to text editor" (with a confirmation from `confirm_action.tsx`). |
| `inertia/css/canvas.css` | Sheet (210 × 297 mm, white, shadow in the editor only), frame outlines, Tiptap styles inside the iframe. |

## Test suite

Japa, using the existing suites in `adonisrc.ts`. Fixtures go in `tests/fixtures/canvas/`:
`minimal.json`, `all_designs.json` (one sheet per design), `malicious.json`, `overflow.json`, and the
existing `tests/fixtures/brochure` entries as composer input.

### Unit (`tests/unit/`)

| File | Covers |
| --- | --- |
| `canvas_schema.spec.ts` | Accepts `minimal` and `all_designs`. **Rejects** `script` type, `on*` attributes, `javascript:`/`data:` URLs, `url()` in styles, `@import`, unknown types, frames outside the catalog's children rules, image ids not in the document, projects over 2 MB or 40 sheets. Strips unknown keys. Text-frame `doc` must pass `documentSchema()`. |
| `canvas_compose.spec.ts` | Each `DesignId` makes a valid project. Same input → same `hashOf`. Every source paragraph lands in exactly one frame (nothing lost). Brand colours applied. Stats become figure frames. |
| `canvas_derive.spec.ts` | Reading order (sheet, `data-order`, then top-left). One `horizontalRule` per sheet break. Citations and images survive. `deriveDocument(composeCanvas(x))` keeps the text of `x` (round-trip on the brochure fixtures). |
| `canvas_geometry.spec.ts` | mm↔px at different zooms, snapping, clamping inside the sheet. |
| `canvas_renderer.spec.ts` | Escapes text and attributes. Frames positioned in mm. One `.sheet` per page, plus the sources sheet. Citations become numbered refs. **Parity:** for the fixtures, frame boxes match GrapesJS `headless` `getHtml/getCss` output. Malicious fixture rejected before rendering. |
| `canvas_bundle.spec.ts` | `canvasHash` changes the bundle hash, and a bundle without it hashes as before (old approvals stay valid). |

### Functional (`tests/functional/`)

| File | Covers |
| --- | --- |
| `document_canvases.spec.ts` | Flag off → 404. `enable` composes and sets `editor_mode`. `project` returns the version, then the draft after a PUT. Draft CAS conflict → 409 with the current revision. `save` creates a version + canvas row in one transaction, derives content, deletes the draft, invalidates the review. Same `mutationId` → same version; same id with different content → 409. Stale `baseVersionId` → 409. Malicious project → 422 and nothing stored. Other workspace → 404 (isolation). Viewer role → 403. `disable` keeps history. |
| `canvas_templates.spec.ts` | System templates listed for everyone and read-only. Workspace CRUD and duplicate. Unique name per workspace regardless of case. Another workspace can't see them. `canvas:seed-templates` is idempotent. |
| `canvas_export.spec.ts` | Canvas PDF export runs, and the page count equals the sheet count + sources sheet (via `pdf_inspector`). An overflowing frame blocks export with a clear error. The web export still uses the derived text. The approval bundle includes `canvasHash`, and a canvas change after approval blocks export. |

### Browser (`tests/browser/canvas_editor.spec.ts`, Playwright via `@japa/browser-client`)

1. Open a branded brochure → "Open in canvas" → one sheet per page, matching the designs.
2. Drag a frame 20 mm right → reload → its position is kept (draft autosave).
3. Double-click a text frame → Tiptap active → type, bold, add a link → click out → text kept;
   a citation chip is still present.
4. Resize a frame until the text overflows → overflow badge shows, and Export is disabled.
5. Undo/redo restores the position.
6. Add a sheet from a template, reorder in the page strip, save version → version history shows it.
7. Second tab edits → first tab's autosave gets the conflict dialog.
8. Export PDF → download succeeds. A screenshot diff of sheet 1 against the editor sheet stays
   under a 2% pixel threshold (catches px/mm drift).

### Commands

```bash
node ace test unit --files="tests/unit/canvas_*"
node ace test functional --files="tests/functional/{document_canvases,canvas_templates,canvas_export}.spec.ts"
node ace test browser --files="tests/browser/canvas_editor.spec.ts"
bun run typecheck && bun run lint
```

## Phases

| # | Phase | Output | Exit check |
| --- | --- | --- | --- |
| 0 | **Spike** (1–2 days, throwaway branch) | GrapesJS in an Inertia page: two sheets, absolute drag inside a sheet, Tiptap as the custom RTE, export through `renderCanvasHtml` → Playwright PDF. | Frames stay inside their sheet. mm geometry round-trips. Tiptap editing works in the iframe. PDF matches by eye. **If any of these fail, stop and reconsider the react-moveable fallback from the research.** |
| 1 | Shared module | `catalog`, `schema`, `geometry`, `derive` + unit tests. | Unit tests green. |
| 2 | Database + backend | Migrations, models, services, routes, validators, policies, flag. | Functional tests green. |
| 3 | Composer + templates | `compose.ts` for all nine designs, `canvas:seed-templates`, `canvas:compose`. | Every brochure fixture composes, validates and round-trips its text. |
| 4 | Editor UI | Hook, plugins, panels, page strip, save/conflict flow. | Browser tests 1–3 and 5–7. |
| 5 | Export + approvals | `canvas_renderer`, export branch, overflow gate, `canvasHash` in the bundle. | `canvas_export` + browser test 8. |
| 6 | Pilot | `CANVAS_EDITOR=pilot` on staging, `canvas:audit` in CI, decision register entry (D-CANVAS). | Checked by eye on 3 real brochures. |

## Out of scope (for now)

- Text flowing between linked frames. Overflow is flagged, not reflowed.
- Model-arranged canvas layouts beyond picking templates.
- Responsive web output from the canvas layout.
- Collections/portfolio pages in the canvas. Entries keep their own look (portfolio plan decision 5).
- Real-time multi-user editing. The draft CAS handles conflicts.

## Progress (21 Nov 2026, branch `feature/canvas-editor`)

| Phase | State |
| --- | --- |
| 0 Spike | Folded into the build: the exit checks are covered by tests (frames stay in their sheet, mm round-trips through a real GrapesJS, Tiptap edits in the iframe, preview renders the canvas). |
| 1 Shared module | Done: `model`, `geometry`, `css`, `compose`, `derive`, `grapes`, `grapes_types`, `ops`. |
| 2 Database + backend | Done: 4 migrations, models, `CanvasService`, routes, validator, policy checks, flag. |
| 3 Composer + templates | Composer done for all nine designs. **Templates not started:** `canvas_templates` table exists; service, routes, `canvas:seed-templates` and the gallery remain. |
| 4 Editor UI | Done: toolbar, page strip, inspector, text toolbar, autosave/conflict, save version, entry from the document page. |
| 5 Export + approvals | Preview/PDF draw the canvas, bundle covers it. **Remaining:** the overflow gate on final export (overflow is flagged in the editor only), `canvas:audit`/`canvas:render` commands. |
| 6 Pilot | Not started. |

Changes made during the build, beyond the stored-format change noted under Decisions:

- **The live editor gives GrapesJS px, not mm.** Its absolute dragger reads `left`/`top` as plain
  numbers, so `72mm` came back as `72px`. Stored data and exports stay in mm (`frameCss(frame, 'px')`
  in the editor only).
- **Press-and-drag starts the move** (`tlb-move` on mousedown). GrapesJS only starts absolute drags
  from its toolbar handle. A second press on a text frame starts text editing, because the first
  press's drag swallows `dblclick`.
- **Text editing mounts Tiptap directly** instead of `setCustomRte`: that hook only runs on GrapesJS's
  `text` type, whose save path writes HTML back into the component.
- **Autosave is a debounced PUT** (1.5 s), not GrapesJS's storage manager, to keep the revision CAS
  and conflict handling in our code.
- **Zoom sizes the frame** to one sheet wide and to column height ÷ zoom, then aligns it by
  measurement. GrapesJS's zoom transition is turned off in `app.css` so the measurement is stable.

Tests: 53 canvas unit, 18 functional, 2 browser. Full suites pass (unit 510+, functional 219, browser 33).
