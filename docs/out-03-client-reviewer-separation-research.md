# OUT-03 — Separate client copy from reviewer diagnostics: research

Inspected 2026-11-12 at `68f7894`. P0, 2 points; John; dependency OUT-02.

**Status: research and implementation design only. No application changes applied.** The companion [implementation plan](out-03-client-reviewer-separation-implementation-plan.md) specifies the work and acceptance checks.

## Problem and dependency boundary

The client publication must contain supported editorial content and its material qualifications without including the machinery used to review it. Reviewer and client views must derive from the same saved content identity. Removing fields from JSON is necessary, but does not remove internal commentary already embedded in prose, marks, captions or source labels.

OUT-02 is the declared dependency, not a request to redesign the content model. Its [contract plan](out-02-publication-content-implementation-plan.md) places semantic annotations and reviewer notes in the authoritative TipTap version. In this checkout that document is explicitly proposed; `shared/publication/content.ts` and its proposed content service are absent. Before coding, reconcile the actual OUT-02 branch/API with this plan. Do not create an incompatible second publication schema to compensate. The existing OUT-01 projection is implemented and remains the compatibility entry point.

## Current repository map

| Component | Actual behavior | OUT-03 status |
| --- | --- | --- |
| [PublicationProjectionService](../app/services/documents/publication_projection_service.ts) | `out-01-pilot-1`; builds title, summary, body and numbered source labels. Drops citation chunk text, IDs and evidence URLs; does not mutate the source. | Partial |
| Projection walker | Allows selected node attributes but copies arbitrary node types, text and marks. Image `src`, alt/title and citation filenames are not a complete publication policy. | Partial |
| [ExportPdfService](../app/services/exports/pdf_service.ts:87) | Pilot uses the projection; default layout renders full TipTap content. Input is typed as `DocumentVersion` although callers supply a content-only cast. | Partial; default route bypasses client boundary |
| [DocumentExportService](../app/services/exports/document_export_service.ts:71) | Version/snapshot checks, private image embedding, task lease checks, private artifact storage. Preview and worker render share PDF service. `PUBLICATION_LAYOUT=pilot` selects presentation. | Implemented orchestration; projection enforcement missing |
| [Company guides](../resources/document_templates/technical.md) | Forbid invention and preserve qualifiers, but also instruct generation to state missing information in the output. | Partial; can encourage diagnostic prose |
| [ClaimReviewService](../app/services/documents/claim_review_service.ts) | Evaluates generated claims, records non-blocking version-associated AI issues with fingerprints. Does not approve or repair prose. | Implemented factual-review infrastructure; diagnostic lint missing |
| [IssueService](../app/services/documents/issue_service.ts) | Scoped human issues, rich descriptions, revision conflicts, explicit blocking issues invalidate workflow approval. | Implemented; reuse without conflating human and automatic issues |
| [Issue transformer](../app/transformers/document_issue_transformer.ts), [IssuesPanel](../inertia/components/documents/inspector.tsx:239) | Existing internal issue UI; transformer omits version, origin, code and anchor fields. | Partial for actionable lint diagnostics |
| [QA baseline service](../app/services/qa/output_baseline_service.ts), [command](../commands/qa_output_baseline.ts) | Frozen sanitized corpus, HTML/PDF reports, injected renderer/inspector, unavailable measurements explicit. | Implemented harness; OUT-03 fixtures missing |

Routes remain workspace scoped: `GET /workspaces/:workspaceId/documents/:documentId/preview`, `/preview/pdf`, `POST .../exports/pdf`, `GET .../exports/:taskId/download`, and existing `GET/POST/PATCH` issue routes. The historical version-preview route redirects to current preview; it does not prove historical version rendering. No public JSON publication endpoint currently exists or is required here. Final delivery remains PDF; HTML is internal preview.

## Defects and evidence

**D1 — layout-dependent privacy.** Pilot projection is optional. Legacy `generateHTML(version.content, extensions)` bypasses it. Both layouts need the same safe content boundary before presentation is selected.

**D2 — incomplete recursive allowlist.** `next.marks = node.marks` passes through mark attributes. Unknown node types survive. Trusted source display labels, links and registered image bytes require their own policy; stripping a few citation attributes does not establish that policy.

