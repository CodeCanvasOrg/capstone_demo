# Portfolio brochure redesign: plan

## Why

The latest meeting asked for a portfolio that reads like Accenture's product pages and the ALIP overview
brochure, not like a stack of case-study PDFs with a plain cover. The same request asked for control
at three levels: **rules decide by default**, **the user can override anything**, and **the model
can decide when asked**.

What the references do that we do not:

| Reference | Pattern | Our gap |
| --- | --- | --- |
| ALIP brochure p.1 | Full-bleed dark cover, one generated light-ribbon graphic, large title | Cover is a white page with a yellow rule |
| ALIP p.2 | Colour panel with a large statement beside three huge single numbers | No page for headline numbers |
| ALIP p.3-4 | Mixed page types: narrative, at-a-glance grid, recognition grid | Every page after the cover is a case study |
| ALIP p.7 | Section openers and a closing contact page | Closing page is a bare dark block |
| accenture.com/en/products | Card grid; each card has a category label, a name, a short line, a link | Contents is a plain list |

## Design decisions

1. **One data shape for all three control levels.** A portfolio gets a `design`: an ordered list of
   typed pages. A preset, the page-by-page editor and the model all produce the same list. Rendering
   never calls a model.
2. **The model only picks from a closed catalog.** It returns page kinds, variants and entry order.
   Code fills every word on the page (section titles from categories, numbers from the entries'
   own results, statement from the introduction the reviewer wrote). The result goes through the
   same validator as a hand-built design, and any failure falls back to the rules.
3. **A model suggestion is a proposal.** `POST /collections/:id/arrange` saves nothing. The user
   applies it, edits it or discards it. Once applied it is stored in the manifest, so the approval
   hash covers it like any other change.
4. **Old collections keep their meaning.** A manifest with no `design` is read as the `classic`
   preset: cover, introduction, contents, entries, back cover, with identical page arithmetic.
5. **Entries keep their own look.** A collection orders and frames entries, but never changes an
   entry's layout. An entry's output is covered by that entry's own approval, so its look is
   chosen on the document (new "Look" option: classic or brochure).
6. **Numbers are never invented.** Highlight figures come from entry results, carry their
   qualifier (measured, estimated, client reported) and stay pinned in the manifest. A reviewer can
   also type their own, which is treated like the introduction text: reviewer-supplied copy.

## Page catalog

| Kind | Variants | Rule |
| --- | --- | --- |
| cover | ribbons, panel, plain | first, at most one |
| statement | panel, plain | needs introduction text |
| highlights | numbers, band | 1 to 4 figures |
| section | bold, plain | title required |
| contents | cards, list | at most one |
| entry | none | every pinned entry exactly once |
| contact | dark, light | last, at most one |

## Presets (the rules)

| Preset | Pages |
| --- | --- |
| Brochure | cover (ribbons), statement, highlights, contents (cards), a section opener per category when there are two or more, entries, contact |
| Showcase | cover (panel), statement, contents (cards), entries, contact |
| Compact | cover (plain), entries, contact (for tight page budgets) |
| Classic | cover, statement, contents (list), entries grouped by category, contact. This is what a manifest without a design means |

## Build steps

1. `shared/layout/portfolio.ts`: types, catalog, presets, `rulesDesign`, `parseDesign`,
   `validateDesign`, `reconcileDesign`, `planPages`. Unit tested.
2. `shared/layout/collection.ts`: `design` on the manifest, `stats` on an entry, contents and
   budget computed from the page plan. Legacy numbers unchanged.
3. Layout option `look` (classic or brochure) and the brochure entry styling.
4. `collection_html.ts`: one renderer per page kind in the brochure language; the exporter walks the
   page plan.
5. `PortfolioArrangerService` plus `POST /collections/:id/arrange`; create and update accept
   `preset` and `design`.
6. Collections page rebuilt as a portfolio builder: start from a template, build page by page, or
   let AI arrange. A live page strip shows every page with its real page number.
7. Tests, then a rendered PDF checked by eye.

## Motion (UI only)

The builder is used a few times per portfolio, so it gets short, purposeful motion and nothing on
repeated actions.

| Moment | Purpose | Motion |
| --- | --- | --- |
| Page strip when a collection opens or its design changes | Show the page sequence exists | 40ms stagger capped at six steps, 220ms, ease-out |
| Page added in the editor | Prevent a jarring change | opacity and 8px translate, 180ms, ease-out. Removal is instant |
| Page selected | Feedback | 2px outline, 120ms |
| Press on any button or card | Feedback | `scale(.98)`, 120ms |
| Arrangement proposal arrives | State indication | opacity, 200ms |

Reduced motion keeps opacity and drops movement. Hover effects are gated to fine pointers.

## Out of scope for this pass

- Changing an entry's block order page by page inside a case study.
- Image assets on portfolio pages. The cover graphic is generated from the portfolio name.
- Restyling the rest of the app shell. (Done in a second pass, below.)

## Status

Built and verified.

- Unit, functional and browser suites pass, including the existing collection flow. The two
  `claim_review` failures predate this work (a working-tree edit removed an import).
- Rendered with the native Chromium and PyMuPDF pipeline and checked by eye: ribbon, panel and
  plain covers; introduction; key numbers; section opener; card and list contents; contact; and
  the brochure look on entries.
- The classic look's HTML is unchanged, so existing entry approvals stay valid. Only a document
  that switches to the brochure look gets a new approval bundle.

Known limits:

- Page numbers in the strip use each entry's maximum length until the exporter measures it, so
  the strip says "up to N pages". The PDF itself uses measured counts.
- A collection made before designs existed is read as Classic until a template or design is chosen.
- A custom or AI design keeps its own case study order. The up and down arrows on the case study
  list are hidden for it; reordering happens in the page editor.

## App restyle (second pass)

The whole app now speaks the same language as the brochure output.

| Change | Where |
| --- | --- |
| Cool navy and white palette in light and dark, yellow as the one accent, cool shadows | `inertia/css/app.css` tokens |
| Navigation shell is dark navy with a yellow active marker. It uses a scoped palette on `[data-sidebar=sidebar]`, because `bg-sidebar` is used as the white panel surface in about 30 places | `app.css`, `layouts/default.tsx` |
| Grey canvas so white panels stand out | `layouts/default.tsx` |
| Heavier, tighter page titles (`.page-title`) and a short yellow bar above each (`.page-bar`) | `PageIntro`, every page header |
| Small labels are sentence case, not tracked all caps | `.eyebrow`, auth aside |
| Home: navy hero with generated ribbons, replacing the yellow gradient card | `pages/workspaces/home.tsx` |
| Sign-in: navy aside with ribbons above the headline | `layouts/auth.tsx` |
| One shared ribbons generator for the app, thumbnails and (as a port) the PDF cover | `components/ribbons.tsx` |

Motion: the ribbons reveal once on load (opacity and a 2% scale, 700ms, ease-out) and fade only
under reduced motion. Nothing else moves on its own.

Not restyled: the editor's page-view canvas (it mirrors the PDF and has its own styles), the bee
mascot, and the guided tour.
