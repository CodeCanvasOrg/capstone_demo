# Canvas editor (GrapesJS): research

Status: research, 21 Nov 2026. Feeds `canvas-editor-implementation-plan.md`.

## The problem

Brochure pages can only be edited as text. The stored document is a Tiptap flow, and the layout is
guessed from it:

- a level-3 heading becomes a card or column (`inertia/components/extensions/brochure_page.ts`)
- a paragraph that starts like `83% — …` becomes a big figure
- a horizontal rule is a page break (`shared/brochure/paged.ts`)
- the page design (one of nine in `shared/brochure/designs.ts`) is stored outside the document and
  only restyles the page

A user cannot move, resize, layer or add a box. The renderer is not the limit: exports are HTML and
CSS printed by Chromium (`app/services/exports/brochure_renderer.ts`, `pdf_service.ts`), which can
draw anything. What's missing is a **document model with positioned boxes** and an editor for it.

## Options considered

| Option | Verdict | Reason |
| --- | --- | --- |
| Polotno SDK | Rejected | Commercial, quote-based. Canvas-drawn, so it breaks the HTML web export, citations and text flow. Vector PDF needs an extra package. |
| IMG.LY CE.SDK | Rejected | Enterprise pricing, can be metered per export. Same canvas problems. |
| Konva / Fabric.js | Rejected | Raw canvas libraries: no pages, no rich text, raster PDF (Konva). |
| paged-media/editor | Rejected | AGPL network clause. |
| CMS editors (jsHarmony, Decap, Pages CMS) | Rejected | Edit fields and rich text inside fixed templates. Same limit as today. |
| Puck, Craft.js | Rejected | Blocks stack top to bottom; no free positioning or pages. |
| **GrapesJS core** | **Chosen** | Free (BSD-3-Clause). Outputs HTML/CSS, so the Chromium PDF pipeline stays. Has absolute positioning, pages, undo, layers, custom component types and a pluggable rich-text editor. |

The GrapesJS **Studio SDK** (paid, with a ready-made A4 "Document" mode) is not needed. Core has
everything this plan uses.

## How GrapesJS works

Verified against the docs on grapesjs.com and against the published `grapesjs@0.23.9` types
(`dist/index.d.ts`). Probe scripts were run on Node 24.

### Core model

- **Editor** – `grapesjs.init(config)` returns an editor. It renders the page in an **iframe
  canvas**, so canvas CSS never leaks into the app and app CSS never leaks into the page.
- **Components** – a tree of models (`tagName`, `attributes`, `classes`, `components`, `content`,
  `style`). Each has a **type** (`text`, `image`, `textnode`, `wrapper`, `script`, …). New types are
  registered with `editor.Components.addType(id, { isComponent, model: { defaults }, view })`, and
  can extend a built-in type with `extend`.
- **Per-type rules** (model defaults): `draggable`, `droppable`, `removable`, `copyable`,
  `resizable`, `editable`, `selectable`, `hoverable`, `layerable`, `locked`, `stylable` (array of
  allowed CSS props) and `unstylable`. This is how brand rules are enforced in the editor.
- **Styles** – stored as CSS rules keyed by selector. With `selectorManager.componentFirst: true`,
  styles go to the selected component and not to shared classes. `avoidInlineStyle` puts component
  styles in `#id` rules instead of `style=""` (confirmed in the types).
- **Pages** – `editor.Pages.add/select/getAll/remove`. Each page has its own component tree
  (`page.getMainComponent()`) and can be exported on its own with
  `editor.getHtml({ component })` / `editor.getCss({ component })`.
- **Drag mode** – `dragMode: 'absolute' | 'translate'` globally, or `component.setDragMode()` /
  the `dmode` property per component (confirmed in the types). In `absolute` mode, dragging writes
  `position:absolute; top; left`, as in a design tool. With no drag mode, components follow HTML
  flow.
- **Devices** – `deviceManager.devices: [{ id, name, width, height, widthMedia }]` sets the iframe
  size.
- **Canvas** – `canvas.styles` / `canvas.scripts` inject external CSS/JS into the iframe only, not
  into the export. `protectedCss` and `canvasCss` are config strings (confirmed in the types).
