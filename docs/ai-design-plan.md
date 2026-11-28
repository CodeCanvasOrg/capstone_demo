# "Let AI choose": the model designs the pages

Status: proposed, 28 Nov 2026. Branch: `feature/ai-design` (from `dev`). Builds on `portfolio-template-plan.md` and
`canvas-editor-implementation-plan.md`.

## Goal

The portfolio template is a fixed design that the model only writes into. "Let AI choose" is the opposite
end: the model **designs the pages itself** (a design system, then a layout for every page as canvas frames),
using the case study's materials as reference (retrieved source text, the uploaded and extracted images, the
workspace brand kit). The application stays in charge of what must not depend on the model: geometry limits,
legibility, text that fits its frame, citations, and the sources page.

The option value is `templateSet: 'ai_design'` (`shared/canvas/options.ts`). `portfolio` stays the default and
the legacy values (`academic_report`, `research_brief`, `brochure`) still coerce to `portfolio`.

## Pipeline

`CanvasPipeline.generate` dispatches `ai_design` to `AiDesignPipeline` (`app/services/canvas/ai_design/`). It
reuses the run and page rows, the recorder, the task lease, `saveGenerated` and the claim review exactly as the
portfolio pipeline does. Statuses map as before (`planning`, `retrieving`, `images`, `writing`, `fitting`,
`composing`).

```
1 Digest    broad retrieval over the sources, the document's images (size, aspect, caption), the pinned brand kit
            (palette, fonts), the page count (from `pages`, else `entries`, else `depth`)          -> brief
2 Design    one structured call: design system + a frame layout per page                              -> design JSON
            normalise (clamp geometry) -> validate -> one corrective retry -> else fall back
3 Retrieve  RetrievalService.searchPages, one budget per designed page (its purpose and questions)
4 Images    each image frame gets a picture: the model's `imageRef`, else the best by the portfolio's
            scoring (subject overlap, aspect fit), no repeats; source pictures are registered as document images
5 Write     one call per page writes the text of every text frame from that page's chunks (chunk ids,
            claims with an evidence kind); cleaned with the portfolio's copy rules
6 Fit       every text frame is measured against its own box; one condense call, then a deterministic trim
7 Compose   frames -> CanvasDocument with `template: { id: 'ai_design', version: 1 }`, citations
            collapsed to one superscript per source document, then the sources pages
8 Save      CanvasService.saveGenerated (source 'generated') + metrics + claim review
```

### 1. Digest and brief

- Text: `RetrievalService.search` on the title and brief (30 chunks, 6000 tokens), shown to the model as a short
  digest (file, page, 300-character excerpt) plus the distinct file names.
- Images: the document's uploaded images (`DocumentImage`, dimensions known) and the picture chunks the retrieval
  matched (measured with sharp). Each gets a ref `img1..imgN`, with size, aspect class (`landscape`, `portrait`,
  `square`) and a caption. Pictures that fail the portfolio's `rejection` rules are not offered.
- Brand: the pinned layout brand's palette and font family (a template-only kit is ignored). Fonts the design
  may use are exactly those the editor and export can draw: `sans` (Inter 400/600/700), `display` (Inter Display
  700), both shipped in `public/fonts/portfolio`, and `brand` (the pinned brand's font, when there is one).
- Page count: `pages` when a number; else `entries + 1` (cover plus one page per entry); else by depth
  (concise 4, standard 6, detailed 8), held down to what the sources can fill. Exactly that many designed pages
  are required; the sources pages come on top.
- Multimodal: when the design model accepts images (`OpenRouterService.acceptsImageInput`, from the OpenRouter
  model list, cached; unknown means no), up to four thumbnails of the reference pictures are sent with their
  refs. Otherwise the same pictures are described in text only.

### 2. The design call

`design_canvas` returns (zod: `shared/canvas/ai_design/schema.ts`, shown through `modelSchema`, parsed with
`parseLenient`):

- `system`: name, `palette` (ink, paper, surface, primary, accent, muted as hex; drawn from the brand kit or from
  the colours of the materials), `fonts` (heading and body family), `scale` (caption, body, lead, heading, title in
  points), `grid` (margin, columns, gutter in canvas units).
- `pages[]`: purpose, up to three questions (what to retrieve), background, and `frames[]`.
- a frame: `id`, `kind` (`text`, `image`, `shape`, `art`), `role` (the slot role: `eyebrow`, `title`, `subtitle`,
  `heading`, `lead`, `body`, `quote`, `stat`, `label`, `caption`, `footer`, `image`, `panel`, `rule`, `decor`),
  geometry `x y w h` in canvas units (tenths of a millimetre; A4 is 2100 x 2970), a `style` limited to the keys
  the canvas schema supports (fill, colour, size, weight, family, align, line height, tracking, caps, radius,
  padding, border), and for text a `brief` (what the frame says), for images an `imageRef` and `subject`, for
  shapes the shape and for art `ribbons`, `glow` or `hexagons`. Array order is stacking order, back to front.

**Normalising** (always applied, reported as a reviewer note): ids become tokens and are made unique; geometry is
rounded and clamped. Text and image frames are held inside the page margins; shapes and art may bleed to the
sheet edge; a frame is never smaller than the canvas minimum; type size defaults come from the role's scale step;
`display` is always weight 700 and weights are limited to the shipped 400, 600 and 700; a page keeps at most 40
frames and four images.

**Validation** (`shared/canvas/ai_design/validate.ts`) rejects with a message the model can act on:

| Code       | Rule                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `pages`    | the page count is not the requested one; a page has no text frame                                      |
| `size`     | type below 8 pt (captions, labels and footers: 7 pt); above 120 pt                                     |
| `contrast` | text against the colour behind it (page, shapes under it, its own fill) below WCAG AA: 4.5, or 3 for large text (18 pt, or 14 pt bold) |
| `overlap`  | two text frames, two images, or text and an image or art overlap (shapes may sit behind text)          |
| `font`     | a family that is not available (`brand` without a brand font)                                          |
| `palette`  | body ink on paper below AA                                                                             |

One corrective retry sends the previous design and the full problem list. If the design is still invalid, the
pipeline **falls back**: it generates with `PortfolioPipeline` (the portfolio template, so the layout is
deterministic), adds a reviewer note on the first page ("AI design fell back to the portfolio template: ...")
and the run is recorded as a `portfolio` run, so its page actions work.

### 3 to 6. Content

- Retrieval and pictures follow the portfolio's (`searchPages`; scoring from `image_rules.ts`; the image planner's
  `place` registers source pictures). A designed page may carry at most four pictures.
