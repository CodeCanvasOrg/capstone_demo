# New case study with the portfolio layout

The New case study form offers the Navy and gold portfolio (`docs/portfolio-template-plan.md`)
instead of the old brochure templates.

## The form (Layout, step 3)

| Mode                | Sends                                                                                                                             | Result                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Use a template      | `templateId: brochure`, `canvas: { templateSet: 'portfolio', entries, depth, images }`, plus the old default `brochure` selection | Canvas mode, canvas pipeline        |
| Let AI choose       | `templateId: brochure`, `canvas: { templateSet: 'ai_design', entries, depth, images }`                                            | Canvas mode, the AI design pipeline |
| Plain text document | `templateId: null`                                                                                                                | Text editor, unchanged              |

"Choose each page" is gone (the portfolio has one design per page kind). "Use a template" shows the
same card as the canvas "Generate pages" dialog (`TemplateGallery`) and the same options
(`PortfolioOptions`: Entries, Depth, Include images, page-count summary); both are shared components in
`inertia/components/canvas/`. The thumbnails come from `GET /workspaces/:id/canvas-templates`, a
workspace-level twin of the document route, because the form has no document yet.

## Creation

`CreationService.document` takes `canvas`. When `templateId` is `brochure`, `canvas` is present and
canvas generation is on (`CANVAS_EDITOR=pilot` and `CANVAS_GENERATION=on`):

1. the options are validated by `canvasOptionsSchema`, with `templateSet` read apart and passed through
   as sent (so `ai_design` is stored whatever the shared schema accepts);
2. the document's layout row is created with `editorMode: 'canvas'` and `options.canvas` set to them
   (no `brochure` pages);
3. the first generation is requested with those options, so it is a canvas run
   (`payload.target = 'canvas'`, a `canvas_generation_runs` row);
4. the controller redirects to the canvas page.

The canvas page shows the run (`FirstGeneration`: stepper, "Writing your portfolio") while the case
study has no pages, and opens the editor when the run is ready. A failed run links to the case study page, which has Retry.

With canvas generation off the `canvas` field is ignored and the old behaviour applies: "Use a template"
pins the default brochure template, "Let AI choose" lets the model choose the brochure pages, and the
redirect is to the case study page. The form tells the user so under the options.

Options the portfolio does not offer (6+ entries, an unknown depth) answer 422 and create nothing.

## Tests

- `tests/functional/case_study_portfolio.spec.ts`: both modes, the flag off, plain text, invalid options, the workspace templates route.
- `tests/browser/case_study_create.spec.ts`: the form, the run on the canvas, the generated pages.