- **Undo** – `editor.UndoManager` (`undo`, `redo`, `hasUndo`, `hasRedo`, `skip(fn)`, `clear`).
  Component and CSS-rule changes are tracked automatically.
- **Events** – `update`, `undo`, `redo`, `load`, `project:load`, `project:get` (adds custom keys
  to project data), `component:add|update|remove`, `component:update:{prop}`,
  `canvas:frame:load`, `page`. `editor.sub(event, cb)` returns an unsubscribe function.

### Project data and storage

- `editor.getProjectData()` returns JSON. The probe confirmed the keys: `assets`, `styles`, `pages`,
  `symbols`, `dataSources`. **This JSON is the source of truth.** The docs advise against storing
  HTML/CSS.
- `editor.loadProjectData(json)` or the `projectData` init key loads it.
- The storage manager (`storageManager: { type, autosave, autoload, stepsBeforeSave }`) supports
  `local`, `remote` (GET to load, POST to store) or a custom adapter:
  `editor.Storage.add('name', { load, store })`. We will write a custom adapter so saves go through
  our CSRF-protected Inertia/axios client with compare-and-set revisions.
- `editor.getDirtyCount()` / `clearDirtyCount()` drive the unsaved-changes indicator.

### Custom UI

- Every built-in panel can be swapped for our own UI:
  - `blockManager: { custom: true }` + `editor.on('block:custom', ({ blocks, dragStart, dragStop }) => …)`
  - `styleManager: { custom: true }` + `style:custom`
  - layers and traits work the same way
- Blocks are draggable palette items whose `content` is component JSON. Per the docs, blocks must not
  hold functions or styles; those belong to the component type.
- `@grapesjs/react@2.0.0` (MIT) wraps the editor (`GjsEditor`, `Canvas`, `WithEditor`,
  `useEditor`). **Its peer dependency is `grapesjs ^0.22.5`, which (being 0.x) excludes the
  current 0.23.9.** Decision: skip the wrapper and mount the editor with our own ~80-line
  `useGrapesEditor` hook. That avoids pinning an old core, and the custom-UI events above are all
  the wrapper uses anyway.

### Rich text

`editor.setCustomRte({ enable, disable, getContent?, parseContent?, destroy? })` replaces the
built-in editor (interface confirmed in the types: `enable(el, rte, opts)`, `disable(el, rte, opts)`,
`getContent(el, rte, opts) → string`).

With `parseContent: false`, GrapesJS keeps the returned HTML as-is and doesn't parse it into child
components. That's what we want. A text frame will keep its **Tiptap JSON** in a component property
and mount Tiptap inside the iframe while it's being edited, so citations (`sourceCitation`), links,
lists and footnotes keep working with the existing schema (`shared/editor/schema.ts`).

### Headless / server side

`headless: true` is a real config option. Probe results on Node 24:

- Loading **component JSON** works. `getHtml` and `getCss` return correct markup, and mm units are
  kept (`#f1{position:absolute;left:20mm;top:30mm;width:80mm;}`).
- Loading **HTML strings** fails (`DOMParser is not defined`). The server must only ever handle
  JSON, never HTML.

### Security finding (important)

The HTML parser has safe defaults (`allowScripts=false`, `allowUnsafeAttr=false`,
`allowUnsafeAttrValue=false`). **None of them apply to JSON.** The probe loaded a project
containing `onerror="alert(1)"`, `src="javascript:alert(1)"` and a `script` component, and
`getHtml()` returned all three unchanged.

Consequence: every project JSON the server accepts (save, draft, template) must pass a strict
**allowlist validator**: known component types, tags, attributes, URL schemes and CSS properties.
The export renderer must be our own walker over validated JSON, not `getHtml()`. The client is
never trusted.

### Licence and versions

| Package | Version | Licence |
| --- | --- | --- |
| `grapesjs` | 0.23.9 | BSD-3-Clause |
| `@grapesjs/react` | 2.0.0 (not used: peer range excludes 0.23) | MIT |

## How it fits this project

### What stays

- Tiptap and its schema, but only inside text frames.
- Generation: the model still writes page content and picks a design from the closed catalog. It
  never writes canvas JSON.
- Chromium PDF export, page budget checks, overflow checks, approvals and the bundle hash.
- Evidence hydration, publication `accept`, content checks and footnotes. These keep running on a
  Tiptap document **derived** from the canvas (see below).

