# Capstone next-stage implementation plans

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

14 November 2026 · **Proposed, ready for review; application implementation not started by this task.** All documents remain on current branch `dev`, as requested. Existing tests, untracked layout scaffolds, `package.json` and `bun.lock` edits are preserved. No branch/worktree, dependency install or database mutation was performed.

## Decisions

1. Final export is PDF only under accepted D-PDF-EXPORT. Keep internal HTML preview; EXP-01/PPTX, final HTML, summary/DOCX and CMS deferred.
2. Extend the active AdonisJS/Lucid/React/Inertia/TipTap stack and existing evidence/task/export services. No parallel editable content model or new queue.
3. Reuse the existing AG-01, QA-01, OUT-02 and OUT-03 plans and implemented code; remaining work is explicitly identified below.
4. Jev selection is accepted and its adapter now exists. Complete validation coverage/recovery rather than rebuild the adapter.
5. Use code-owned templates and small selectors. No general template designer, custom executable templates or preview gallery on the creation form.
6. Policy-dependent publication waits only on its relevant recorded decision. Independent layout/fixture/internal-preview work continues.

Read [research and current-state evidence](research.md), [architecture](architecture.md), and [incremental database model](data-model.md) first. The following seven plans together cover every refined backlog ID.

## Complete backlog coverage

The table records the **opening audit**. The [closing snapshot](handoff-snapshot.md) supersedes missing-file statements where concurrent implementation appeared. Status means source inspection only: **present** still needs acceptance; **partial** needs extension; **missing** has no active implementation at inspection; **deferred** is explicit scope. Original backlog priorities are retained, except accepted PDF-only amendment.

