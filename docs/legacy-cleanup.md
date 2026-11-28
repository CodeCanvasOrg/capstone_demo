# Legacy cleanup

Scope: code that the canvas editor and pipeline superseded, verified by grep for callers
(routes, commands, jobs, pages, tests) before deletion.

## Removed

| File | Why |
|---|---|
| `commands/convert_template_documents.ts` | One-off migration command for old template documents. No callers, not in any job or doc flow. |
| `commands/recover_document_prose.ts` | One-off data recovery command. No callers. |
| `commands/map_publication_document.ts` | One-off migration to publication metadata v1. No callers. |
| `app/controllers/document_shares_controller.ts` | Sharing is replaced by workspace membership. Controller had no route (the `/shares` routes use `LegacyResources.retired`). |
| `app/policies/document_share_policy.ts` | Only used by the removed share flow. |
| `inertia/pages/document_shares/index.tsx`, `inertia/components/document_shares/share_row.tsx` | Page for the unrouted share controller. |

No tables were dropped: `document_shares` is still read by the workspace migration service and
its tests, so its model and table stay.

### Academic canvas pipeline (after the one portfolio template)

The portfolio template replaced the academic designs; the academic code was unreachable from the options,
the routes and the UI. Removed with their tests (`feature/remove-academic-canvas`):

| File | Why |
|---|---|
| `shared/canvas/academic/{compose,content,designs,sample}.ts` | The twelve academic page designs, their content schema, composer and sample pages. Nothing portfolio-related imported them after the pieces below moved. |
| `app/services/canvas/generation/canvas_planner.ts`, `canvas_page_writer.ts`, `canvas_prompts.ts` (with `TEMPLATE_DESIGNS`), `canvas_image_planner.ts`, `canvas_page_sheet.ts`, `copy_clean.ts` | The academic planner, per-page writer, prompts, image planner, sheet helpers and copy cleaning. The portfolio has its own under `app/services/canvas/portfolio/`. |
| `OpenRouterService.planCanvas`, `.writeCanvasPage` | Only the academic planner and writer called them; the portfolio uses `planPortfolio`, `writePortfolioEntry` and `writePortfolioCover`. |
| `OpenRouterService.captionCanvasImage` | Only the academic image planner called it; the portfolio image planner writes alt text without a model call. |
| `CanvasPipeline` academic and brochure branches (`generateBrochure`, academic `generate`/`regenerate`, `LABELS`, `PIPELINE_VERSION`, `mapLimit`, `referencesOf`) | `templateSet` always parses to `portfolio`, so only the portfolio branch was reachable. `CanvasPipeline` now dispatches to `PortfolioPipeline` and keeps the run, recorder and save plumbing. |
| Tests: `canvas_academic_compose`, `canvas_academic_content`, `canvas_page_writer`, `canvas_planner`, `canvas_prompts` (unit), `canvas_render_fit` (functional), the academic snapshot and prompt fixtures, `tests/fixtures/canvas/academic.ts`, `tests/helpers/canvas_generation.ts` | Cover only the removed code. The Chromium fit check is now `portfolio:template:check`. |

Moved, not deleted, because the portfolio still uses them:

- `shared/canvas/academic/options.ts` to `shared/canvas/options.ts` (`canvasOptionsSchema`, `Depth`, `TemplateSet`), plus `DEPTH_TOKENS` from `designs.ts`.
- `modelSchema` and `parseLenient` from `academic/content.ts` to `shared/canvas/model_output.ts`.
- `sourcesText` to `portfolio_prompts.ts`; `overlap` into `portfolio_image_planner.ts`; `page_queries.ts` keeps only `anchor`, `PageQuery` and `fuse` (the page-query builders were academic).
- `generatable`, `flagsOff` and `EVIDENCE` test helpers into `tests/helpers/portfolio_generation.ts`.
- `canvas_density.spec.ts` now builds its sheets from the generic `minimal()` fixture instead of the academic composer.

Legacy fallbacks kept on purpose: the stored `templateSet` values `academic_report`, `research_brief` and `brochure`
still parse and coerce to `portfolio` (`shared/canvas/options.ts`); page actions on a run made with a retired
template answer 409 (`CanvasGenerationService.pageTarget`); old saved canvases still open, derive and export
(`shared/canvas/{compose,derive,density}.ts`, `canvas_renderer`), and `canvas:density` still measures them. No tables,
columns or migrations changed (`canvas_generation_runs.profile` keeps `academic`; `canvas_templates.category` keeps `academic`).

## Kept on purpose (still needed)

The canvas path still imports these, and the non-canvas editor (CANVAS_EDITOR is a pilot flag) still runs on them.
Deleting them now would break the canvas pipeline or the default editor.

- `shared/brochure/*` (`FIGURE_PLACEHOLDER`, `PLACEHOLDER`, `STAT_SEPARATOR`, `DesignId`), used by `shared/canvas/*` and the canvas pipeline.
- `shared/layout/*`, `LayoutSelectionService`, `layout_validation`, `layout_renderer` (`fontFaces`), `collection_html` (`ribbonsSvg`), used by `canvas_service`, `canvas_renderer` and the pipeline.
- `shared/templates/outlines.ts` (`BROCHURE_TEMPLATE_ID`), used by `creation_service` and `outline_template_service`.
- `LegacyTemplateService.history`, used by `DocumentsController`; `.convert` is still covered by `outline_templates.spec.ts`.
- Brochure, web and layout renderers, layout presets, collections and the layout picker: still the default (non-canvas) export and editing path.

Follow-up once the single template ships and the canvas is the only editor: move the placeholder
constants and `BrandKit` out of `shared/brochure` and `shared/layout`, then delete the brochure
and layout renderers, presets, collections and their pages and tests together.
