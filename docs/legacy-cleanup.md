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

## Kept on purpose (still needed)

The canvas path still imports these, and the non-canvas editor (CANVAS_EDITOR is a pilot flag) still runs on them.
Deleting them now would break the canvas pipeline or the default editor.

- `shared/brochure/*` (`FIGURE_PLACEHOLDER`, `PLACEHOLDER`, `STAT_SEPARATOR`, `DesignId`), used by `shared/canvas/*` and the canvas pipeline.
- `shared/layout/*`, `LayoutSelectionService`, `layout_validation`, `layout_renderer` (`fontFaces`), `collection_html` (`ribbonsSvg`), used by `canvas_service`, `canvas_renderer` and the pipeline.
- `shared/templates/outlines.ts` (`BROCHURE_TEMPLATE_ID`), used by `canvas_pipeline`.
- `LegacyTemplateService.history`, used by `DocumentsController`; `.convert` is still covered by `outline_templates.spec.ts`.
- Brochure, web and layout renderers, layout presets, collections and the layout picker: still the default (non-canvas) export and editing path.

Follow-up once the single template ships and the canvas is the only editor: move the placeholder
constants and `BrandKit` out of `shared/brochure` and `shared/layout`, then delete the brochure
and layout renderers, presets, collections and their pages and tests together.
