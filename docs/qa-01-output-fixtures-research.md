# QA-01 — Output fixture and baseline research

12 November 2026 · P0 · 2 points · Davron + Abu · Dependencies: none; refine with OUT-01

**Status: inspected and proposed; fixture runner, sanitized reference set and claim review are not implemented by this document.** Recommendation: freeze six file-backed cases and a claim-review CSV, then replay the current renderer in a declared environment. No product screen, migration or model call is needed to establish repeatable rendering inputs.

## Sources and current state

[Capstone Project | CodeCanvas](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4/edit) was retrieved on 12 November; provider modified time `2026-11-12T06:30:11.830Z`. QA-01 and P-LLD §3.8.3 / Appendix A.2 were read directly. They require declared workloads, separate stage/queue timing, usage across attempts, S/C/U AI-claim labels and separate manual text. `(C+U)/(S+C+U)` is undefined when no AI claims have been reviewed.

The shared backlog references F-PDF, `Portfolio-Generator-Feedback.pdf` (7 November), §§01, 03–04, 09. A connected search returned the shared project document, not the original standalone PDF. The source-specific section attribution below follows the backlog; do not claim that original feedback was independently reread. Obtaining it for final review remains an acceptance check.

Checkout examined: `2ce1e0d`. Read the current code rather than treating the earlier [OUT-01 audit](out-01-generation-export-audit.md) as a current feature inventory:

| Evidence | Finding |
| --- | --- |
| `app/services/documents/publication_projection_service.ts:3` | Projection version `out-01-pilot-1`; per-chunk reference numbering, metadata stripping and nonmutating projection now exist. |
| `app/services/exports/pdf_service.ts:87` | Current HTML/PDF adapter accepts explicit `publication` and `preview` options. Legacy and pilot outputs must be measured separately. |
| `app/services/exports/document_export_service.ts:21` | Application selects the pilot with `PUBLICATION_LAYOUT=pilot`; it is off otherwise. Record the effective branch, not merely the environment variable. |
| `tests/unit/services/publication_projection_service.spec.ts:29` | Three tests cover numbering, metadata/body preservation and pilot HTML. They do not measure real PDF pagination. |
| `tests/unit/services/pdf_service.spec.ts:1` | PDF generation unit test mocks Chromium; it cannot supply PDF/font/page evidence. |
| `docs/audits/out-01/before.trace.json` | Entry 01 has pinned file/revision/run, 25 citation nodes, one image and 10 distinct evidence IDs. Model usage and detailed generation stages were not recorded. |
| `docs/audits/out-01/before.historical.pdf` | Prior measured entry sample: 4 pages / 594,766 bytes; historical preview, not a newly approved output or the current pilot baseline. |
| `output/humblebee-portfolio/metric-review-tracker.csv` | Useful source/page/context notes, including estimated processing reductions and capacity targets. Not a frozen S/C/U gold sheet or proof of true authorship. |
| `tests/fixtures/template_content.ts` | Fictional canonical/template fixture; useful pattern, but active output tests must also cover saved TipTap bodies. |
| `app/services/documents/claim_evaluation_service.ts:4` | Evaluator uses `insufficient_evidence`; fixture gold label `unsupported` needs explicit comparison mapping. Transport failures are separate evaluation states. |
| `database/migrations/1792984351178_create_template_generations_table.ts:14` | Stage/telemetry and claim-review/report tables exist. QA experiment results should not be written into production approval/claim records. |

Installed package manifests: Adonis core 7.5.2, TipTap core/HTML 3.31.4, Playwright 1.63.0, Japa runner 5.3.0, Zod 4.6.5. Ace `make:command`, `make:service` and `make:test` options were checked with local `--help`; no generator was run. No dependency addition is proposed.

## Gaps to address

1. **D1 — mutable/internal captures:** OUT-01 contains real IDs, evidence and assets. It is an internal audit sample, not sanitized CI input. Freeze internal provenance separately from fictional public test cases.
2. **D2 — missing experiment identity:** layout flag, source hashes, renderer/projection version, installed browser/fonts and effective generation settings are not recorded together. Historical model identity must stay unknown where unrecorded.
3. **D3 — incomplete measurements:** historical timing is task elapsed across retries, not inference or rendering latency. Chromium was unavailable in OUT-01; no current pilot PDF baseline is established by that audit.
4. **D4 — incomplete gold labels/authorship:** citation presence and old tracker notes do not establish S/C/U labels. Manual text must be excluded from automated factual scoring; unknown authorship cannot be silently classified as AI.
5. **D5 — incomplete case coverage:** no versioned six-case output corpus or independent second-reviewer reproduction was found.

## Options and recommendation

| Option | Assessment |
| --- | --- |
| Re-run the live LLM for every comparison | Reject as default: changes input content, adds cost and confounds rendering regressions with stochastic generation. Keep as a separate explicitly enabled experiment. |
| Add QA database tables and a dashboard | Defer: duplicates durable artifact history for this two-point story and expands authorization/UI scope. |
| Freeze file manifests, source excerpts, TipTap bodies and synthetic assets | Adopt: easy to review/version, works offline, exercises existing render/projection code and preserves working records. |
| Commit the real entry capture unchanged as CI data | Reject: includes internal provenance and assets; simple UUID replacement is insufficient sanitization. |

The baseline must identify observed defects without making existing defects the desired product contract. A known legacy citation leak is an observation; it is not a golden assertion that future pilot output must retain it. Actual PDF byte hashes identify artifacts; equal hashes are not required across runs because PDF metadata can vary.

## Boundaries and questions

No new application routes, browser components or database columns are necessary. Reuse the current preview/evidence/workflow UI for authorized manual checks and existing functional tests for workflow/access. QA-01 does not implement model-quality improvement, approval policy, overflow enforcement or durable production telemetry; those remain OUT-05, APR-01, RND-02 and OPS-01A.

Davron and Abu must agree on gold labels, verify asset rights/sanitization and identify a reproducible Chromium-capable reference environment. Live model evaluation is optional and separately recorded. PDF-only release scope remains accepted; historical 173-page collection metrics stay reported feedback until that exact collection is independently remeasured.

See [implementation plan](qa-01-output-fixtures-implementation-plan.md) for fixture identities, file schema, CLI, UI disposition, test matrix and acceptance steps.