### What's new

1. **A canvas document per version.** A GrapesJS project limited to our own component types: `sheet`
   (one A4 page), `text-frame`, `image-frame`, `figure-frame` (big number + label), `shape`,
   `group`. Stored next to the version it belongs to, so it's covered by the version and approval
   rules.
2. **A composer** (pure, shared) that turns today's brochure (pages + designs + brand) into a canvas
   project. Each of the nine designs becomes a page template of positioned frames. This is how
   existing documents open in the canvas, and how AI output gets a layout.
3. **A derived text document.** On save, the server reads text frames in reading order (sheet, then
   frame `order`) and builds a flat Tiptap document, with a horizontal rule between sheets, in the
   existing stored format. That becomes `document_versions.content`, so everything downstream works
   unchanged.
4. **A canvas renderer** for export: validated JSON → HTML (`@page { size: A4; margin: 0 }`, one
   `.sheet` per page, frames absolutely positioned in mm, Tiptap JSON rendered by the existing
   `renderBlocks`). Chromium prints it as now.
5. **An editor page** built in React/shadcn around the GrapesJS iframe, with our own panels.

### Single-page vs multi-page in GrapesJS

Two ways to show A4 pages:

- **One GrapesJS page holding N `sheet` components stacked vertically** (recommended). The user
  scrolls through every page as now, and a page strip shows them all. `sheet` is `position:relative`
  at 210 × 297 mm, so absolutely positioned frames are placed relative to their sheet.
- **One GrapesJS page per sheet.** Only one sheet is visible at a time. Fall back to this only if
  performance with many sheets is poor.

The spike (phase 0 of the plan) has to confirm that absolute drag keeps frames inside their parent
sheet and writes mm or converts px→mm cleanly.

### Web export

An absolutely positioned A4 layout doesn't work as a responsive web page. The web export keeps
using `web_renderer.ts` on the derived text document, which is already in reading order. The PDF
uses the canvas layout. This trade-off is accepted and recorded in the plan.

## Risks

| Risk | Mitigation |
| --- | --- |
| Text overflows a fixed-height frame | Measure in the iframe (`scrollHeight > clientHeight`) for a live badge. Reuse the Playwright overflow check (`tests/unit/brochure_overflow.spec.ts` pattern) as an export gate. |
| Untrusted JSON (XSS) | Strict server allowlist plus our own renderer. Never call `getHtml` on the server for export. |
| px vs mm drift between editor and PDF | Store geometry in mm. Convert on the `component:update` / drag-end events. Run a parity test that compares frame boxes in the editor iframe with the PDF render. |
| Tiptap inside the iframe (focus, CSS, multiple editors) | One Tiptap instance at a time, mounted on `enable` and destroyed on `disable`. Inject Tiptap CSS with `canvas.styles`. |
| GrapesJS 0.x API churn | Pin the exact version. Keep all GrapesJS calls behind `inertia/components/canvas/grapes/` so an upgrade touches one folder. |
| Bundle size on the editor page | Lazy-load the canvas page with a dynamic `import()`, so other pages don't pay for it. |

## Sources

- GrapesJS docs: [Getting started](https://grapesjs.com/docs/getting-started.html), [Components](https://grapesjs.com/docs/modules/Components.html), [Storage](https://grapesjs.com/docs/modules/Storage.html), [Replace the RTE](https://grapesjs.com/docs/guides/Replace-Rich-Text-Editor.html), [Editor API](https://grapesjs.com/docs/api/editor.html), [Blocks](https://grapesjs.com/docs/modules/Blocks.html), [Style manager](https://grapesjs.com/docs/modules/Style-manager.html), [Pages](https://grapesjs.com/docs/modules/Pages.html), [Undo manager](https://grapesjs.com/docs/api/undo_manager.html), [Symbols](https://grapesjs.com/docs/guides/Symbols.html)
- Repos: [GrapesJS/grapesjs](https://github.com/GrapesJS/grapesjs), [GrapesJS/react](https://github.com/GrapesJS/react)
- Absolute drag mode background: [grapesjs#1936](https://github.com/GrapesJS/grapesjs/issues/1936)
- `npm view grapesjs` / `npm view @grapesjs/react` (versions, licences, peer ranges), 21 Nov 2026