- **Writing.** `write_design_page` gets the page's frames (id, role, brief, the line and character budget measured
  from the frame) and the page's chunks, and returns per frame `text` and `chunks`, plus `claims` (claim, frame,
  evidence kind) and `reviewer_notes`. Text goes through `stripInlineCitations`, `stripGapSentences` and
  `enforceBrandName`; chunk ids the application did not supply are dropped; a frame with facts needs a chunk when
  there are sources, and numbers must appear in the cited chunks (one corrective round, then reviewer notes).
- **Fit.** Every text frame is measured with `shared/canvas/portfolio/measure.ts`: exact for Inter (`sans`,
  `display`); `brand` text is measured as Inter times 1.10, a conservative estimate for Manrope. Paragraphs count
  their gap (0.6 em, as the canvas CSS sets it). Over-budget frames are named in one condense call, then trimmed
  at a sentence or word boundary with a reviewer note. A frame with no text is dropped (a title falls back to
  the page's purpose).
- **Pictures.** Image frames use `cover` when the picture's aspect is within 25 percent of the frame's, else
  `contain`, and carry the picture's alt text.

### 7. Compose, citations and sources

Sheet and frame ids are `s<n>` and `s<n>-<frame id>`; reading order is top to bottom, left to right. A frame's
`chunks` collapse to one citation node per source document (the first cited chunk represents it), so numbering is
the portfolio's: `citationNumbers` over the sheets, in reading order. A superscript style (`citeColor`,
`citeSize`) is set on every cited frame, chosen for contrast.

The sources pages are written by the application after the designed pages, in the design's own palette and
fonts: a header, the numbered documents (name, locator from `locatorOf`, what the page used it for), an evidence
table from the claims (claim, source number and locator, evidence kind), and a footer. They flow onto further
pages when there are many documents. The canvas carries a template marker, so the export adds no generic
trailing sources sheet.

**Marker, fonts and colours.** `template: { id: 'ai_design', version: 1 }`. The renderer draws such a canvas with
the pinned brand kit plus the Inter files (`brandForCanvas`); the editor loads the same fonts and numbers the
footnotes as for the portfolio. Design colours that equal a brand palette value are stored as brand references
(a brand update restyles them), the rest as hex.

### Page actions

Rewrite, add depth and shorten are **not available** on AI-designed pages: the route answers 409 "AI-designed
pages are generated again as a whole; use Generate pages." (`CanvasGenerationService.pageTarget`). The page strip
labels the pages `Page 2`, `Sources 1` and the progress steps are renamed ("Designing the pages", "Fitting the
text"). A run that fell back is stored as `portfolio`, so its page actions are the portfolio's.

## Models and configuration

`CANVAS_DESIGN_MODEL` (`start/env.ts`, `.env.example`), defaulting to `CANVAS_PLANNER_MODEL`, then
`OPENROUTER_MODEL`. The text of each page uses the writer model as the portfolio does. The design call has its own
timeout (the canvas one) and the usual retry policy of `runGeneration`.

## CLI

`node ace canvas:ai-design <documentId> [--workspace <id>] [--dry-run] [--pages n] [--no-images]`. With
`--dry-run` it runs the digest and the design step and prints the normalised design JSON (system, pages, frames,
and any validation problems) without saving anything. Without it, it generates the full canvas and saves it like
`canvas:generate`.

## Tests

| Level      | What                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit       | options coercion, design schema, clamping, overlap, contrast, size, count and font rejection, text fit and trim, compose (marker, ids, citation numbers, sources pages), capability parsing, prompt content |
| Functional | generation through the pipeline with stubbed `designCanvas` and `writeDesignPage` (saved canvas, run rows, models, fit, citations, images), the corrective retry, the fallback, a 409 page action, export renders the sheets and fonts, the multimodal capability gate, the CLI |

Postman: the mock answers `design_canvas` and `write_design_page`; the contract's `Options` gains `ai_design`.

## Known limits

- `brand` font widths are estimated, not measured; Inter text is exact.
- Page actions are scoped out (409), and a changed page is not regenerated on its own.
- The model sees thumbnails only when its model entry advertises image input.
- Overlap and contrast checks are geometric: they cannot see the content of a picture under a text frame, so text
  over a picture is rejected unless the frame has its own opaque fill.
