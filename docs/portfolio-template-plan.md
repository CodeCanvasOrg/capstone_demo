# One portfolio template: implementation plan

Status: proposed, 26 Nov 2026. Branch: `feature/one-portfolio-template` (plain branch from `dev`).
Design source of truth: `docs/design/portfolio-template/` (`template.pdf`, `template.html` with `data-slot`
attributes, `tokens.json`, `README.md`, `preview/pw-{1,2,3}.png`). Builds on
`canvas-academic-pipeline-plan.md` and `canvas-editor-implementation-plan.md`.

## Goal

Replace the twelve academic page designs (`shared/canvas/academic/designs.ts`) with **one template, the
Navy / Gold portfolio**, which has three page designs: `cover`, `entry` and `sources`. The generated
document is a cover, then for each entry an `entry` page followed by its `sources` page(s). The exported
PDF, the canvas editor sheets and the template thumbnails must look like the design, 1:1 for the cover and
the entry page.

Non-goals: deleting the legacy academic modules. `feature/legacy-cleanup` is editing
`canvas_prompts.ts`, `canvas_page_writer.ts` and `page_queries.ts` at the same time, so this branch builds the
portfolio system beside them, re-points every entry point (options, pipeline dispatch, seeder, CLI, HTTP, UI)
and leaves the academic files unreachable. Their removal is a follow-up after both branches merge.

## 1. Design

### 1.1 Page designs

| Design    | Purpose                                 | Frames (A4, 595.28 x 841.89 pt)                                                                                                                                                            |
| --------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cover`   | Title, subtitle and three facts         | Paper sheet, navy block to y = 666 pt, nested hexagons (art), eyebrow, title (Inter Display 38/39.4, three composed lines), subtitle, gold rule, three meta columns on the paper band      |
| `entry`   | One project: intro, figure, 3 to 8 rows | Tag pill (section number) and gold section label, title, gold rule, intro (4 lines), figure frame 221.25 x 309.75 pt holding 1 to 4 pictures, rows column x = 284.25, width 260.25, footer |
| `sources` | The documents the entry cites           | Same header and footer, numbered reference list (4 per page), optional evidence table, optional callout                                                                                    |

All geometry is the measured slot box from `tokens.json`, converted from points to the canvas unit
(tenths of a millimetre, `pt x 3.5278`), so a frame can be at most 0.14 pt away from the design.

### 1.2 Slot map

`slot` -> content field (`shared/canvas/portfolio/content.ts`). Frame ids are the slot with dots turned into
hyphens and the sheet prefix (`s2-entry-rows-3-body`), so a frame can be traced back to its slot.

| Slot                                                    | Content field                                               | Budget (tokens.json `max_lines`, measured by `measure.ts`)     |
| ------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `cover.eyebrow`                                         | `cover.eyebrow`                                             | 1 line, ~30 chars                                              |
| `cover.title`                                           | `cover.title`                                               | 3 lines of 350 pt                                              |
| `cover.subtitle`                                        | `cover.subtitle`                                            | 3 lines of 390 pt (~160 chars)                                 |
| `cover.meta.{1..3}.{label,value,secondary}`             | `cover.meta[i].{label,value,secondary}`                     | 1 / 2 / 2 lines of 155 pt; a column without a value is dropped |
| `entry.section_number`                                  | entry index, two digits                                     | 1                                                              |
| `entry.section_label`                                   | `entry.category`                                            | 1 line, ~25 chars                                              |
| `entry.title`                                           | `entry.title`                                               | 1 line of 493.5 pt (~40 chars)                                 |
| `entry.intro`                                           | `entry.intro`                                               | 4 lines of 430 pt (~300 chars)                                 |
| `entry.figure`                                          | up to 4 document images, contain-fit                        | cells in the 221.25 x 309.75 frame                             |
| `entry.rows.{n}.label`                                  | `rows[n].label`                                             | 1 line                                                         |
| `entry.rows.{n}.body`                                   | `rows[n].constraint` (red) + `rows[n].body`                 | 8 rows: 2,2,3,1,2,2,1,2 lines; fewer rows: 3 lines each        |
| `entry.rows.{n}.citation`                               | `rows[n].chunks`, one superscript per source document       | 1                                                              |
| `entry.doc_title`, `entry.page_counter`                 | document title, `n / N`                                     | 1                                                              |
| `sources.section_number`, `.title`, `.intro`            | entry index, "Evidence behind the entry" style title, intro | 1 / 1 / 4                                                      |
| `sources.references.{n}.{number,document,locator,note}` | derived from the cited chunks                               | 1 line each                                                    |
| `sources.evidence.*`                                    | `claims[]` (claim, source number, evidence kind)            | table dropped when there are no claims                         |
| `sources.note.{title,body}`                             | fixed reading note, or the entry's `evidence_note`          | 1 / 3                                                          |

### 1.3 Tokens -> CSS and brand kit

- `tokens.json` colours become a new **published brand kit** `portfolio` v1 in `shared/layout/brand.ts`:
  `primary #14213d`, `accent #f2a900`, `accentText #8a6a10` (the design's gold-dark), `text #14213d`,
  `muted #6b7280`, `background #ffffff`, `surface #f6f4ee` (paper). Template-only colours (green `#1f7a5a`,
  red `#b23a3a`, light `#c9d0e0`, hairline `#e3e0d6`, secondary ink `#3a4560`, the four hexagon golds) are
  constants in `shared/canvas/portfolio/tokens.ts` and are written into frame styles as hex.
