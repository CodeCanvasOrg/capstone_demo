# Canvas academic pipeline: implementation plan

> Superseded for generation by `docs/portfolio-template-plan.md`: the canvas now has one portfolio template.
> This document still describes the shared stages (plan, per-page retrieval, write, fit, images, compose).

Status: proposed, 23 Nov 2026. Branch: `feature/canvas-academic-pipeline` (plain branch from `dev`,
no worktree). Builds on `canvas-editor-implementation-plan.md` and `canvas-images-and-delete-sync.md`.

## Goal

When a document is generated for the canvas editor, **every page carries well-structured, detailed,
academic and informative text** that fills its layout, is grounded in cited evidence, and sits beside
images that are well chosen, well cropped and print-sharp. New canvas templates are designed for this
long-form content instead of reusing the marketing-brochure designs.

## Why the canvas pages are thin today (root causes)

| # | Cause | Where |
|---|---|---|
| 1 | Canvas content is the **brochure** output: hard character caps per field (cover subtitle 120 chars, article paragraphs 260, offer cards 330, glance bullets 34). The model is told to stay inside them and `fitPage` cuts anything over. | `shared/brochure/content.ts` `CAPS`, `brochure_prompt.ts`, `fitPage` |
| 2 | **One model call writes every page.** Depth per page drops as page count rises; the model spreads its output budget across 3–9 pages. | `OpenRouterService.generateBrochure` |
| 3 | **Retrieval is shared and small**: `perSection = 8`, `maxText ≤ 40`, `tokenBudget = 10 000` for the whole document, so each page sees roughly 1 000–3 000 tokens of evidence. | `RetrievalService.searchSections` |
| 4 | The **prompt is marketing-oriented** ("Ready to take the lead?", proof points, offers), not explanatory or academic. | `BROCHURE_PROTOCOL`, `READS` |
| 5 | **Layout and text are decoupled**: `composeCanvas` drops text into fixed boxes after the fact. Nothing measures whether a box is 20% or 140% full, and there's no feedback loop to expand or condense. | `shared/canvas/compose.ts` |
| 6 | **Images are not part of generation.** Image chunks only reach the model as evidence; no image frame is placed, captioned or sized. Embedded images use the original bytes, which makes PDFs heavy and crops arbitrary. | `compose.ts`, `canvas_renderer.ts` |

## Decisions

1. **A separate pipeline for the canvas**, `canvas_report`, beside the brochure pipeline. The brochure
   path and flow documents stay unchanged. It is selected when the document is in canvas mode, or
   explicitly from the canvas "Generate pages" dialog.
2. **Multi-stage generation, one page at a time:** plan → per-page retrieval → per-page writing →
   fit check (expand/condense loop) → image placement → compose. Each stage is a pure function over
   explicit inputs, so it can be tested and re-run alone.
3. **Words, not characters.** Each academic design declares a word range per slot, computed from
   its frame geometry and type size by a shared estimator (`shared/canvas/fit.ts`). The prompt,
   the validator and the composer all read that one table, as `CAPS` does today.
4. **The model still never writes canvas JSON.** It writes structured page content; the composer lays it out.
5. **Reuse task kind `generate`** with `payload.target = 'canvas'`. This avoids a change to the
   `workspace_tasks` check constraint and keeps the existing lease, retry, `generationStatus` and
   claim review flow. Per-run details live in new tables.
6. **Saved as a normal version** through `CanvasService.saveCanvas` with `source = 'generated'`, so
   review, approval, history and export treat it like any other version.
7. **Models are configurable per stage**: `CANVAS_PLANNER_MODEL` (default: `OPENROUTER_MODEL`) and
   `CANVAS_WRITER_MODEL` (recommended: a Sonnet-class model for academic prose). Haiku stays the default for
   everything else.
8. **Behind the existing `CANVAS_EDITOR=pilot` flag**, plus `CANVAS_GENERATION=on` so it can roll out separately.

## Architecture