**D3 — prose has no diagnostic lint.** The projection preserves text verbatim, including “TODO”, “missing evidence”, retrieval traces or internal paths if authored in a publication field. A broad word-deletion filter would corrupt legitimate copy, quotations and material qualifications.

**D4 — missing-fact instructions mix audiences.** “State when information is missing” can cause internal gaps to be printed as client narrative. Omission of an optional result/image is valid; silently inventing a result is not. A limitation that changes the meaning of a claim remains client content.

**D5 — existing tests are narrower than the story.** Current projection tests cover numbered references, citation-metadata stripping and pilot HTML. The PDF unit test substitutes a browser and returns arbitrary mock bytes. QA baseline tests exercise a fake renderer/inspector. None establishes leakage-free extracted text from a newly rendered PDF.

## Options and recommendation

| Option | Decision and reason |
| --- | --- |
| Prompt changes only | Rejected: existing and manually edited records still reach rendering. |
| Delete suspicious words across the output | Rejected: destroys meaning and can hide evidence problems. |
| Separate editable client body | Rejected: introduces competing content and stale approval identity. |
| Explicit client DTO plus internal diagnostics | Adopted: deterministic projection, inspectable payload, shared identity; lint findings remain internal and trigger repair. |

The client DTO should use strict node/mark/attribute schemas, with typed material qualifiers and numbered public references. Keep version IDs, content hashes, evidence IDs, notes, issue messages and asset storage locations in a private render envelope. Presentation receives only its client DTO. Both layouts consume it. Authorization and evidence/asset resolution stay before projection in services; templates never query data or receive task/candidate records.

Diagnostic lint is a deterministic editorial check, not a new factual evaluator. Detect phrases and identifier/path patterns at exact field/range locations and report them for review. An estimated value is not automatically unsupported; a provider outage is not a factual verdict. User-authored text is neither silently exempt from publication hygiene nor silently rewritten; preserve its authorship and require an explicit edit when a real leak exists.

## Schema and compatibility facts

Installed packages read from `node_modules`: Adonis core **7.5.2**, Lucid **22.4.2**, TipTap core **3.31.4**, React **19.3.0**, Playwright **1.63.0**, pdf-parse **2.4.5**, Zod **4.6.5**. These are installed versions, not `package.json` ranges. No framework/package replacement is needed.

Existing migrations create `document_issues` with workspace/document scope and optimistic revision; later additions provide `version_id`, `validation_report_id`, `origin`, `code`, `section_key`, `block_id`, `claim_hash`, `issue_fingerprint`. `document_validation_reports` already has phase, validator version, input/report hashes, JSON issues/summary and append-only enforcement. There is no unique issue-fingerprint constraint. Generated schema presence does not establish a runtime integration; inspect live migration status on the implementation branch before using the fields. No DDL or rewrite of accepted content is proposed.

## Source boundaries and decisions

Requirements checked against the previously fetched shared [project source](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4/edit): FR-GEN-05 requires structural validation, FR-GEN-06 evidence verification, FR-RAG-05 unsupported-statement flags. This is a cached source snapshot, not a newly fetched revision. F-PDF §§01, 03, 07 are acceptance references supplied by the backlog; the original feedback PDF was not independently re-inspected here. The existing [OUT-01 audit](out-01-generation-export-audit.md) and [QA-01 plan](qa-01-output-fixtures-implementation-plan.md) supply repository baseline context, not new PDF proof.

Recommended decisions requiring product confirmation during implementation:

1. **Suspect prose:** warn internally, require classification/repair for confirmed leaks; hard-fail publication for raw private identifiers/paths or malformed DTOs. Do not add a blanket new factual-approval gate under this story.
2. **Source naming:** use safe human display titles/page numbers. If only an internal storage path exists, render a neutral `Source N` label and report the missing display title internally.
3. **Historical downloads:** preserve existing artifacts and accepted versions. Previously produced PDFs are not retroactively sanitized by a new renderer; decide separately whether affected artifacts must be withdrawn/re-exported.

## Verification performed

`node ace test unit --files='tests/unit/services/publication_projection_service.spec.ts' --files='tests/unit/services/pdf_service.spec.ts' --files='tests/unit/services/output_baseline_service.spec.ts'` — **14 passed**. This verifies the existing baseline only. No provider run, browser UI acceptance, live schema inspection, native PDF generation or OUT-03 feature acceptance was performed in this planning turn.