- Fonts: Inter static instances (`Inter-400-14`, `600-14`, `700-14` as family `Inter`; `700-32` as family
  `Inter Display`), copied from the design folder to `public/fonts/portfolio/` (served as static files, so the editor's iframe and the export read the same files). The export embeds them as
  TrueType (the font loader learns `.ttf`); the editor canvas loads them with `@font-face` from `/fonts/portfolio/`. Static files
  keep the PDF free of Type 3 fonts from variable instances.
- Type scale and spacing are `tokens.ts` constants (`TYPE.cover`, `TYPE.row`, ...) from `type_scale` and
  `spacing`. Frame styles use exact point sizes (`size`), exact line heights (percent with one decimal) and
  tracking in thousandths of an em, so the browser reproduces the design's metrics.
- The canvas model grows only what the design needs: `size` and `lineHeight` accept one decimal; style keys
  `strongColor`, `citeColor`, `citeSize`; font family `display`; art kind `hexagons`; geometry may be as thin
  as 0.2 mm (hairlines); the canvas may carry `template: { id, version }`.

### 1.4 Empty rows, constraints, footnotes and sources

- **Empty rows are dropped, never printed.** The composer removes a row with no body (and no constraint) and
  its separator, then lays the remaining rows out from y = 207 pt. Three to eight rows are supported; fewer
  than three is a reviewer note, not a failure. Row heights are fixed by the line budget, not by the text, as
  in the design (`26.4 pt + 13.2 pt x budget`, the design's own table when there are eight rows).
- **Red constraint.** A row's `constraint` sentence is bold text in the frame; a frame style
  (`strongColor`) turns bold into the design's red, and the body is semibold green.
- **Footnotes and superscripts.** The writer lists the chunk ids that support a row. The composer collapses
  them to **one citation node per source document** (the first cited chunk is the document's representative),
  so the export's existing numbering (by `sourceChunkId`, in reading order, repeats reuse their number) gives
  the design's `1, 1, 2, 3, 3, 4`. `shared/canvas/portfolio/citations.ts` numbers a canvas the same way, so the
  editor draws the same gold superscripts and the sources page prints the same numbers.
  `citeColor`/`citeSize` give the design's 7 pt gold superscript.
- **Sources page generation.** For each entry the composer lists its distinct cited documents in citation
  order: number, document name (file name without extension), locator (`Pages 3-7 - chunks 1-6`, from the
  cited chunks' page and index) and a one-line note (the writer's, else "Supports Context, Research").
  Four references per page; a fifth starts a continuation page with the same header and footer. The evidence
  table (claim, source and locator, evidence kind) and the reading note are on the first sources page; the table
  is dropped when the entry has no claims, and the note moves up. A canvas with the portfolio marker does not get the export's generic trailing "Sources" sheet.

### 1.5 Editor UI

- **Template picker / generate dialog.** The three-way "template set" choice goes. The dialog opens with one
  template card, "Navy and gold portfolio": the three page designs fanned as real thumbnails
  (`cover`, `entry`, `sources`) with a one-line description each, and a summary that updates as options change
  ("Cover, 3 entries, 3 sources pages: about 7 pages"). Options: Entries (Auto, 1 to 6), Depth
  (Concise 4 to 5 rows, Standard 6 to 7, Detailed 8 rows), Include images. Style is fixed to plain, informative
  prose; the choice is gone.
- **Thumbnails.** `canvas:templates:seed`-equivalent rendering produces one PNG per page design. The gallery
  shows the three, labelled, with the template name and version; they are the same thumbnails the dialog uses.
- **Page strip.** Pages are labelled `Cover`, `Entry 2`, `Sources 2`; "Change design" is removed (there is one
  design per page kind); rewrite, add depth and shorten stay for entry pages and rewrite for the cover.
- Motion follows the skills: pressed buttons scale 0.97 in 160 ms ease-out, the thumbnail fan responds to hover
  only under `(hover: hover)`, nothing animates from scale 0, `prefers-reduced-motion` removes movement.

## 2. Database

New migrations only (`node ace make:migration`); nothing old is edited. `canvas_generation_runs.template_set` is
free text (no check constraint), so no migration was needed for the new value.

1. `alter_canvas_templates_for_portfolio`
   - category check becomes `brochure | academic | portfolio`;
   - `template_key varchar(32) null` (family, `portfolio`), `retired_at timestamptz null`;
   - partial unique index `(template_key, design_id) where workspace_id is null and retired_at is null`;
   - the academic system rows are **retired** (`retired_at = now()`), not deleted, because a past
     `document_canvases.template_id` may point at them. `visibleTo` and the gallery skip retired rows.
2. `alter_document_canvases_template_marker`
   - `template_key varchar(32) null`, `template_version smallint null`, set from the canvas' own marker on
     save (index on `template_key`);
   - backfill: canvases whose generation run used an academic set get `template_key = 'legacy_academic'`.

Models: `CanvasTemplate` gains `templateKey`, `retiredAt` and `category` includes `portfolio`;
`DocumentCanvas` gains `templateKey`, `templateVersion` (through the regenerated `database/schema.ts`); `CanvasGenerationRun.templateSet` accepts `portfolio`.
`database/schema.ts` is regenerated and formatted.

Seeding writes four system rows with `template_key = 'portfolio'`: one `document` template (cover, entry and
sources with the design's sample content) and one `sheet` template per page design. A row is versioned by the
hash of its project: a changed layout bumps `version`, an unchanged one is left alone.

**Existing canvases.** A saved canvas is self-contained (frames, styles, images), so every old academic
canvas keeps opening, editing and exporting with the brand it was pinned to; nothing is rewritten. The
fallbacks are explicit:

- the canvas editor and exporter pick the template's brand kit only when the canvas carries the portfolio
  marker, otherwise the pinned layout brand as today;
- "Generate pages" always produces a portfolio canvas (stored `academic_report`, `research_brief` and
  `brochure` option values coerce to `portfolio`), as a new version, never an edit of the old one;
- page actions on a page of a legacy run answer 409 "These pages were made with a retired template. Generate
  them again."; legacy page designs are not offered anywhere in the UI.

## 3. Pipeline

`CanvasPipeline.generate` and `.regenerate` dispatch on `options.templateSet === 'portfolio'` to
`PortfolioPipeline` (`app/services/canvas/portfolio/`), keeping the run/page rows, recorder, task lease,
`saveGenerated` and claim review unchanged.

```
1 Plan      PortfolioPlanner   brief + broad evidence -> cover brief + N entries
                               (title <= 40, category <= 25, purpose, 2-5 questions, wantsImages)
2 Retrieve  RetrievalService.searchPages, one budget per entry
3 Write     PortfolioWriter    per entry: intro, rows[label, body, constraint, chunks], claims, notes
4 Fit       fit budget         every field measured against its slot's max lines; one condense call naming the
                               over-budget fields, then a deterministic trim at a sentence/word boundary with a
                               reviewer note; rows with nothing to say are dropped
5 Images    PortfolioImages    up to four pictures per entry, scored against the entry, no repeats
6 Compose   composePortfolio   cover + (entry + sources...) per entry -> CanvasDocument with the template marker
7 Save      CanvasService.saveGenerated (source 'generated') + run metrics + claim review
Export      canvas_renderer + pdf_service, brand kit and fonts of the template
```

- **Fit budgets** come from `tokens.json` through `tokens.ts`. `measure.ts` holds Inter's advance widths (400,
  600, 700 at opsz 14; 700 at opsz 32), generated by a script from the shipped font files, rounds each glyph to a
  whole pixel as Chromium does at these sizes (measured: a 7 pt line is 2.7 percent wider than its unrounded
  advances) and wraps text the way the browser does (greedy at spaces, hyphens and dashes, letter spacing included). The writer prompt states each
  budget in lines and approximate characters; the fit loop and the composer use the same numbers, so what the
  model is told, what is validated and what prints cannot disagree.
- **Writer prompts** (`portfolio_prompts.ts`, a new file) carry the conventions the legacy-cleanup branch is
  adding to the academic prompts: footnote markers (chunk ids per row, never inline citations in the text),
  `reviewer_notes` for gaps, an evidence kind per claim (`measured`, `observed`, `research_finding`,
  `reported`, `estimate`, `target`) and length targets from the fit budget. They are written independently so
  the two branches merge without touching the same lines.
- The cover is written last from the entry summaries; its meta columns come from the document (title, author,
  date) and are dropped when empty.
- **Page actions.** Entry: rewrite, add depth, shorten. Cover: rewrite. The entry's sources page(s) and every
  other sources page are recomposed deterministically from stored content, because superscript numbers are
  global. Other entries are carried over exactly.
- Options: `templateSet` is always `portfolio`; new `entries: 'auto' | 1..6`; `depth` sets the row count;
  `images`; `profile` stays stored (default `informative`) for compatibility.

## 4. CLI

| Command                                                                           | What it does                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `portfolio:template:seed` (replaces `canvas:templates:seed`, which now delegates) | Idempotent upsert of the four system rows, retires academic rows, renders page thumbnails. `--dry-run`, `--no-previews`                                                                                                                                                                                                  |
| `portfolio:template:render`                                                       | Renders the sample document to PDF plus a PNG per page into `output/portfolio-template/`; `--out`, `--content <json>`                                                                                                                                                                                                    |
| `portfolio:template:check`                                                        | Renders the sample in Chromium, measures every slot's element box and compares it with `tokens.json`: position, width, line count against `max_lines`; compares the PNGs with `preview/pw-*.png` (mean pixel difference, tolerance flag); prints drift and exits non-zero beyond tolerance. `--json`, `--tolerance <pt>` |
| `canvas:plan`, `canvas:generate`, `eval:canvas`, `canvas:density`                 | Updated to the portfolio options and page kinds (`--entries`, no `--set`)                                                                                                                                                                                                                                                |

Postman: the HTTP surface changes by one route removal (`.../pages/:index/design`) and a new options shape
(`entries`, no `templateSet` choice). `postman/contracts/canvas-generation.yaml` and the collection are updated
(generate with `entries`, regenerate an entry, status), and the local mock answers the new structured calls.

## 5. Tests

| Level      | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit       | `portfolio_measure` (widths against Chromium-measured fixtures), `portfolio_tokens` (every slot box equals the `tokens.json` box), `portfolio_compose` (frames per page design, geometry equal to tokens, empty-row dropping and compaction, row budgets, cover meta dropping, sources pagination, evidence table removal), `portfolio_citations` (numbering equals the real projection numbering), `portfolio_content` (schema, fit budgets, trim), image grid cells, prompts snapshot |
| Functional | Routes (generate with options, status, regenerate entry, removed design route), the seed command (idempotent, retires academic rows, versions), render command output, check command on the sample, generation through the pipeline with stubbed model calls, export renders brand fonts and no generic sources sheet, legacy canvases still open and their page actions answer 409                                                                                                     |
| Browser    | The generate dialog shows the one template and its three page thumbnails and options; the generate flow reaches the new canvas; the editor shows gold superscripts, Inter fonts and the page labels                                                                                                                                                                                                                                                                                     |
| Visual     | `portfolio:template:check` renders the three sample pages and compares them with `preview/pw-1..3.png`. Measured on this branch: cover 1.2 percent of pixels differ, entry 3.7, sources 2.6 (limits 2, 4.5 and 4). The remainder is glyph anti-aliasing: the previews rasterise Type 3 variable-font glyphs, the export embeds static TrueType. Geometry is the exact check: all 78 slots are within 0.5 pt of `tokens.json`. A functional test runs the command when Chromium exists   |

## 6. Rollout and risks

1. Merge order: this branch and `feature/legacy-cleanup` are independent (no shared edited lines except one
   `Record` key if `TemplateSet` grows; see below). After both merge, delete `shared/canvas/academic/*` and the
   legacy generation modules, and fold the cleanup branch's prompt improvements into `portfolio_prompts.ts`.
2. Deploy: run the three migrations, then `node ace portfolio:template:seed`. Existing canvases are untouched.
   `CANVAS_EDITOR=pilot` and `CANVAS_GENERATION=on` flags are unchanged.
3. Risks and mitigations
   - _Font metrics drift_ (the estimator and Chromium disagree by a word): `portfolio:template:check` measures
     the real render, and the unit fixtures pin the estimator against it.
   - _Citation numbering is per source document_: one representative chunk is stored per document, so the
     claim review sees that chunk. The exact chunks cited per row stay in `canvas_generation_pages`.
   - _Thin frames and decimal sizes_ loosen the canvas schema; they only widen what validates, so old
     canvases still parse. Interactive resizing still clamps to 2 mm.
   - _Sources pages go stale if an author edits the citations by hand_; "rewrite" of the entry recomposes them.
   - _Legacy `TemplateSet` values_ still exist in `shared/canvas/options.ts` (moved from `academic/options.ts`); adding `portfolio` to that
     tuple forces one new key in `TEMPLATE_DESIGNS` in `canvas_prompts.ts`. That is a one-line edit kept in its
     own commit so the merge with `feature/legacy-cleanup` is trivial.

## 7. Implementation notes

- Merged `feature/legacy-cleanup` (RAG writer prompts and copy rules) into this branch before the pipeline work.
  The portfolio writer uses its pieces directly: `lengthTargets`/`lengthRules` for the per-slot length lines
  (built from the template's slot budgets), `stripInlineCitations`, `stripGapSentences` and `enforceBrandName`
  (the pinned layout brand's name is passed as `WriteContext.brand`), and `evidenceKind` for the claim kinds
  (`measured`, `estimated`, `client_reported`, `design_target` shown as "Measured result", "Estimate",
  "Client reported", "Objective, not measured"). The merge exposed a bug in `sentences()` (a decimal point such as
  "2.4x" ended a sentence and cut the figure in half); it is fixed in `shared/canvas/copy_rules.ts` with a test.
- `TEMPLATE_DESIGNS` in `canvas_prompts.ts` and `LABELS` in `canvas_pipeline.ts` each gained one `portfolio` key;
  the legacy modules are otherwise untouched and unreachable from the options, the routes and the UI.
- The "change design" route, validator, service method and menu are removed; its Postman request with them.
- Follow-up after both branches merge: delete `shared/canvas/academic/*`, the academic generation modules and
  their unit tests. **Done** on `feature/remove-academic-canvas`: see "Academic canvas pipeline" in
  `docs/legacy-cleanup.md`. The shared pieces the portfolio used moved to `shared/canvas/options.ts`,
  `shared/canvas/model_output.ts` and the portfolio modules, `CanvasPipeline` dispatches only to
  `PortfolioPipeline`, and the legacy `templateSet` values still coerce to `portfolio`.