```
Canvas UI "Generate pages" ──POST /canvas/generate──▶ CanvasGenerationService.request
                                                      └─ WorkspaceTask(kind=generate, target=canvas)
Worker GenerateDocument job ─▶ GenerationService.execute ─(target=canvas)─▶ CanvasPipeline.run
  1 Plan        CanvasPlanner      brief + top evidence  ─▶ PagePlan[] (design, purpose, questions, words)
  2 Retrieve    RetrievalService.searchPages  one budget per page, queries from the plan's questions
  3 Write       CanvasPageWriter   page by page, concurrency 3   ─▶ PageContent (sections, citations)
  4 Fit         fit.ts estimator   fill < 70% → expand · > 100% → condense or split (max 1 retry/page)
  5 Images      CanvasImagePlanner choose, caption and crop images per page; pick the print variant
  6 Compose     shared/canvas/academic/compose.ts  ─▶ CanvasDocument
  7 Save        CanvasService.saveCanvas(source='generated') + run metrics + claim review
Export canvas_renderer ─▶ picks the image variant at 300 dpi for the frame size ─▶ PDF
```

### New and changed files

```
app/services/canvas/generation/
  canvas_generation_service.ts   request / status / regenerate one page (HTTP side)
  canvas_pipeline.ts             runs stages 1–7, records run and page rows, guard() between stages
  canvas_planner.ts              stage 1 (model call)
  canvas_page_writer.ts          stage 3–4 (model call + fit loop)
  canvas_image_planner.ts        stage 5 (deterministic scoring + one optional caption call)
  canvas_prompts.ts              all prompt text (see "Prompts")
  page_queries.ts                plan → SectionQuery[] per page
shared/canvas/
  fit.ts                         capacity estimator: frame geo + style → words/lines
  academic/designs.ts            ACADEMIC_DESIGN_IDS, metadata, slot word ranges, image slots
  academic/compose.ts            layouts for the academic designs (same SheetBuilder pattern)
  academic/content.ts            zod schemas for plan and page output, documentFromAcademicPages
  density.ts                     page metrics: words, fill ratio, citations, placeholders, dpi
app/services/documents/image_variant_service.ts   sharp derivatives, focal point, phash
app/controllers/canvas_generations_controller.ts
app/validators/canvas_generation.ts
commands/canvas_generate.ts, canvas_plan.ts, canvas_density.ts,
commands/canvas_templates_seed.ts, images_optimize.ts
inertia/components/canvas/generate_dialog.tsx, generation_progress.tsx, page_quality_badge.tsx,
inertia/components/canvas/template_gallery.tsx
```

Changed: `generation_service.ts` (dispatch on `target`), `retrieval_service.ts` (`searchPages`),
`canvas_service.ts` (`'generated'` source, run link), `canvas_renderer.ts` (variants, captions),
`page_strip.tsx`, `inspector.tsx`, `canvas.tsx`, `config/open_router.ts`, `start/env.ts`, `start/routes.ts`.

## Database schema