| Backlog ID | Assessment / remaining deliverable                                                             | Implementation plan                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| AG-01      | Partial: local register/scope exist; team acceptance and touched source correction outstanding | [01 content](01-content-evidence.md#ag-01--scope-closeout)                                |
| OUT-01     | Partial: audit exists; real-entry save/approval/native PDF trace incomplete                    | [01 content](01-content-evidence.md#out-01--close-the-real-entry-trace)                   |
| QA-01      | Present: fixtures/baseline tooling; freeze/reproduce measured baseline                         | [01 content](01-content-evidence.md#qa-01--freeze-and-reproduce-the-baseline)             |
| OUT-02     | Present: v1 metadata/mapping; verify end-to-end integration                                    | [01 content](01-content-evidence.md#out-02--retain-the-publication-contract)              |
| OUT-03     | Present: safe client DTO/private diagnostics; extend leakage checks to new paths               | [01 content](01-content-evidence.md#out-03--retain-clientreviewer-separation)             |
| OUT-04     | Partial: citations/projector exist; stable renumbering and inspection integration              | [01 content](01-content-evidence.md#out-04--stable-footnotes-and-evidence-inspection)     |
| TPL-04A    | Partial: flagged pilot CSS; real approved-asset sample acceptance                              | [02 templates](02-templates-ui.md#tpl-04a--fixed-branded-pilot)                           |
| RND-01A    | Partial: private pilot preview exists; real PDF/browser proof outstanding                      | [03 rendering](03-rendering-pdf.md#rnd-01a--pilot-through-the-real-private-route)         |
| OUT-05     | Partial: hygiene/Jev code; durable complete checks/bounded repair                              | [01 content](01-content-evidence.md#out-05--quality-checks-and-bounded-repair)            |
| TPL-01     | Partial: code brand scaffold/historical table; approved asset/version resolution               | [02 templates](02-templates-ui.md#tpl-01--versioned-brand-kit)                            |
| TPL-02     | Partial: untracked registry; server compatibility/pinning integration                          | [02 templates](02-templates-ui.md#tpl-02--template-registry-and-selection)                |
| TPL-03     | Missing: shared layout plan/block renderer                                                     | [02 templates](02-templates-ui.md#tpl-03--publication-blocks)                             |
| TPL-04B    | Missing: measured standard preset acceptance                                                   | [02 templates](02-templates-ui.md#tpl-04b--standard-two-page-preset)                      |
| TPL-08     | Missing: concise preset integration and honest overflow handling                               | [02 templates](02-templates-ui.md#tpl-08--concise-one-page-preset)                        |
| TPL-05     | Missing: bounded picker/selection API and actual preview                                       | [02 templates](02-templates-ui.md#tpl-05--selection-and-actual-output-preview)            |
| TPL-07     | Missing, P1: workspace reusable presets                                                        | [02 templates](02-templates-ui.md#tpl-07--workspace-presets)                              |
| RND-01B    | Partial: safe PDF adapter exists; frozen shared layout/bundle path needed                      | [03 rendering](03-rendering-pdf.md#rnd-01b--one-frozen-render-adapter)                    |
| RND-02     | Missing: measured fit and actionable findings                                                  | [03 rendering](03-rendering-pdf.md#rnd-02--measured-page-fitting)                         |
| RND-03     | Partial: image embedding; derivatives/font/link/collection-size acceptance                     | [03 rendering](03-rendering-pdf.md#rnd-03--pdf-production-quality)                        |
| EDT-01     | Partial: mapper/legacy conversion; reviewed lossless adoption path                             | [04 editing](04-editing-approval.md#edt-01--adopt-publication-metadata-safely)            |
| EDT-02     | Partial: save concurrency/local recovery; complete mixed-authorship cases                      | [04 editing](04-editing-approval.md#edt-02--manual-authorship-and-save-conflicts)         |
| EDT-03     | Missing: durable proposal confirm/reject                                                       | [04 editing](04-editing-approval.md#edt-03--explicit-ai-proposals)                        |
| APR-01     | Partial: version approval; complete frozen output bundle missing                               | [04 editing](04-editing-approval.md#apr-01--exact-review-and-owner-approval)              |
| EXP-01     | Deferred by D-PDF-EXPORT; no PPTX dependency/schema work                                       | [07 release](07-quality-release.md#exp-01--deferred-pptx-and-other-formats)               |
| PRT-01     | Missing: manifest/wrapper/composed PDF                                                         | [05 collections](05-collections-types.md#prt-01--wrapper-manifest-and-composition)        |
| PRT-04     | Missing, decision-dependent: collection approval/publication                                   | [05 collections](05-collections-types.md#prt-04--collection-review-and-final-publication) |
| PRT-02     | Missing, P1: selected work, ordering, whole-collection budget                                  | [05 collections](05-collections-types.md#prt-02--selected-work-and-budgets)               |
| TPL-06A    | Missing, P1: product schema/layout                                                             | [05 collections](05-collections-types.md#tpl-06a--product-profile)                        |
| TPL-06B    | Missing, P1: research schema/layout                                                            | [05 collections](05-collections-types.md#tpl-06b--research-brief)                         |
| TPL-06C    | Missing, P1: news schema/layout and packing                                                    | [05 collections](05-collections-types.md#tpl-06c--newspartnership)                        |
| PRT-03     | Missing, P2: duplicate suggestions and explicit curation                                       | [05 collections](05-collections-types.md#prt-03--duplicate-and-family-suggestions)        |
| OPS-01A    | Partial: durable fields/tasks; stage hooks and safe polling DTO                                | [06 operations](06-jobs-providers.md#ops-01a--durable-stages-and-progress)                |
| OPS-01B    | Partial: leases/dispatch exist; cumulative budget/checkpoint recovery                          | [06 operations](06-jobs-providers.md#ops-01b--recovery-checkpoints-and-budgets)           |
| OPS-02     | Missing: actor/session BYOK resolver and settings                                              | [06 operations](06-jobs-providers.md#ops-02--user-provided-credentials)                   |
| OPS-03     | Deferred selection, P1: one explicit contract per selected adapter                             | [06 operations](06-jobs-providers.md#ops-03--additional-provider-adapters)                |
| QA-02      | Partial/ongoing: story suites in progress; integrated PDF/browser/failure evidence             | [07 release](07-quality-release.md#qa-02--continuous-publication-regression)              |
| QA-03      | Missing, P1: controlled generation-model comparison                                            | [07 release](07-quality-release.md#qa-03--model-comparison)                               |
| REL-01     | Unverified: internal deployment/restore/rollback/UAT evidence                                  | [07 release](07-quality-release.md#rel-01--controlled-internal-release)                   |

## Defects and first reconciliation slice

[Research D1–D8](research.md#gaps-to-reconcile-with-test-authors) must be settled before implementing their consumers. In particular: one corrective content attempt, no claim that unconfirmed brand is approved, no invented collection approval authority, asset checksums in bundles, actual durable stage tests, native collection size tests, trusted source deduplication and recoverable post-generation validation.

New tests import missing files and are intentionally incomplete. Their current existence is a contract proposal, not evidence that features pass. Do not rewrite/delete another contributor's tests or code merely to clear the suite. Agree on policy-sensitive assertions and add missing integration coverage with the test author.

## Dependency order and independently reviewable outputs

| Slice    | Work                                                         | Exit artifact / acceptance                                                                                   |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 0        | AG-01/OUT-01/QA-01; D1–D8 reconciliation                     | Scope delta, frozen contract/test map, reproducible before sample and remaining proof explicitly recorded    |
| 1        | OUT-02/03/04, TPL-04A, RND-01A                               | Real authorized entry preview, clean public text and evidence inspection; sparse/no-image/no-metric variants |
| 2        | TPL-01/02/03/05, RND-01B; start OPS-01A and OUT-05           | Pinned selectable shared render path; server validation and visible safe progress                            |
| 3        | TPL-04B/08, RND-02/03, EDT-01/02/03, APR-01, OPS-01B         | Measured 1/2-page samples; durable proposals; exact owner approval; changed/stale bundles denied             |
| 4        | PRT-01/04 plus OPS-02 after relevant policy decisions        | Private composed preview, then authorized approved collection PDF and restart-safe jobs                      |
| 5        | QA-02/REL-01; repeated through all slices                    | Required reference release, native PDFs, isolation/failure evidence, restore and UAT                         |
| Optional | TPL-07, PRT-02, then TPL-06A/B/C, OPS-03, QA-03; PRT-03 last | Individually accepted extensions; reduce breadth before weakening P0 evidence/approval                       |

Registry and adapter contracts can be built together; standard preset publication depends on the hardened adapter, and concise publication on measured fit. This avoids turning the pilot -> registry -> renderer relationship into a circular delivery gate. Dates in old documents are forecasts, not commitments or completed milestones.

## Common verification and workflow

Current branch is retained by explicit user instruction. Documentation lives in `docs/next-stage/` beside current source documents; `.agents/` is read-only in this session. Generator commands in the plans are preparation for later implementation, not commands executed now. Run only commands for missing files after checking `git status` and `rg --files`. Do not overwrite existing scaffolds.

After each implemented slice:

```sh
node ace codegen
npm run typecheck
npm run lint
node ace test unit --files='tests/unit/<changed-contract>.spec.ts'
node ace test functional --files='tests/functional/<changed-flow>.spec.ts'
git diff --check
```

Replace the bracketed filenames with the exact files listed in that slice; these two filtered commands are templates. Functional tests must use the disposable `TEST_DB_URL` ending in `/capstone_tenancy_test`; its reset helper truncates users. Never run them against a working-data database. Use mocked provider responses in routine tests; native render and controlled live-provider evidence are separate. Run broader `node ace test unit functional`, browser suite and build once integration stabilizes, not after each Markdown edit.

## Risks and outstanding decisions

D-CLAIMS governs unresolved AI claims/overrides; D-COLLECTION governs collection authority; D-BRAND confirms assets and publishers; D-CREDENTIALS confirms session/retention/revocation; D-SOLO reconciles draft download with final approved output. Plans preserve current solo behavior until its explicit transition is accepted. No final publication policy can be inferred from pure helper tests. Missing rights/assets and inaccessible sources stay unresolved, not fabricated.

## Planning verification

Validate all local links/anchors, all 38 backlog IDs, balanced fences, source paths and `git diff --check`; review before implementation. No runtime or deployment pass is asserted by this package. Exact per-story runtime acceptance lives in the seven plans. Historical native-Chromium failure in OUT-01 is a known evidence gap, not a newly reproduced failure.
