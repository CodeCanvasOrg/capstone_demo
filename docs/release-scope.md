# Release scope

Date: 12 November 2026 · Source: AG-01 · Status: **draft pending John + Abu acceptance** (no review date recorded yet)

This is the local release baseline. Detailed findings and source provenance are in [AG-01 research](ag-01-scope-reconciliation-research.md) and the [AG-01 plan](ag-01-scope-reconciliation-implementation-plan.md); policy choices are in the [decision register](decision-register.md).

Reading the tables: "Required" records an existing Must requirement (P-FR v2.1, 15 Oct 2026). "Extension" is a feedback-backlog item, not a new FR. "Code present" is not "tested" or "accepted"; no runtime acceptance is claimed here.

## Final export is PDF only

Decision [D-PDF-EXPORT](decision-register.md) (user, 12 Nov 2026):

- **In release:** final PDF export (FR-EXP-03).
- **Deferred:** PPTX (FR-EXP-05, historically Must; scope amendment recorded, not claimed implemented), final HTML (FR-EXP-02), summary/DOCX (FR-EXP-04), CMS publishing (FR-EXP-09).
- **Unchanged:** the existing HTML *preview* stays available and is distinct from a final HTML export. A concise PDF preset does not satisfy the summary requirement.
- Optional planning for final HTML export exists in [html-exports-research](html-exports-research.md) and [html-exports-implementation-plan](html-exports-implementation-plan.md). It is deferred by this decision, and its inherited solo-export assumption is subject to D-SOLO.

Because PPTX is out, the original "68 Must" count in P-HLD §3.23 is historical. Do not claim all original Musts are fulfilled.

## Scope matrix

| Behavior | Scope / source | Repository assessment | Issues |
| --- | --- | --- | --- |
| Structured document, validated generation, evidence | Required: FR-GEN-01/03/04/05/06/07; FR-RAG-04/05 | TipTap, generation and retrieval exist; projection, factual support and diagnostics need verification | OUT-01/02/03/05 |
| Brand/tone, consistent outputs | Required: FR-GEN-02, FR-EXP-06 | Outline files and historical brand schema exist; approved asset bundle unverified | TPL-01, TPL-04A/04B; D-BRAND |
| Downloadable PDF case study | Required: FR-EXP-01/03/06/07/08 | Renderer, queue, private artifacts and download exist; acceptance outstanding | RND-01A/01B/02/03, APR-01, QA-02 |
| Short partner PPTX | **Deferred** by D-PDF-EXPORT (FR-EXP-05) | Not implemented; none required this release | EXP-01 deferred |
| Final HTML portfolio output | **Deferred**; Want FR-EXP-02 | HTML preview only | OUT-01 records gap |
| One-page summary / DOCX | **Deferred**; Want FR-EXP-04 (PDF vs DOCX conflict, D-SUMMARY) | No exporter | AG-01; D-SUMMARY |
| Direct website/CMS publishing | **Deferred**; Want FR-EXP-09 | None | OUT-01 records gap |
| Manual edits and authorship | Required: FR-EDIT-01/02/03/04/07 | Editor/version/image paths exist; user-authored text exempt from automated evidence validation | EDT-01/03, TPL-08 |
| Section regeneration, confirmable AI edits | Required: FR-GEN-08, FR-EDIT-05/06 | Services exist; verify confirmation and stale-base behavior | EDT-02, OUT-05 |
| Owner approval, audit, edit invalidation | Required: FR-CS-01, FR-APR-01/02/03/04/05/07, FR-SEC-05 | Foundations exist; solo exception needs reconciliation | APR-01, QA-02; D-SOLO |
| Unsupported AI claims at sign-off | FR-RAG-05, FR-GEN-06; blocking/override policy open | Historical validator not on active path; Jev selected, not implemented | OUT-02/05, APR-01; D-CLAIM-MODEL, D-CLAIMS |
| Readable citations, internal reviewer notes | Related FR-RAG-03/04/06/07, FR-GEN-05/06, FR-FM-04/07/08; extensions | Hydration exists; PDF shows chunk labels | OUT-03/04, RND-02 |
| PDF layouts, page fit, fonts, image budgets | Extension; related FR-EXP-03/06/07 | Existing CSS is a base only | TPL-02/03/04A/04B/05, RND-01A/01B/02/03 |
| Portfolio wrapper, ordered collection | Extension; related FR-EXP-01/03/06 | No collection manifest/service | PRT-01 |
| Collection review and approval | Extension; basis FR-APR-02/05, FR-EXP-08 | Needs policy and persistence design | PRT-04; D-COLLECTION |
| Product/research/news types, presets | Extension | Some outlines exist; no collection contracts | TPL-06A/06B/06C/07, PRT-02/03 |
| Provider configuration and user keys | Required FR-SEC-03 baseline; BYOK is an extension | Env config only; no session BYOK resolver | OPS-02/03; D-CREDENTIALS |
| Task progress, recovery, release acceptance | Required FR-GEN-09, FR-EXP-08; FR-SEC-06 logging remains Want | Durable task services exist | OPS-01A/01B, QA-01/02/03, REL-01 |

Out of scope: URL ingestion (despite Want listing). Not promoted to Must: FR-GEN-10, FR-RAG-08, FR-CS-03, FR-APR-06.

## Remaining release gaps

Collection manifest and approval (PRT-01/04), session-bound BYOK (OPS-02), Jev claim evaluation (OUT-02/05), approved brand assets (D-BRAND), solo-versus-FR-EXP-08 reconciliation (D-SOLO), and release acceptance of actual PDFs (QA-02, REL-01). None is resolved by this document.

## Stale requirement references

In touched text only: FR-AUTH-02 (v2.1) means equal ordinary-user capabilities; FR-TEN-01/02/03 are the workspace requirements; FR-FM-01–09 is the file-management set. Old FR-AUTH-06, FR-ING-11/12 and FR-CS-05/07 references are stale and must be mapped to a verified current requirement or labeled an extension. P-LLD's "FR-AUTH-02 absent" claim is stale and not carried forward.

## Corrections for the shared source (not yet applied)

Writing to the Google Doc is a separate action. Text for maintainers: P-FR §10 / FR-EXP-05 — note PPTX deferred by D-PDF-EXPORT (12 Nov 2026); P-FR §10 vs §12 item 5 — resolve PDF/DOCX summary format (D-SUMMARY); P-HLD §3.23 — add a delta that the 68-Must count includes the deferred PPTX; P-LLD A.3 — reference D-CLAIMS, D-BRAND, D-CREDENTIALS and drop the stale FR-AUTH-02 statement.