Four migrations, created with `node ace make:migration`. Postgres conventions follow the existing
canvas tables: uuid keys, workspace scoping, timestamptz, check constraints. Run `node ace migration:run`,
then regenerate `database/schema.ts` (`node ace schema:generate` or the project's equivalent).

### 1. `canvas_generation_runs` (new)

One row per canvas generation. Holds the plan and the quality metrics, so the UI and `canvas:density`
can report them without re-deriving.

| column | type | notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| workspace_id | uuid not null → workspaces CASCADE | |
| document_id | uuid not null → documents CASCADE | |
| task_id | uuid null → workspace_tasks SET NULL | |
| base_version_id | uuid null → document_versions SET NULL | |
| result_version_id | uuid null → document_versions SET NULL | set on success |
| profile | varchar(16) not null | check `IN ('academic','informative')` |
| depth | varchar(16) not null | check `IN ('concise','standard','detailed')` |
| template_set | varchar(32) not null | `academic_report`, `research_brief`, `brochure` |
| status | varchar(16) not null | check `IN ('queued','planning','retrieving','writing','fitting','images','composing','ready','failed')` |
| planner_model / writer_model | varchar(120) not null | |
| pipeline_version | varchar(32) not null | `canvas-academic-1` |
| plan | jsonb null | validated `PagePlan[]` |
| metrics | jsonb null | `{ pages, words, avgFill, citations, placeholders, lowDpiImages, durationMs, tokens }` |
| error | text null | safe message only |
| created_by | int null → users SET NULL | |
| created_at / updated_at | timestamptz | |

Indexes: `(document_id, created_at desc)`, `(workspace_id)`, and a partial unique index
`(document_id) WHERE status NOT IN ('ready','failed')`, so a document has one active run.

### 2. `canvas_generation_pages` (new)

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| run_id | uuid not null → canvas_generation_runs CASCADE | |
| workspace_id | uuid not null | denormalised for scoping |
| page_index | smallint not null | unique `(run_id, page_index)` |
| design_id | varchar(32) not null | academic or brochure design id |
| status | varchar(16) not null | `pending/written/fitted/failed` |
| purpose | text not null | from the plan |
| queries | jsonb not null | the retrieval queries used |
| chunk_ids | text[] not null default `{}` | evidence retrieved |
| cited_chunk_ids | text[] not null default `{}` | evidence actually cited |
| image_ids | uuid[] not null default `{}` | document images placed |
| content | jsonb null | validated page output (before compose) |
| word_count | int null | |
| fill_ratio | numeric(4,3) null | 0–1.5 |
| attempts | smallint not null default 1 | writer + fit retries |
| notes | jsonb not null default `[]` | reviewer notes for this page |
| created_at / updated_at | timestamptz | |

### 3. Alter `document_canvases` and `canvas_templates`

- `document_canvases`: drop and re-add `document_canvases_source_check` as
  `source IN ('composed','edited','template','generated')`; add
  `generation_run_id uuid null → canvas_generation_runs SET NULL`.
- `canvas_templates`: add `category varchar(16) not null default 'brochure'` (check
  `IN ('brochure','academic')`), `slots jsonb not null default '{}'` (word ranges and image slots,
  for the gallery and validation), and `preview_key varchar(255) null` (thumbnail in drive).
  System academic templates are upserted by `canvas:templates:seed`.
- Update `CanvasSource` in `app/models/document_canvas.ts` and `CanvasTemplateKind`/model columns.

### 4. Alter `document_images` and add `document_image_variants`

`document_images` new columns:

| column | type | notes |
|---|---|---|
| caption | varchar(400) null | numbered figure caption text, editable |
| alt_text | varchar(300) null | accessibility text |
| focus_x / focus_y | smallint null | 0–100, from sharp `attention` crop |
| phash | char(16) null | 64-bit average hash, for de-duplication |
| source_chunk_id | uuid null → chunks SET NULL | set when promoted from a source PDF image |
| origin | varchar(16) not null default 'upload' | check `IN ('upload','source')` |

`document_image_variants` (new): `id uuid pk`, `image_id → document_images CASCADE`, `workspace_id`,
`purpose varchar(8)` check `IN ('thumb','screen','print')`, `format varchar(8)` (`webp`,`jpeg`,`png`),
`width int`, `height int`, `bytes int`, `key varchar(255)` (drive key), `created_at`.
Unique `(image_id, purpose)`.

Layout options need no migration: `document_layouts.options.canvas = { profile, depth, templateSet,
pages: 'auto' | number, images: boolean }` (jsonb). Validate it in `app/validators/layout.ts` and
`layout_validation.ts`.

## Pipeline stages in detail

### Stage 1: Plan (`canvas_planner.ts`)

Input: title, brief, project information, author instructions, layout options, plus a **broad
retrieval** (`search`, 30 chunks, 6 000 tokens) so the plan follows what the sources actually cover.

Output (`planSchema`, zod):

```ts
{
  thesis: string,                // ≤ 400 chars: the document's central argument or purpose
  audience: string,              // ≤ 200
  pages: Array<{
    design: AcademicDesignId,    // from the chosen template set
    title: string,               // ≤ 90
    purpose: string,             // ≤ 300: what this page must establish
    questions: string[],         // 2–5 research questions, used as retrieval queries
    keyTerms: string[],          // ≤ 6, defined on first use
    wantsImage: boolean,
  }>,                            // count: auto → 6–12, otherwise exactly n
  coverageGaps: string[]         // topics the sources do not support → reviewer notes
}
```

Fixed pages are added by the application, not the model: `title_page` first, `contents` second when
there are 6 or more pages, `references` last. The model plans only the content pages between them.

### Stage 2: Per-page retrieval (`RetrievalService.searchPages`)

- One query per planned question plus `title + purpose`, fused with the existing hybrid RRF SQL.
- **Per-page budgets** instead of one shared budget, set by depth: concise 2 000, standard 3 500,
  detailed 5 000 tokens. `perSection` is 12 and each page keeps up to 10 text chunks.
- Pages may share chunks. A chunk cited on an earlier page is down-ranked by 0.5 on later pages,
  which pushes each page toward new evidence and less repetition.
- Image chunks are collected per page (max 3) for stage 5.
- The total stays within the model's context per call because each page is its own call.

### Stage 3: Per-page writing (`canvas_page_writer.ts`)

- One `withStructuredOutput` call per page (`write_canvas_page`), **concurrency 3** (a small local
  semaphore or `p-limit`), each wrapped in `runGeneration` (retry and corrective message).
- Each call receives the thesis, the full plan (titles and purposes only, so pages don't repeat each
  other), the page's plan entry, its evidence, the **summaries of the pages already written** (one
  line each), and the design's word ranges from `academic/designs.ts`.
