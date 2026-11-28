# Navy / Gold portfolio template

One template, three A4 pages: `cover`, `entry`, `sources`. The neutral sample is a service-design portfolio. Sample documents and outcomes are illustrative.

**Rendering limitation:** `template.pdf` is an Inter-based PyMuPDF geometry proof, not a Chromium print. Playwright Chromium was attempted, but the execution sandbox rejected a startup system call (`sandbox_host_linux.cc:41`, `shutdown: Operation not permitted`). The required Chromium verification is therefore outstanding. `render.mjs` contains the requested Playwright export with `printBackground: true` and `preferCSSPageSize: true`; run it in an environment that permits Chromium. It replaces the proof PDF and regenerates `tokens.json` from actual HTML DOM boxes.

## Files and rebuilding

- `template.html`: self-contained HTML, embedded local Inter variable WOFF2 and inline SVG; no network requests. Three `section.page` elements, each exactly 210 × 297 mm, with zero print margins.
- `template.pdf`: current three-page geometry proof.
- `tokens.json`: colours, type, spacing, geometry and 78 named slot boxes in points. Current boxes describe the fallback proof; a successful `render.mjs` run replaces them with Chromium DOM measurements.
- `preview/page-1.png` through `page-3.png`: final 150 dpi PDF rasters.
- `preview/compare-pass-{1,2,3}.png`, `compare-final.png`: reference cover, sample cover, reference entry, sample entry, left to right.
- `preview/reference-contact.png`: inspected style references, pages 2–5 and 7–12, in order.
- `build.py`: regenerates HTML using the offline font in this repo's `node_modules/@fontsource-variable/inter/`.
- `render.mjs`: preferred HTML → Chromium PDF and slot geometry export.
- `fallback.py`, `Inter-*.ttf`: alternate vector proof renderer and static instances of the same local Inter font. Requires PyMuPDF. `FONT-LICENSE.txt` applies to all embedded and supplied font files.

From the repository root:

```sh
python3 docs/design/portfolio-template/build.py
node docs/design/portfolio-template/render.mjs
pdftoppm -r 150 -png docs/design/portfolio-template/template.pdf docs/design/portfolio-template/preview/page
pdfinfo docs/design/portfolio-template/template.pdf
```

For the fallback proof, use `python3 docs/design/portfolio-template/fallback.py` with PyMuPDF installed. It parses slot content from the HTML and draws the measured page geometry; it does not interpret browser CSS.

## Page and slot specification

Every placeholder text element has a `data-slot`; nested citation elements have independent slots. Dotted names are stable data paths, not CSS selectors. `data-max-lines` records the layout budget. The figure is a non-text slot, with `max_lines: 0`.

| Page | Slots | Layout |
| --- | --- | --- |
| Cover | `cover.eyebrow`, `cover.title`, `cover.subtitle`; `cover.meta.{1..3}.{label,value,secondary}` | Navy to y=666 pt; hexagons share centre x=467.443, y=156.193 pt. Text left x=56.68 pt. Metadata starts y=738.2 pt in the paper band. |
| Entry | `entry.section_number`, `entry.section_label`, `entry.title`, `entry.intro`, `entry.figure`; `entry.rows.{1..8}.{label,body}`; `entry.rows.{1,2,5,6,7,8}.citation`; `entry.doc_title`, `entry.page_counter` | Header x=51 pt, tag y=57 pt, rule y=114 pt. Body y=207 pt, figure 221.25 × 309.75 pt; 12 pt gap; right column 260.25 pt. Footer y=819 pt. |
| Sources | `sources.section_number`, `sources.section_label`, `sources.title`, `sources.intro`; `sources.references.{1..4}.{number,document,locator,note}`; `sources.evidence.title`, `sources.evidence.headers.{1..3}`, `sources.evidence.rows.{1..3}.{1..3}`; `sources.note.{title,body}`; `sources.doc_title`, `sources.page_counter` | Same entry header and footer; full-width reference list, compact evidence table, paper callout with gold edge. |

## Content rules

