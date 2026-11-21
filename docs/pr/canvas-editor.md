# Canvas editor for brochures (GrapesJS), plus OAuth removal, Terraform and brand updates

## Summary

Brochure case studies can now be laid out freely on A4 pages. Boxes can be moved, resized
and styled, and the text stays connected to its citations, checks, approvals and exports.
The editor is built on GrapesJS 0.23.9 (BSD-3), but GrapesJS never touches stored data: we
save our own small canvas format, and the editor converts to and from it.

The canvas is behind a flag: set `CANVAS_EDITOR=pilot` in `.env`. With the flag off, the
app behaves as before.

## What users see

- **Create page:** layout options are now *Use a template*, *Choose each page*, *Let AI
  choose* and **Plain text document**. The legacy "Classic case study" mode and its four
  company templates are removed. *Plain text document* is the former Freeform.
- **Case study page:** a **Text | Canvas** switch in the header. The first switch to
  Canvas lays each page out from its design. A new case study with no text yet opens on a
  cover with its title, plus one blank page.
- **Canvas editor:**
  - **Pages:** A4 sheets with a page list to add, duplicate, reorder and delete pages.
    Zoom and fit to width.
  - **Adding boxes:** click *Text box*, *Number*, *Image*, *Shape* or *Artwork*, then click
    a page to drop the box or drag to draw it.
  - **Editing text:** double-click or press Enter to edit in place, with headings, bold,
    italic, underline and lists. A new text box opens ready to type.
  - **Moving boxes:** press and drag. A press only becomes a drag after 4 px, so clicks no
    longer nudge boxes. Arrow keys nudge by 1 mm (10 mm with Shift). Live alignment guides
    while dragging.
  - **Styles:** brand colours plus any colour (picker, hex, recent colours) for text, fill,
    border and page background; fill strength. Font, exact size, weight, line height,
    letter spacing, italic, capitals and alignment. Borders, shadow, corners, padding and
    opacity.
  - **Arranging:** lock, duplicate, front/back, delete, undo/redo.
  - **Saving:** changes autosave as a draft. *Save version* creates a document version.
  - **Preview:** the PDF preview draws the canvas exactly as edited.

## How it works

- **Stored format** (`shared/canvas/model.ts`): sheets of positioned boxes. Geometry is in
  tenths of a mm, and colours are brand names or hex. Every value is checked server-side
  with zod: enums and bounded numbers only, with a size limit.
- **Text stays one source of truth:** saving a canvas also writes the text of all its
  boxes as the version's normal content. Citations, checks, review, approval and the web
  export work unchanged.
- **Approvals cover the canvas:** the approval bundle includes the canvas hash. Moving a
  box after approval needs a new approval.
- **Autosave:** a draft table guarded by a revision counter. Two tabs cannot overwrite each
  other (HTTP 409).
- **Export:** `canvas_renderer.ts` renders the sheets to HTML for Chromium, using the same
  CSS (`shared/canvas/css.ts`) as the editor.
- **GrapesJS is confined to `inertia/components/canvas/grapes/`**, so an upgrade stays
  local. It is loaded lazily, only on the canvas page.

## Security

GrapesJS does not sanitise project JSON on load, so all stored data goes through our own
schema. Tests confirm that scripts, event handlers, `javascript:` links, CSS injection
through style values, other documents' images and out-of-page boxes are rejected. Text
inside boxes is checked against the shared document schema.

## Database (4 migrations)

| Table / column | Purpose |
|---|---|
| `document_canvases` | Canvas per document version (unique `version_id`, hash, sheet count, source) |
| `document_canvas_drafts` | Autosave draft per document, with base version and revision |
| `canvas_templates` | Reserved for saved page templates (not used yet) |
| `document_layouts.editor_mode` | `flow` (text) or `canvas` |

## Other changes in this branch

- **Google OAuth removed:** `@adonisjs/ally`, `config/ally.ts`, `GOOGLE_CLIENT_*` env vars
  and CI placeholders. ⚠️ `GOOGLE_CLIENT_ID`/`SECRET` are no longer required in any env.
- **Terraform:**
  - Local state.
  - The deploy workflow no longer runs `terraform apply`; it links Railway and Vercel
    through repository variables.
  - Adds `terraform/vercel/.env.example` listing every input as `TF_VAR_*`.
  - ⚠️ Requires repository variables `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID` and
    `RAILWAY_SERVICE_ID`, plus the Vercel IDs, before the next deploy.
- **Brand:** HumbleBee palette from humblebee.ai (near-black `#111`, amber `#ffb902`, cream
  `#f2f0e9`), applied across the brand kit, exports and previews.

## Testing

- **Unit:** canvas model and security, geometry, composer and text derivation, GrapesJS
  round trip (headless), styles, bundle, ops.
- **Functional:** enable, autosave conflicts, save, versioning, stale saves, workspace
  isolation, preview, new case studies, layout rebuilt after a text-only version.
- **Browser (Playwright):**
  - A brochure from the case study page: switch to Canvas, select, move, check that a click
    does not move the box, drag, edit text, draw a new text box and type, custom fill and
    border, add a page, save a version.
  - A new case study: switch to Canvas, then back to Text.
  - The flag: the switch is hidden when the canvas is off.
- Last full run: **774 passed, 23 skipped** (unit, functional and browser). Typecheck and
  lint are clean.

To try it: set `CANVAS_EDITOR=pilot`, run the migrations (`node ace migration:run`), open a
brochure case study and click **Canvas**.

## Not in this PR

- **Canvas-only brochures:** brochures should open only in the canvas, and plain documents
  only in the text editor. The create page already offers the split, but the Text/Canvas
  switch still shows for brochures.
- **Final export gate:** text that overflows its box is flagged in the editor, but doesn't
  block final export yet.
- **Templates:** a page template gallery, plus the `canvas:audit` and `canvas:render`
  commands.
- **Text colour:** colour for individual words, not just whole boxes.

Research and plan: `docs/canvas-editor-research.md` and
`docs/canvas-editor-implementation-plan.md` (decisions and progress log).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
