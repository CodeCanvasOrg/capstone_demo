# AG-01 — Scope reconciliation research

Date: 12 November 2026. Repository audit began at `040d2dd`; HEAD advanced during review to `fadae67`, adding only the pre-existing schema change and HTML planning documents. Audited application paths were unchanged. Read-only audit; no application behavior, migrations or remote documents changed.

## Current scope amendment — 12 November 2026

After reviewing the plan, the user confirmed that final export must be **PDF only** and the rest of the plan is good. D-PDF-EXPORT in the implementation plan records this accepted change and supersedes the earlier PDF-plus-PPTX release baseline. PPTX and final HTML/DOCX/CMS outputs are deferred; internal HTML preview remains distinct. The audit below preserves what the original sources said. Their FR-EXP-05 requirement is not silently rewritten or claimed complete, and a focused formal/backlog correction remains necessary.

## Finding

AG-01 is not yet satisfied. Its deliverable is one reconciled release scope and a decision register, rather than implementation of every feature in that scope. Existing code can support much of the required workflow, but code alone cannot settle stakeholder policy or establish team acceptance.

The [implementation plan](ag-01-scope-reconciliation-implementation-plan.md) contains the proposed scope matrix, decision-register seed, concrete documentation changes and acceptance checks.

## Sources and precedence

The connected Google Drive document [Capstone Project | CodeCanvas](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4/edit) was retrieved on 12 November 2026; provider modification time was `2026-11-12T05:07:56.376Z`. Its text contains historical versions. This review used:

- **P-FR:** Functional Requirements v2.1, revision 15 October 2026, §§5, 8–12. PDF FR-EXP-03 and PPTX FR-EXP-05 are Must. HTML FR-EXP-02, summary FR-EXP-04 and CMS FR-EXP-09 are Want.
- **P-HLD:** HLD revision history 1.1, 15 October 2026, module boundaries and §3.23. The latter reports 68 Must and 9 Want requirements, 77 total; this focused audit does not verify all 77.
- **P-LLD:** LLD 1.0, October 2026, Appendix A.3 and relevant workflow/security contracts. A.3 explicitly leaves unsupported-claim sign-off, presentation details, brand content and durable credential retention open. Its assertion that FR-AUTH-02 is absent is stale against v2.1.
- **PLAN:** “Next-stage plan: reliable, production-ready portfolio outputs,” planning date 9 November 2026, embedded in that same document. The adjacent refined “Capstone output-quality and templating development backlog” identifies it as `capstone-next-stage-plan.md`. The standalone file was not found in this checkout. The refined backlog explicitly corrects PLAN's presentation deferral and defines AG-01 and the affected issue IDs used below.

Current FR statements govern requirement priority. Feedback adds scope but does not create FR identifiers. Design documents describe intended contracts; code establishes what is wired, and tests/runtime evidence establish what works. The source's historical open-item cross-references are not automatically current requirement definitions.

## Repository findings

