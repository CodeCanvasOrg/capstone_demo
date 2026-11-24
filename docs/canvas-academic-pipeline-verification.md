# Canvas academic pipeline: verification

Verified 23 Nov 2026 on `dev` against `docs/canvas-academic-pipeline-plan.md`. This records what was run, what it
showed, what was not done and why. Nothing here is claimed that was not run.

Environment: Node 24.22, Bun, Postgres 17 (pgvector) on :55433 and Redis on :6380 from `docker-compose.yml`, Adobe S3Mock
on :9090, Playwright Chromium 153 (`~/.cache/ms-playwright`), the PyMuPDF worker venv, an OpenRouter key in `.env`.
**Not available:** the Postman CLI (`postman`, `postman-cli` and `newman` are not on the PATH, and `~/.postman` does not
exist), so the Postman collection was written but never run.

## Commands run and results

| Command                                            | Result                                                                                                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run typecheck`                                | passes (both projects)                                                                                                                                                                 |
| `bun run lint`                                     | passes                                                                                                                                                                                 |
| `node ace test unit`                               | 652 passed, 18 skipped (the skips are existing)                                                                                                                                        |
| `node ace test functional`                         | 290 passed, 5 skipped (the skips are existing opt-in transport tests)                                                                                                                  |
| `node ace test browser`                            | 37 passed (the whole suite, including the existing canvas specs and the new `canvas_generation`)                                                                                       |
| `node ace migration:run` (dev DB and test DB)      | four migrations applied; `migration:rollback` then `migration:run` on the test DB also passed, so every `down()` works                                                                 |
| `node scripts/calibrate_fit.ts`                    | see "Calibration"                                                                                                                                                                      |
| `node ace canvas:templates:seed` (dev DB)          | 12 system templates created with Chromium-rendered previews; a second run changed 0 of 12 (idempotent); after the layout fixes below a third run changed 9 of 12 and bumped them to v2 |
| `node ace images:optimize --dry-run`, then without | dev DB: "Would build variants for 1 images", then "Built variants for 1 of 1"                                                                                                          |
| `DB_URL=$TEST_DB_URL node ace eval:canvas`         | real model, see "Real-model eval"                                                                                                                                                      |

New automated tests: unit `canvas_fit`, `canvas_academic_compose` (49, including one layout snapshot per design),
`canvas_academic_content`, `canvas_prompts` (every prompt snapshotted), `canvas_density`, `canvas_planner`,
`page_queries`, `image_variants`; functional `canvas_generation` (pipeline with provider fakes, as in
`brochure_entry.spec.ts`), `canvas_generation_http`, `canvas_images_generation`, `document_image_variants`,
`canvas_commands`, `canvas_generation_ui`, `canvas_render_fit` (renders all 12 designs in Chromium and checks no frame
overflows); browser `canvas_generation` (dialog, stepper, badges, "Add depth").

## Calibration of the fit estimator

`scripts/calibrate_fit.ts` sets fixed prose in a text frame with the exact export CSS in Chromium, for serif and sans,
8.5 and 9.5 pt, four widths, measures the height, and fits the glyph width that makes the estimate equal it. Result
(`tests/fixtures/canvas/fit_calibration.json`): fitted 0.501 for both families (per case 0.456 to 0.523); the estimate
is within 10% of all 16 measurements, which `canvas_fit.spec.ts` asserts. The constants are pinned at 0.50 (serif, sans),
0.52 (brand), 0.6 (mono).

**Caveat, to be done in the production image:** this machine has only the DejaVu fonts, so `Georgia`/`Times New Roman`
and `Inter`/`Arial` all fall back to the same face. The measurement is therefore of DejaVu, which is wider than Liberation
or Georgia; the constants are conservative (pages come out a little emptier, not overflowing). Re-run
`node scripts/calibrate_fit.ts` inside the Docker image, update `FIT.glyph` and the test's pinned values if it moves.

## Visual check in Chromium

All 12 designs were rendered with filled sample pages (`tmp/` output, not committed) and viewed. This found real faults,
all fixed before the last commit:

- the takeaway frame was 15 mm high and a two-line takeaway ran past it (now 20 mm);
- the essay's margin sidebar overflowed with a callout and two definitions (sidebar widened, and every text frame, not
  only the flowing ones, now counts toward overflow, so the fit loop sees it);
- the side-figure's sidebar (under the picture) overflowed (picture shortened, its sidebar enlarged, its content limits
  tightened);
- the title page's title could clip by 3 px at three lines (frame taller);
- **the template previews were blank**: the seeder rendered canvas HTML without projecting its text. It now uses the
  export's projection (`templateHtml`), and `canvas_render_fit.spec.ts` asserts no text frame is empty.

After the fixes, no frame overflows in any design at 85% fill.

## Real-model eval

`tests/eval/canvas_density.json` holds three source sets built from synthetic PDFs
(`tests/fixtures/pdf/canvas_heat.pdf`, `canvas_stock.pdf`, `canvas_clinic.pdf`, from
`tests/fixtures/pdf/src/make_canvas_eval_pdfs.py`, each about 500 to 600 words, plus the existing `sections.pdf` in one
set). `node ace eval:canvas` prepares them in a throwaway workspace (real PyMuPDF extraction, real OpenRouter embeddings),
runs the pipeline as `canvas:generate --dry-run` does with the configured models
(`anthropic/claude-haiku-5.5` for planner and writer; `CANVAS_WRITER_MODEL` was not set) and checks the plan's thresholds.
It was run against the test database only.

First complete run (before the planner limit below):

| Set               | Pages | Words | Avg fill | Citations | Placeholders | Time  | Tokens (est.) | Words >= 280 | Fill 0.75 to 0.95 | Cites >= 2 | No invented figures | Placeholders <= 1 |
| ----------------- | ----- | ----- | -------- | --------- | ------------ | ----- | ------------- | ------------ | ----------------- | ---------- | ------------------- | ----------------- |
| heat_pilot        | 10    | 2,317 | 57%      | 45        | 2            | 106 s | 98,000        | fail         | fail              | pass       | pass                | fail              |
| stock_rollout     | 11    | 3,231 | 83%      | 70        | 1            | 132 s | 138,000       | pass         | pass              | pass       | pass                | pass              |
| clinic_telehealth | 6     | 1,516 | 58%      | 28        | 0            | 86 s  | 49,000        | fail         | fail              | pass       | pass                | pass              |

After capping the planned content pages at about one per 100 words of source (the sources of the first two sets are
about 600 words, so six pages is already generous):

| Set               | Pages | Words | Avg fill | Citations | Placeholders | Words >= 280 | Fill band | Cites >= 2 | No invented figures | Placeholders <= 1 |
| ----------------- | ----- | ----- | -------- | --------- | ------------ | ------------ | --------- | ---------- | ------------------- | ----------------- |
| heat_pilot        | 8     | 1,668 | 52%      | 36        | 0            | fail         | fail      | pass       | pass                | pass              |
| clinic_telehealth | 6     | 1,448 | 48%      | 34        | 0            | fail         | fail      | pass       | pass                | pass              |

Honest reading: **the thresholds are met by one of the three sets and missed by two.** The pipeline works against a real
model (plan, per-page retrieval, writing, fit, compose all ran; every citation is a supplied chunk; no figure was
invented; the model says what the sources lack in `coverageGaps` instead of padding). The two failing sets have only
about 600 words of source for a document the dialog asks to be detailed, so some pages reach only 25 to 35% fill after
their one expand call, and the writer does not fabricate to fill them. The thresholds need sources that can carry them;
with the repository's synthetic fixtures they cannot, and I did not lower the thresholds. Re-run with real, consented
case-study PDFs before merging. The stock set passes but also shows the sources not being only about one company: it
included `sections.pdf` (a different Acme site), and the model flagged that mismatch in `coverageGaps`.

Faults the real run exposed (the fakes could not), all fixed and unit-tested:

- the model overshot a schema length limit (a 400-character thesis, a long figure value) and the client library refused it
  three times; limits are now cut at a word (`parseLenient`), the model is shown a schema without length limits
  (`modelSchema`) and the prompts state them;
- the model sometimes wrote `lead` or a paragraph as a bare string; that is now accepted as a paragraph with no citation;
- the plan asked for more pages than the sources could fill (see the planner cap above);
- an over-long abstract left the title page at 106% full after its one condense call; the last-resort trim now drops the
  abstract's last sentences (the title page has no sections to trim);
- `workspaces:dispatch-tasks` and `TaskDispatchService` cannot deliver jobs when run from `node ace` ("Job class
  ProcessFile not found": the job registry is loaded only by the worker, the server and the tests). This is existing
  behaviour, not caused by this work; `eval:canvas` therefore runs preparation directly. Worth a separate fix.

## Browser suite

The whole browser suite passes (37 tests). `tests/browser/canvas_generation.spec.ts` opens the dialog, chooses Academic and
Detailed, watches the stepper show "Planning" while the planner is held back, releases it, reloads to the generated pages,
checks the five page badges (one amber), opens a page's actions, chooses "Add depth" and checks its badge improves. One
existing browser assertion changed: a canvas preview now embeds the print copy of an opaque picture as a JPEG (it was the
original PNG).

## What was not done, and why

- **Postman CLI run:** not installed on this machine. The collection (`postman/collections/canvas-generation.postman_collection.json`),
  OpenAPI contract and mock handlers were written and syntax-checked only. The same behaviour is covered by
  `canvas_generation_http.spec.ts`. A dev server does start here (`node ace serve`), so the collection can be run once the
  CLI is installed, with a signed-in session.
- **Production-font calibration:** see above; needs the Docker image.
- **Sonnet-class writer:** recommended in the plan, not tried (the eval used the default Haiku model for both stages).
- **Claim evaluation in the eval:** the plan asks for "0 invented figures (claim evaluation)". The eval checks figures
  deterministically (a figure's digits must appear in a chunk it cites); the model-based `ClaimEvaluationService` is not
  run by it. The existing claim review still runs after every generation.
- **PDF export visual check with `pdf:inspect`:** the canvas export path was verified through HTML (previews embedding
  the resized print variant, asserted in `canvas_images_generation.spec.ts`) and Chromium renders, not by exporting and
  inspecting a PDF of a generated document.
- **Real pictures in the eval:** `images` is off in the eval sets (the synthetic PDFs carry no pictures). Picture selection
  is covered by the functional tests with generated images, not by a real-model run.

## Deviations from the plan

1. **Depth is a fill target, not a word multiplier.** At 9.5 pt in these layouts a page holds fewer words than the plan's
   table (the essay's flowing text holds about 250 to 300, not 450 to 600; a whole page is about 400 to 470 words with its
   lead, sidebar and takeaway). Word ranges are derived from measured capacity, capped by the nominal range; concise,
   standard and detailed use 0.70 to 0.82, 0.78 to 0.92 and 0.88 to 0.98 of it.
2. **Heading typeface in body text** is the frame's serif bold, not brand sans: a frame has one family.
3. **Image selection happens before writing**, so a figure page's lead can say what the figure shows; captioning and
   promotion of source pictures happen after the fit. A figure page with no usable picture is written as two columns (or an
   essay) rather than left with an empty frame.
4. **Reuse down-ranking** applies to chunks an earlier page was _retrieved_, not cited, because retrieval for every page
   happens before any page is written.
5. **Brochure template set** runs the existing brochure writer once and lays it out; the depth factor on `CAPS` and the
   image options are not applied (the brochure pipeline was not touched).
6. **References page** lists each source file with the pages cited, in order of first citation, not a numbered list that
   matches the export's citation numbers; the export's own trailing "Sources" sheet is kept.
7. **A fixed page count is exact:** no continuation pages are made when the author chose the number; the page is condensed
   or its last paragraphs are trimmed (and noted) instead.
8. **Page regeneration** replaces one sheet; the contents and references sheets are not rewritten, and those two pages
   cannot be regenerated. It needs the stored pages to line up with the canvas (409 otherwise).
9. **Inspector "Suggested images"** are the document's images not yet on a page, not the page's retrieved image chunks.
10. **Progress** shows each page as a chip as it is written; the page strip itself (with badges) updates when the canvas
    is reloaded.
11. **Layout option validation** lives in `shared/layout/templates.ts` (`resolveOptions`, which already validates
    `options`); `app/validators/layout.ts` keeps `vine.any()` for `options`, as it did.
12. Additions beyond the plan: `eval:canvas`, a planner cap on pages by source size, lenient model-output parsing, an
    operator helper for the commands (`canvas_operator.ts`), `GET .../canvas/templates` and its preview route, `PATCH` on a
    document image (caption and alt text), and a Chromium render test of every design.

## What you must do by hand

- **Deployed environments:** run `node ace migration:run` (four new migrations: runs, pages, canvas and template
  columns, image variants). `database/schema.ts` is committed.
- **Environment variables:** `CANVAS_GENERATION=on` (needs `CANVAS_EDITOR=pilot`), and optionally `CANVAS_PLANNER_MODEL`
  and `CANVAS_WRITER_MODEL` (default: `OPENROUTER_MODEL`). Add them to Railway and Vercel as needed; the Terraform files
  do not mention `CANVAS_EDITOR` today, so nothing there changed.
- **Seed the templates** on each environment: `node ace canvas:templates:seed` (add `--no-previews` where Chromium is not
  installed; run it again later to render the previews).
- **Backfill images:** `node ace images:optimize` (and `images:measure` for images uploaded before sizes were recorded).
  Until then an old image has no variants; the editor and exports fall back to the original.
- **Workers:** generation runs as a `generate` task, so the `documents` queue worker must be running as for any generation.
- **Re-calibrate** the fit estimator in the production image (see above).
- **Run `node ace eval:canvas`** with real source PDFs before enabling the flag for users.