- Output (`academicPageSchema`):

```ts
{
  design: AcademicDesignId,
  title: string,
  lead: { text: string, chunks: string[] } | null,           // 40–80 words, the page's claim
  sections: Array<{
    heading: string,
    paragraphs: Array<{ text: string, chunks: string[] }>,    // 70–180 words each
    bullets: string[],                                        // optional, ≤ 6
  }>,
  definitions: Array<{ term: string, definition: string, chunks: string[] }>,
  figures: Array<{ value: string, label: string, qualifier: Qualifier, chunks: string[] }>,
  callout: { kind: 'example'|'note'|'limitation', title: string, text: string, chunks: string[] } | null,
  takeaway: string | null,                                    // ≤ 40 words
  summary: string,                                            // one line, passed to later pages
  reviewer_notes: string[]
}
```

- Validation rejects paragraphs without `chunks` when sources exist (except the lead and takeaway),
  chunk ids that were not supplied, and invented figures (each `figures[].value` must appear in a
  cited chunk; reuse the claim-evaluation helper).

### Stage 4: Fit loop (`shared/canvas/fit.ts`)

Estimator, deterministic and browser-safe:

```
charsPerLine = frame.w_mm / (fontPt × 0.3528 × avgGlyph(family))      // avgGlyph ≈ 0.50 sans, 0.47 serif
lines        = (frame.h_mm − 2×padding) / (fontPt × 0.3528 × lineHeight)
capacityWords = charsPerLine × lines / 6.0  − headingCost − bulletCost
fill         = writtenWords / capacityWords
```

- Calibrate `avgGlyph` once against the real renderer: render fixture pages with Chromium, measure
  `scrollHeight` against the frame height, and commit the constants with a unit test that pins them.