| Area                   | Evidence                                                                                                                                       | Implication                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final PDF and previews | `start/routes.ts:52`, `:76`, `:79`; `app/services/exports/document_export_service.ts:67`, `:156`                                               | PDF and HTML preview exist; HTML preview is not an approved HTML export.                                                                                                                                                              |
| Approval               | `app/services/documents/workflow_service.ts:74`, `:91`, `:110`; `readiness_service.ts:153`                                                     | Owner-only approval, current-version checks and audit records are reusable.                                                                                                                                                           |
| Solo exception         | `readiness_service.ts:36`, `:222`; `document_export_service.ts:37`, `:186`; `docs/solo-export-contract.md`                                     | Deliberate existing behavior permits unapproved solo draft PDF export. This conflicts with the literal FR-EXP-08 baseline and needs explicit reconciliation.                                                                          |
| Claim policy           | `canonical_content_service.ts:224`; `workflow_service.ts:93`; `readiness_service.ts:92`                                                        | Historical canonical validation blocks rejected/unverified claims, while active workflow uses issues/readiness and warning acknowledgments. Presence of the historical validator does not establish end-to-end claim approval policy. |
| Active editing         | `documents_controller.ts:103`; `legacy_template_service.ts:95`; `outline_template_service.ts:36`                                               | TipTap/outline flow and historical canonical projection coexist. Preserve one accepted editable body; do not reactivate old policy by assumption.                                                                                     |
| Brand                  | `1792984351178_create_template_generations_table.ts:10`; `document_export_service.ts:58`; `pdf_service.ts:68`; `resources/document_templates/` | Brand-version schema and company outline files exist. Neither proves approved company assets are selected and pinned by the active PDF path.                                                                                          |
| PPTX / collections     | Routes, export services, package manifest and migrations searched                                                                              | No active PPTX renderer/route or collection-manifest approval flow found. A template called “portfolio” describes an entry, not collection approval.                                                                                  |
| Credentials            | `config/open_router.ts:5`; `app/services/open_router_service.ts:58`; `config/embeddings.ts:26`                                                 | Environment-backed provider configuration exists. No actor/session credential resolver or BYOK settings route was found.                                                                                                              |
| Existing export schema | `1792984351178_create_template_generations_table.ts:20`                                                                                        | Historical `document_exports.format` allows HTML/PDF only. PPTX integration is now deferred; revisit storage design only if that scope is restored.                                                                                   |
| Planning drift         | `docs/workspace-tenancy-implementation-plan.md:63`; existing HTML plans                                                                        | Earlier presentation deferral and optional HTML planning need links to the release baseline; do not silently rewrite or discard them.                                                                                                 |

Migration files prove repository definitions, not applied database state. Existing tests include `document_exports.spec.ts`, `solo_pdf_export.spec.ts` and `workspace_workflows.spec.ts`; they were inspected, not executed in this documentation audit.

## Options and recommendation

| Option                                                                                   | Assessment                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Treat existing PDF code as AG-01 completion                                              | Reject: missing scope/decision artifacts and unresolved policy conflicts. The originally required PPTX gap is deferred by the later PDF-only scope decision. |
| Rebuild HLD/LLD and implement all gaps inside AG-01                                      | Reject: exceeds this one-point refinement task and duplicates existing issues.                                                                               |
| Publish a small baseline plus decision register, then route code work to existing issues | Recommend: preserves architecture and lets independent work continue while specific decisions remain open.                                                   |

No framework or renderer change is necessary for AG-01. The user subsequently selected `typesafe/jev-1.13` for AI claim evaluation on 12 November 2026; this accepted refinement is recorded in the implementation plan. Package versions and provider APIs must be checked in their implementation stories.

## Open risks

The summary table says PDF while open item 5 says DOCX; the optional summary cannot be declared accepted until reconciled. Unsupported AI-claim sign-off is unanswered despite the source's “Solved” retry response. Brand supply is promised but actual approved assets need confirmation. Session-bound BYOK is a design proposal, not the current implementation. Solo export is an intentional local contract that must be discussed before any behavior change.

## Jev selection follow-up — 12 November 2026

The user explicitly chose `typesafe/jev-1.13`, a System One decision model, to evaluate AI claims and flag outcomes. The [OpenRouter listing](https://openrouter.ai/typesafe/jev-1.13) and [TypeSafe introduction](https://docs.typesafe.ai/introduction) describe typed decisions rather than generated prose. The [OpenRouter tutorial](https://openrouter.ai/docs/guides/community/jev-tutorial) documents a separate alpha Decisions endpoint and probability-bearing answers. This corrects the earlier conversational suggestion that the evaluator would write a short explanation: evidence links and fixed labels can be supplied by the application, but Jev is not being selected to generate rationales.

Model selection is now accepted. Its factual accuracy on this project's evidence, review thresholds, and handling of flagged claims at final export remain unverified or undecided. The plan adds the integration/verification outline without implementing the adapter, calling a paid model, changing the generation model, or resolving final approval policy by implication.