- Preserve the A4 artboard; no automatic type shrinking or silent clipping. Reject over-budget content for editing before export. Suggested character limits are approximate; measured line counts take precedence.
- Cover: eyebrow one line (~30 characters); title exactly three composed lines (~15–20 characters each); subtitle at most three lines (~160 characters). Meta labels one line (~16 characters), values at most two (~40), secondary at most two (~40). The sample uses explicit line breaks to match the reference rhythm.
- Entry: section number two digits; section label one line (~25 characters); heading one line (~40 characters); intro at most four lines (~300 characters). Keep the body anchored at 207 pt if the intro is shorter.
- Entry row labels one line (~24 characters). At eight rows, body line budgets in order are **2, 2, 3, 1, 2, 2, 1, 2**. Corresponding row heights are **52.5, 51.75, 66, 39, 52.5, 51.75, 39.75, 52.5 pt**, ending at 612 pt. Font is 8.8 pt / 13.2 pt. Gold superscript citations must also fit within the column.
- Support 3–8 rows. Remove an empty row and its separator entirely, then compact subsequent rows upward. Never print placeholder labels. The supplied static HTML shows all eight rows; conditional removal and content validation belong to the application mapping.
- Replace `entry.figure` with an image or composed grid using contain-fit inside the measured frame. The sample SVG represents four project documents; it contains no copied reference content. Preserve aspect ratio.
- Sources: number the references to match the entry's superscripts. Each document, locator and note occupies one line in the sample (roughly 55, 70 and 90 characters). This design shows four references; allow 1–4 within this page. For more sources, create a continuation page with the same header and footer.
- Evidence table is optional. Remove the entire table section when absent. Column headers are one line; cells should remain one line at the supplied widths. Source numbers in table locator cells are ordinary numerals to avoid missing superscript glyphs.
- Callout heading one line; note up to three lines (~220 characters). Footer title one line (~90 characters); counter is supplied as a single `n / N` text slot. Count all document pages, including the cover.
- Green describes supported findings or outcomes; red marks an explicit constraint. Gold carries navigation, citation marks and locator metadata. Do not imply a planned result is measured.

## Fidelity and verification

Measured with `pdffonts`, `pdftotext -bbox`, PyMuPDF vector inspection and Python/PIL pixel sampling of the supplied 150 dpi PNGs. The reference uses Inter SemiBold, Inter Regular/Bold and Inter Display Bold. The template uses the local Inter variable family at optical size 14 for text and 32 for display, with weights 400/600/700.

| Reference treatment | Template treatment | Reason / fidelity |
| --- | --- | --- |
| Page 1 navy, paper and nested hexagons | Exact sampled base fills `#14213D`, `#F6F4EE`; vector hexagon coordinates and sampled composite gold colours | Preserves position, opacity appearance and proportions. Accent text/rules `#F2A900`; hex colours `#BE890E`, `#81641E`, `#594B29`, `#C88F0B`. |
| Page 1 title and metadata | Same three-line title size and line rhythm; neutral sample copy | Letter shapes and line lengths differ with the requested new content. Display tracking and top position were visually tuned. |
| Page 6 header, figure and row separators | Measured header anchors, figure frame, columns and eight row heights | New sample copy, colours used semantically; diagrammatic thumbnails replace the original documents and illustration. |
| Reference PDF 594.95996 × 841.91998 pt | Exact ISO A4, 595.27559 × 841.88976 pt | Required 210 × 297 mm differs by +0.316 pt width and −0.030 pt height. Main measured anchors retained. |
| Original embedded Type 3 font subsets | Local variable Inter instantiated and embedded as TrueType in proof | Same family, different font build/rasterisation; not a pixel-identical font reproduction. |
| Chromium print required | Chromium script supplied; fallback proof delivered | Sandbox startup failure prevents claiming HTML/PDF parity or completed browser verification. |

Three compare-and-fix passes were completed on the fallback PDF:

1. Compared cover and entry side by side; moved the cover title up 2 pt and locked row heights to the reference separators.
2. Compared again; shortened the evidence row to its line budget, replaced an unavailable superscript table glyph and increased sources callout spacing.
3. Compared again; restored red constraint emphasis in the proof and set individual row max-line budgets. Final rasters were inspected after those changes.

`pdfinfo` confirms **3 pages, 595.276 × 841.89 pt (A4)**. The HTML is self-contained; browser overflow and exact browser slot coordinates must still be verified after a successful Chromium render.