- `fill < 0.70` → one **expand** call (same evidence plus 4 more chunks, "add depth: mechanism,
  example, implication, limitation"). `fill > 1.00` → one **condense** call, or, for
  `essay`/`two_column`, **split** into a continuation page with the same design and
  "(continued)" in the title. Max one fit retry per page; record `attempts`.

### Stage 5: Images (`canvas_image_planner.ts`)

1. Candidates: the document's own `document_images` plus image chunks retrieved for the page
   (from source PDFs). Source images are **promoted** to `document_images` (`origin = 'source'`,
   `source_chunk_id`) only when placed, so the canvas rule "only document images" still holds.
2. Filters: short edge ≥ 600 px for a figure slot (≥ 300 px for a thumbnail slot); drop duplicates by
   `phash` (Hamming distance ≤ 6); drop images under 4 KB or with extreme aspect (> 4:1).
3. Score: cosine similarity of the image chunk's contextual text or caption embedding against the page
   purpose, + 0.2 if the image appears on the same source page as a cited chunk, − 0.3 if already used.
4. Slot match: aspect class (landscape ≥ 1.2, square, portrait ≤ 0.83) chooses the design variant:
   `figure_text` for landscape, `side_figure` for portrait. Never stretch; `cover` fit with the
   stored focal point.
5. Caption and alt: one small call per placed image (planner model), or the chunk's existing
   contextual description when there is one. Captions are numbered at compose time
   ("Figure 3. …"), with the source cited.
6. Effective resolution check: `dpi = pxShortEdge / (frameShortEdge_mm / 25.4)`; below 200 dpi is a
   page warning in metrics and the UI.

### Stage 6: Compose (`shared/canvas/academic/compose.ts`)

Same `SheetBuilder` approach as `compose.ts`: deterministic, nothing dropped (leftovers go to the
main text frame). Typography for the academic set: body `family: 'serif'`, `font: 'md'` (9.5 pt),
`lineHeight: 145`, `align: 'justify'`; headings brand sans 700; captions `xs` italic muted;
20 mm outer margins; 12-column grid with a 5 mm gutter; running header (document title) and folio
(page number) as small text frames on every content page.

## New templates (academic set)

Each design lists its slots and word ranges at the **standard** depth (concise × 0.6,
detailed × 1.3, capped by measured capacity).

| id | Layout | Body words | Images |
|---|---|---|---|
| `title_page` | Brand band, title, subtitle, abstract box, keywords, author/date | abstract 150–250 | optional hero (landscape) |
| `contents` | Generated table of contents from the plan, with page numbers | — (deterministic) | — |
| `essay` | Single wide column, H2 + H3 sections, optional pull quote | 450–600 | — |
| `two_column` | Two justified serif columns, section headings spanning | 600–800 | — |
| `figure_text` | Landscape figure in the top 45% with numbered caption, text below in 2 columns | 300–420 | 1 landscape |
| `side_figure` | 60/40 split: text and portrait figure with caption | 350–450 | 1 portrait |
| `data_findings` | 2–4 figure frames with qualifiers, an interpretation and a method note | 280–380 | — |
| `key_concepts` | Lead paragraph and a 2×3 definition grid | 300–420 | — |
| `case_box` | Narrative and a shaded case or example box with a takeaway line | 380–500 | optional small |
| `comparison` | 2–3 criteria cards and an analysis paragraph | 300–400 | — |
| `conclusion` | Summary, implications, limitations, further work | 380–500 | — |
| `references` | Numbered sources list from citations (deterministic) | — | — |

Template sets: **Academic report** (`title_page, contents, essay…, conclusion, references`),
**Research brief** (4–6 pages, `title_page, figure_text, data_findings, conclusion, references`), and
**Brochure** (the existing designs, with depth applied by raising `CAPS` by a depth factor).
`canvas:templates:seed` stores each academic design as a system `canvas_templates` row
(`category = 'academic'`, `kind = 'sheet'`, `slots` filled), so the existing template picker can show them.

## Prompts (`canvas_prompts.ts`)

### Shared rules (both profiles)

```
You write pages for a laid-out document. The application draws each page; you supply its content.

Evidence
- Use only the supplied sources. Cite every factual paragraph by listing the chunk ids that support it,
  copied exactly. Never create ids. Never mention sources, files, chunks or "the document".
- Never invent figures, names, dates, awards or quotations. A figure must appear in a cited chunk.
- Where the sources do not support something the page needs, write "[insert text here]" and add a
  reviewer note. Never pad with generic statements.

Structure
- One page develops one idea, stated in the lead. Each section advances it; no section restates
  another page (the plan and earlier page summaries are given to you).
- Paragraphs follow claim → evidence → explanation → significance. Open with a topic sentence.
  70–180 words each.
- Define each key term on first use, in the definitions list or in the text.
- Use the word range given for this page's design. Write toward the upper half of the range.
```

### Academic profile addendum

```
Register: formal academic prose in the third person. Precise, neutral, no marketing language,
superlatives or exclamation marks. Prefer specific nouns and verbs over adjectives.
Hedge in proportion to the evidence ("suggests", "is associated with") and state limitations.
Explain mechanisms and reasons ("because", "which means"), not only outcomes.
Where useful, relate the point to its wider context (method, field or prior practice) using only the sources.
Each content page ends with a takeaway sentence that states the page's contribution to the thesis.
```

### Informative profile addendum

```
Register: clear, explanatory prose for an informed non-specialist. Concrete examples first,
then the general point. Short sentences where possible; no jargon without a definition.
Still evidence-led and cited; no promotional claims.
```

### Planner system prompt (summary)

Role: an editor who structures a document from evidence. Output: thesis, audience, content pages
with design, purpose, 2–5 research questions, key terms and whether an image helps. The questions
must be answerable from the supplied sources, and gaps go in `coverageGaps`. Pages progress
context → concepts → evidence and findings → analysis → implications. Allowed designs and what each
is best for are generated from `academic/designs.ts`, so they can't drift.

### Expand and condense correctives

- Expand: "This page fills {fill}% of its layout. Add {n} words of depth using the additional
  sources: a mechanism, a concrete example, an implication and a limitation. Keep every existing
  citation."
- Condense: "This page exceeds its layout by {over}%. Reduce to {target} words by merging overlapping
  sentences and removing restatement. Keep every figure and citation."

Prompt text gets a snapshot unit test, so any edit shows up in review.

## HTTP API

Routes under the existing workspace document group, behind `canvasEnabled()` and `CANVAS_GENERATION`:

| method | path | body | result |
|---|---|---|---|
| POST | `/documents/:documentId/canvas/generate` | `{ mutationId, baseVersionId, options: { profile, depth, templateSet, pages, images } }` | `202 { taskId, runId }`; 409 on stale base or active run |
| GET | `/documents/:documentId/canvas/generation` | — | latest run: status, stage, per-page metrics, notes |
| POST | `/documents/:documentId/canvas/pages/:index/regenerate` | `{ mutationId, baseVersionId, mode: 'rewrite'\|'expand'\|'condense' }` | `202`; replaces only that sheet in a new version |

Validators in `app/validators/canvas_generation.ts` (vine). Policy: `document_policy` update rights.
Add a Postman collection folder `Canvas generation` under `postman/` and run it with the Postman CLI
against the dev server as part of verification.

## CLI commands (`node ace …`)

| command | purpose | flags |
|---|---|---|
| `canvas:generate` | Run the full pipeline synchronously for one document (operators, debugging) | `--workspace --document --profile --depth --template-set --pages --dry-run` (prints metrics, saves nothing) `--json` |
| `canvas:plan` | Stages 1–2 only: print the plan and each page's retrieval coverage (chunks, tokens, files) | `--workspace --document --json` |
| `canvas:density` | Quality report: words, fill, citations, placeholders and low-dpi images per page. **Exits 1 below thresholds**, so it works as a gate | `--workspace [--document] [--min-words 280] [--min-fill 0.7] [--json]` |
| `canvas:templates:seed` | Idempotent upsert of the system academic templates (bumps `version` when a layout hash changes) | `--dry-run` |
| `images:optimize` | Build `thumb/screen/print` variants, focal points and phash for images without them | `--limit 500 --dry-run` |

Scaffold each with `node ace make:command`, following `canvas_audit.ts` (lazy import, `startApp: true`,
`exitCode` on failure).

## Image optimisation

- **On upload** (`DocumentImageService` → new `ImageVariantService`, using `sharp`, already a dependency):
  auto-rotate from EXIF, strip metadata, convert to sRGB, then write
  `thumb` (320 px webp q70), `screen` (1600 px webp q80) and `print` (≤ 3508 px long edge, A4 at
  300 dpi; mozjpeg q85, or PNG kept when there is alpha). Compute the focal point with `sharp`
  `strategy: attention` and store the phash.
- **Editor** loads `screen`; the image library loads `thumb`.
- **Renderer** picks the smallest variant with `px ≥ frame_mm / 25.4 × 300` and then resizes it to
  exactly that before embedding as a data URI. This roughly halves PDF size for photo-heavy documents.
  Cache the resized bytes per `(variant, w, h)` for the duration of the export.
- **Existing images** are backfilled with `images:optimize`.
- **Focal point** defaults from the stored `focus_x/focus_y` when a frame has no `focus` of its own.

## UI

1. **Generate pages dialog** (`generate_dialog.tsx`, shadcn `Dialog`), opened from the canvas toolbar
   and from the empty canvas state:
   - Style: *Academic* / *Informative* (segmented control).
   - Depth: *Concise · Standard · Detailed*, with the words per page shown ("≈ 450 words a page").
   - Template set: gallery cards with thumbnails (*Academic report*, *Research brief*, *Brochure*).
   - Pages: *Auto* or a number from 3 to 16.
   - Include images (switch), with a note when the document has none.
   - Warning when a draft has unsaved edits: generating creates a new version, and the draft is discarded.
2. **Progress** (`generation_progress.tsx`): a stepper (Planning → Gathering evidence → Writing page
   3 of 8 → Fitting → Placing images → Laying out), polling `GET …/canvas/generation` every 2 s. Pages
   appear in the page strip as each one is ready.
3. **Page quality badges** in `page_strip.tsx`: words, fill bar, citation count. Amber when fill
   < 70%, citations < 2 or an image is below 200 dpi; red on placeholders. Tooltip lists the reviewer notes.
4. **Per-page actions** (page strip context menu): *Rewrite page*, *Add depth*, *Make shorter*,
   *Change design* (re-composes from the stored page content without a model call).
5. **Inspector, image frame**: caption and alt fields (saved to `document_images`), effective dpi readout,
   "Suggested images" list from the page's retrieved image chunks.
6. **Template gallery** (`template_gallery.tsx`): academic templates grouped by category, with previews
   from `preview_key` (rendered by `canvas:templates:seed`).

Follow the existing Humblebee/shadcn styles in `inertia/components/canvas`; use `sonner` toasts for
job finish and failure.

## Tests

Pattern: Japa (`node ace test`), provider fakes by swapping `OpenRouterService.prototype` methods as in
`tests/functional/brochure_entry.spec.ts`, and Playwright specs in `tests/browser`.

**Unit (`tests/unit`)**
- `canvas_fit.spec.ts`: capacity for known frames; calibrated constants are pinned; fill ratio edges.
- `canvas_academic_compose.spec.ts`: every design places all nodes, frames stay inside the sheet, ids
  are unique, output passes `parseCanvas`, and it is deterministic (snapshot per design).
- `canvas_academic_content.spec.ts`: plan and page schemas; unknown chunk ids are stripped; invented
  figures are rejected; the word range check applies per depth.
- `canvas_prompts.spec.ts`: prompt snapshots; design guide generated from the table.
- `page_queries.spec.ts`: plan → queries; the anchor is truncated; down-ranking of already-cited chunks.
- `canvas_density.spec.ts`: metrics on fixture canvases.
- `image_variants.spec.ts`: variant choice by frame size and dpi; aspect class → slot; phash dedupe.

**Functional (`tests/functional`)**
- `canvas_generation.spec.ts`:
  - POST generate → 202, task created with `target: 'canvas'`, run row `queued`.
  - Executing the task with fake planner and writer → new version, `document_canvases.source =
    'generated'`, `generation_run_id` set, every content page ≥ min words and ≥ 2 citations, all
    citations in the supplied chunks.
  - Underfilled first draft → exactly one expand call; overflow on `essay` → continuation page.
  - Stale `baseVersionId` → 409; second active run → 409; flag off → 404; other workspace → 404.
  - Regenerate page 3 → new version where only sheet 3 changed (compare the other sheets' hashes).
  - Writer failure on one page → run `failed`, previous version untouched, safe error message.
- `canvas_images_generation.spec.ts`: a source image is promoted with `origin = 'source'`;
  low-resolution images are skipped; captions are numbered; the export embeds the `print` variant
  resized to the frame.
- `canvas_commands.spec.ts`: `canvas:density` exit codes, `canvas:templates:seed` idempotent,
  `images:optimize --dry-run` writes nothing.

**Browser (`tests/browser/canvas_generation.spec.ts`)**: open dialog → choose Academic/Detailed →
progress stepper → pages appear with badges → "Add depth" on one page updates its badge.

**Eval (`tests/eval/canvas_density.json`)**: 3 recorded source sets (PDF fixtures in
`tests/fixtures/pdf`). `canvas:generate --dry-run --json` on each, against a real model, run manually
before merging. Thresholds: content pages ≥ 280 words (standard), average fill 0.75–0.95,
≥ 2 citations per page, 0 invented figures (claim evaluation), ≤ 1 placeholder per document when sources cover the brief.

## Implementation phases

Each phase ends green on `bun run typecheck`, `bun run lint` and `node ace test` for the touched suites.
Commit per phase.

1. **Schema and models**: the four migrations, model updates (`DocumentCanvas` source, `CanvasTemplate`
   category/slots, `DocumentImage` columns, new `CanvasGenerationRun`/`CanvasGenerationPage`/
   `DocumentImageVariant` models), `database/schema.ts` regenerated, env vars in `start/env.ts` and
   `.env.example`.
2. **Fit estimator and academic designs**: `fit.ts`, `academic/designs.ts`, `academic/compose.ts`,
   unit tests, Chromium calibration of the constants.
3. **Prompts and schemas**: `academic/content.ts`, `canvas_prompts.ts`, snapshot tests.
4. **Pipeline**: planner, `searchPages`, page writer with concurrency and the fit loop, compose and save,
   `GenerationService` dispatch on `target`, run and page rows, functional tests with fakes.
5. **Images**: `ImageVariantService`, upload hook, renderer variant choice, image planner, promotion
   of source images, tests.
6. **HTTP and CLI**: controller, validators, routes, the five commands, Postman folder, functional and
   command tests.
7. **UI**: dialog, progress, badges, per-page actions, inspector fields, template gallery, browser test.
8. **Seed and verify**: `node ace migration:run`, `node ace canvas:templates:seed`,
   `node ace images:optimize`, generate on the three eval source sets, `canvas:density` passes,
   PDF export checked visually with `pdf:inspect`. Write `docs/canvas-academic-pipeline-verification.md`.

## Risks and mitigations

- **Latency and cost**: 8–12 page calls plus fit retries. Concurrency 3 and a per-page timeout keep it
  inside the 10-minute job limit (about 2–4 minutes typical). `metrics.tokens` makes the cost visible.
  Concise depth uses the planner model for writing too.
- **Estimator drift from real rendering**: the calibration test fails when fonts or CSS change; re-run
  calibration then.
- **Repetition across pages**: plan-level purposes, earlier page summaries and citation down-ranking.
  `canvas:density` also reports n-gram overlap between pages (warn above 15%).
- **Thin sources**: placeholders plus `coverageGaps` reviewer notes, never padding. The UI shows them in red.
- **Approval invalidation**: a regenerated page is a new version and invalidates approval like any edit
  (existing behaviour, intended).
