# Capstone output-quality and templating development backlog

**Project:** CodeCanvas / AI-Powered Case Study and Portfolio Generator  
**Prepared:** 9 November 2026  
**Planning horizon:** Weekly increments through 14 December 2026  
**Status:** Proposed backlog, ready for team refinement; no repository audit or issue creation has been performed. Story points and sprint selections are provisional.

## 1. Product goal and source authority

Deliver editable, evidence-linked case studies and portfolios that users can reliably preview, review, approve and export in consistent HumbleBee AI layouts. Preserve current working functionality and develop small, demonstrable improvements each week.

This backlog translates the attached next-stage plan into executable stories. It also checks that plan against the official **[Capstone Project | CodeCanvas](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4)** document, retrieved 9 November 2026. The document contains several historical versions; the relevant source sections are:

| Reference | Official project section | Use in this backlog |
| --- | --- | --- |
| P-FR | Functional Requirements Document **v2.1**, revision dated 15 October 2026 | Current requirement statements and Must/Want classification |
| P-HLD | High Level Design, revision history **1.1**, dated 15 October 2026; especially §§2 and 3 | Module boundaries, workspaces, workflow and traceability |
| P-LLD | Low Level Design Document **1.0**, October 2026; §§3.4–3.8 and §4 | Candidate/version/approval contracts, rendering, persistence, jobs and security |
| F-PDF | Portfolio-Generator-Feedback.pdf, 7 November 2026, printed §§01–09 | Output defects, page budgets, footnotes, branding, content types and acceptance checks |
| F-MTG | Weekly-Meeting.txt and Weekly-meeting-week-8.txt | Deterministic templates, stakeholder testing, user API keys and deployment fallback |
| PLAN | capstone-next-stage-plan.md | Earlier stage priorities and backlog; refined here where official scope differs |

**Precedence:** current requirement statements govern business scope. HLD/LLD supply design direction; they do not prove implementation exists. Recent feedback proposes refinements, which need explicit traceability. Technical documentation validates library capabilities, not the project's business rules. All class names, DTOs and migrations below are proposed interfaces until checked against the repository.

### 1.1 Corrections and decisions to record

| Topic | Evidence and treatment |
| --- | --- |
| Partner presentation | P-FR **FR-EXP-05 is Must and specifies PPTX**. Retain it in the required release audit and EXP-01; the earlier plan's general presentation deferral must not remove this requirement. |
| Manual writing | **FR-EDIT-07** exempts user-authored content from automated evidence validation. Validate schema, permissions, assets and approval; retain authorship and human accountability. Recheck evidence automatically for changed AI-authored proposals. |
| Summary format | FR-EXP-04 is Want; its table says PDF, but open item 5 specifies DOCX. Log the inconsistency and use DOCX only after the recorded clarification is reconciled. The concise case-study PDF below is a layout preset, not completion of the optional summary requirement. |
| Source revisions | P-LLD still cites FR v1.2 and contains stale IDs. Use actual v2.1 definitions, including FR-AUTH-02 and FR-TEN-01–03. Do not copy the stale LLD assertion that FR-AUTH-02 is absent. |
| Unsupported AI claims | FR-RAG-05 requires flagging; open item 9 does not settle approval handling. Preserve visible flags and human review. A stricter final-export block is a proposed policy decision, not an already approved requirement. Until resolved, keep affected new outputs in internal preview; other work continues. |
| New content types and portfolios | Product/research/news layouts, collection composition, saved presets and page-budget rules are feedback-driven extensions. Map them to related FRs without pretending their detailed behavior already appears there. |
| Credentials | P-LLD proposes session-bound protected references. Use that initial policy; durable encrypted BYOK retention is a separate decision and migration. Never place provider keys in task or document snapshots. |
| Retrieval and framework | Preserve the existing scoped retrieval path and AdonisJS/React/Inertia baseline. No framework migration, embedding replacement or new retrieval experiment is needed for the first increment. |

## 2. Agile delivery rules

Use a single ordered product backlog and one-week delivery cycles. Maintain a clear sprint goal, select work against actual capacity, demonstrate completed behavior, and reorder the remaining backlog from feedback. The Scrum Guide describes an evolving backlog and an adaptable sprint plan; the WIP limits, estimates and ceremonies below are local team choices, not mandatory Scrum rules. [D01]

### 2.1 Board and fields

Use **GitHub Issues and Projects** as the working board. GitHub Projects supports issue/PR integration, custom fields, board/table views and iteration fields. [D02]

| Field | Values / purpose |
| --- | --- |
| Status | Backlog → Ready → In progress → Review/QA → Done |
| Priority | P0: required scope or first usable release; P1: feedback expansion; P2: optional improvement |
| Iteration | One week; only the current iteration is selected work |
| Estimate | 1, 2, 3, 5 or 8 story points; relative complexity, not hours |
| Area | Content, evidence, templates, editor, rendering, portfolio, operations, QA |
| Requirement | Existing FR IDs or `Feedback extension`; keep both when appropriate |
| Dependency | Blocking issue IDs; split integration dependencies from work that can use fixtures |
| Blocked | Boolean plus concrete reason and next action; avoid hiding blocked work in a separate queue |

Suggested WIP limit: one implementation item per developer, initially no more than two substantial technical items in progress across the team. QA participates from the first slice. Roles follow existing responsibilities: John on integration/backend, Abu on AI/evidence, Jeon Jonghyeon on frontend/layout, and Davron on QA. These are proposed leads, not assignments made on the team's behalf.

### 2.2 Definition of Ready

An implementation item is Ready when its user outcome, acceptance examples, source references, dependencies, short HLD/LLD notes, representative data and responsible reviewer are understood. A short discovery spike may be Ready with a specific unanswered question and an exit artifact. Design detail is finalized immediately before the relevant work, not all at once.

No downstream item in this file should be treated as fully refined merely because it has a proposed implementation note. A story above five points should normally be split into reviewable increments during refinement.

### 2.3 Definition of Done

- Acceptance criteria demonstrated on representative data and relevant negative cases.
- Necessary code reviewed by another member; relevant checks pass.
- Existing access, evidence and approval behavior preserved or intentionally changed with a recorded decision.
- Schema/API changes and affected HLD/LLD notes updated in the same PR.
- Screenshot, rendered output, test result or safe job trace attached as appropriate.
- No unresolved critical defect in the changed path; working increment available in the agreed test environment.

Keep unfinished work open. Do not mark a story Done because its backend, mockup or documentation alone is complete when its acceptance criteria require an integrated user flow.

### 2.4 Keep documentation small and current

| Change | Update required |
| --- | --- |
| Ordinary implementation detail | Code, meaningful tests and the issue's LLD note |
| API/schema or service boundary | Relevant contract/migration plus HLD/LLD delta in the PR |
| New scope or changed approval/security behavior | Short decision record with source, options, decision, consequence and affected FRs |
| Weekly stakeholder feedback | New/reordered issue; revise acceptance criteria before implementing it |
| Academic/company review milestone | Consolidate accepted deltas into affected formal document sections and traceability table |

Keep the existing formal HLD/LLD as a baseline. Do not rewrite either entire document every sprint. Keep contracts and decision notes version-controlled, and identify the baseline plus accepted deltas as the current design between formal consolidations. Formal requirements change only when behavior or scope changes, not because an internal function was renamed.

Suggested cadence: 30-minute weekly planning, brief daily coordination, 20-minute midweek refinement, stakeholder review of the working increment, and a short retrospective. These durations are team proposals.

## 3. Minimum shared HLD and LLD notes

### 3.1 HLD note: preserve the architecture and extend output responsibilities

Retain the web workspace, application API, shared RAG/evidence layer, persistent storage and background execution. Add or clarify these responsibilities inside the existing application:

| Responsibility | Owns | Must not own |
| --- | --- | --- |
| Generation/validation | Typed draft, claim authorship, evidence links, internal review issues | Page coordinates or final approval |
| Version service | Accepted immutable content and source dependencies | Rendering or provider credentials |
| Template/brand registry | Versioned layouts, allowed blocks, tokens and presets | Invented facts or arbitrary executable user templates |
| Render service | Deterministic projection, layout measurement, preview and artifacts | Fresh factual rewriting during export |
| Approval service | Exact reviewed bundle and owner audit | Auto-approval based on model confidence |
| Collection service | Ordered entry revisions, wrapper and collection review manifest | Implicit approval of changed or inaccessible entries |
| Task service | Progress, budgets, checkpoints, recovery and safe errors | Treating queue delivery as proof of accepted content |

Template, brand, layout preset and document content are separate versioned inputs. Reuse existing implementations where OUT-01 finds them. Each story should integrate through a small vertical slice, with fixture-backed adapters where dependencies are not yet complete.

### 3.2 LLD note: contracts that protect the workflow

**Semantic content:** retain TipTap-compatible JSON as the editing representation; add a validated publication projection/metadata contract. Do not create two independently editable bodies. Preserve stable node/claim IDs, source revisions and registered asset IDs. See P-LLD §§3.4–3.7 and D05–D06.

**Version acceptance:** compare `baseVersionId`, serialize the document mutation, append the accepted version and event atomically, then clear review/approval on a meaningful change. Replayed requests return the original outcome; stale requests return a conflict without overwriting. Keep database transactions short and never hold them across provider/browser calls. See P-LLD §3.5 and D04.

**Review bundle:** pin content version, publication projections, template/brand versions, assets, renderer settings and their hash. Approval is owner-only and requires the reviewed/current version and bundle to match. Recheck approval and access before publishing an artifact and again on download. See P-LLD §§3.5–3.6.

**Jobs:** reuse the durable task design if implemented. P-LLD §3.8 proposes PostgreSQL polling, task leases and fencing; Redis is not an assumed dependency. `SKIP LOCKED` can avoid contention for queue consumers, but a durable result/fencing contract is still application work. [D10]

**Credentials:** store only opaque actor/session-bound references in jobs. Expiry pauses work with `WAITING_CREDENTIAL`; supplying a credential does not reset persisted call budgets. No silent provider fallback or arbitrary client-supplied endpoint.

### 3.3 Persistence changes are incremental

Audit actual migrations first. P-LLD §3.7 lists 12 existing domain tables and proposes tasks, candidates, review bundles, artifacts, assets and source dependencies; it does not prove those additions are deployed. Reuse equivalent records rather than duplicate them.

Template versions, brand versions, presets and portfolio manifests are proposed extensions. Add their minimum validated JSONB/typed references only when the corresponding story needs them. Preserve existing primary-key types; `users.id` remains integer. Add/backfill/validate before enforcing stricter constraints; never regenerate missing historical provenance.

## 4. Ordered product backlog

**Story format:** outcome → acceptance criteria → HLD note → LLD note → verification and sources. Checkboxes are acceptance criteria, not a claim that work has been completed.

### Epic A — Establish the baseline and publish one clean sample

#### AG-01 — Reconcile the next-stage scope and decision log

**P0 · 1 point · Lead: John + Abu · Dependencies: none · Type: refinement**

**Outcome:** the team has one release scope and knows which decisions remain open.

- [ ] Record PDF and PPTX as required; preserve HTML/DOCX/CMS distinctions.
- [ ] Resolve or assign an owner/target review for unsupported-AI-claim approval, collection approval, brand assets and credential retention.
- [ ] Link each changed behavior to its existing FR or mark it as a feedback extension; do not create imaginary FR numbers.

**HLD note:** preserve P-HLD's workspace, generation, editing, evidence and output boundaries. This is reconciliation, not another full design exercise.

**LLD note:** add a short decision register with status `proposed/accepted/superseded`, affected issue IDs and migration consequences. Replace stale FR references only where touched.

**Verify / sources:** review the scope matrix against P-FR §§5, 8–12; P-HLD §3.23; P-LLD Appendix A.3; PLAN. Other independent work proceeds while nonblocking decisions remain open.

#### OUT-01 — Audit the implemented generation-to-export path

**P0 · 2 points · Lead: John · Dependencies: none · Type: spike**

**Outcome:** developers know what to extend and what already works.

- [ ] Trace one real entry through generation, editor save, evidence lookup, preview, approval and export.
- [ ] Record actual package versions, routes, tables, job behavior and adapters; mark each backlog item implemented, partial, missing or unverified.
- [ ] Save a before sample and identify the smallest change needed for the branded pilot.

**HLD note:** map actual components to responsibilities in §3.1 without changing frameworks.

**LLD note:** inspect migrations/catalog and current TipTap extensions; check source ID representation, approval pointers and provider output contract. Preserve existing working records.

**Verify / sources:** exit with a concise repository map and the pilot's integration points, not a replacement HLD. P-HLD §§2–3; P-LLD §§1.5–1.6, 3.4–3.7.

#### QA-01 — Freeze representative output fixtures and baseline measurements

**P0 · 2 points · Lead: Davron + Abu · Dependencies: none; refine with OUT-01**

**Outcome:** improvements can be compared using the same examples.

- [ ] Capture entry 01 and cases covering no image, no metric, long title, estimated result and long citations.
- [ ] Record source revisions, model/settings, page count, bytes, observable defects and stage timing when available.
- [ ] Create a claim-review sheet with supported/contradicted/unsupported labels and separate user-authored text.

**HLD note:** quality evaluation spans content, layout and workflow; it is not a final-phase-only activity.

**LLD note:** use reproducible fixture identities and expected claims/qualifiers. Original 173-page metrics remain reported feedback until independently remeasured; use sanitized fixtures for CI.

**Verify / sources:** another member can reproduce the baseline. F-PDF §§01, 03–04, 09; P-LLD §§3.8.3 and Appendix A.2.

#### OUT-02 — Define the first publication-content contract

**P0 · 3 points · Lead: Abu + John · Dependencies: OUT-01**

**Story:** as an editor, I want predictable fields that can drive different layouts without losing the original evidence.

- [ ] Case-study content validates with stable nodes/claims, result qualifiers, evidence refs, registered assets and separate reviewer notes.
- [ ] Missing optional values remain absent; malformed structure or unknown types produce field-level errors.
- [ ] Existing TipTap JSON maps to/from the projection without a second editable source of truth.

**HLD note:** content describes meaning; templates describe presentation. Reserve type identifiers for case study, product, research and news, but enable only implemented types.

**LLD note:** version the schema. Start with `docType`, `hero`, typed sections, `results`, `figures`, `reviewerNotes` and references to accepted content. Result values retain scope, units, baseline/period where relevant and `measured/estimated/client_reported/design_target` labels.

**Verify / sources:** valid/invalid fixture tests and one migration mapping. P-FR FR-GEN-01/05/07; P-LLD §§3.4, 3.7; F-PDF §07; D03, D05.

#### OUT-03 — Separate client copy from reviewer diagnostics

**P0 · 2 points · Lead: John · Dependencies: OUT-02**

**Story:** as a reviewer, I can see gaps without printing internal commentary in the client PDF.

- [ ] Client render data excludes reviewer notes, raw chunk IDs and internal paths.
- [ ] Missing facts create internal issues or omit optional blocks; they do not trigger invented copy.
- [ ] Material caveats such as estimated/design-target labels remain visible to the client.

**HLD note:** reviewer and client views share content identity but have different allowed projections.

**LLD note:** construct the client DTO with an allowlist; never pass a full candidate/task record into templates. Lint suspect diagnostic phrases in publication fields and report them for repair; avoid global word deletion.

**Verify / sources:** inspect client payload and extracted PDF text using diagnostic-leakage fixtures. P-FR FR-GEN-05/06, FR-RAG-05; F-PDF §§01, 03, 07.

#### OUT-04 — Replace raw citations with footnotes and evidence inspection

**P0 · 3 points · Lead: John + Abu · Dependencies: OUT-02**

**Story:** as a reader, I see unobtrusive references; as a reviewer, I can inspect the full supporting excerpt.

- [ ] Superscript references resolve to concise source blocks without losing claim-to-evidence links.
- [ ] Reordering an entry renumbers display references while preserving internal identities.
- [ ] Missing source URLs stay missing; unauthorized source files remain inaccessible.

**HLD note:** evidence service owns provenance; renderer owns citation presentation.

**LLD note:** use stable reference IDs internally, a per-render numbering map and deduplicated source descriptions. Resolve immutable file/revision/run/chunk tuples server-side; retain full IDs in the authorized reviewer panel.

**Verify / sources:** citation mapping before/after reorder and renamed source file; unauthorized lookup denied. P-FR FR-RAG-03/04/06/07, FR-FM-04/07/08; P-LLD §§3.4, 3.6–3.7; F-PDF §03.

#### TPL-04A — Ship one fixed branded case-study pilot

**P0 · 3 points · Lead: frontend + John · Dependencies: OUT-02/03/04; QA-01 fixtures**

**Story:** as marketing, I can review entry 01 in a credible publication layout immediately.

- [ ] Render a hero, supported result row, challenge/solution, selected capabilities, CTA and sources.
- [ ] Empty results/images collapse; typography and qualifications stay readable.
- [ ] Compare the sample with the existing output and capture stakeholder feedback.

**HLD note:** build the first end-to-end slice before a generalized designer or full template catalog.

**LLD note:** implement a code-owned pilot layout behind a flag using verified current brand assets. It may use a fixed validated configuration initially; promote it into TPL-02/03 rather than keeping a parallel renderer. Do not fabricate assets when originals are unavailable.

**Verify / sources:** entry 01 plus no-image/no-metric fixtures; approve visual direction, not factual claims automatically. FR-GEN-02, FR-EXP-03/06; F-PDF §§05–07.

#### RND-01A — Integrate the pilot into the existing private preview/PDF path

**P0 · 2 points · Lead: John · Dependencies: OUT-01, TPL-04A; can develop with fixture projection**

**Story:** as an editor, I can preview the pilot through the actual application.

- [ ] Authorized users can render the captured content version with a draft watermark.
- [ ] Custom nodes either render correctly or fail visibly; no silent section loss.
- [ ] Reuse the existing final-export authorization boundary and keep unapproved artifacts private.

**HLD note:** the pilot proves content-to-template-to-preview integration; hardening follows in RND-01B.

**LLD note:** reuse the audited renderer and server-compatible TipTap utility; pin the extension set. Keep preview artifacts separate from final-download eligibility. Do not add an unauthenticated test route.

**Verify / sources:** smoke test preview and denied access; visually inspect the generated pages. P-FR FR-APR-01, FR-EXP-03/07/08; P-LLD §3.6; D06–D07.

### Epic B — Reliable generation and preserved evidence

#### OUT-05 — Add content-quality checks and bounded corrective generation

**P0 · 5 points · Lead: Abu · Dependencies: OUT-02, QA-01**

**Story:** as an editor, I receive a valid draft with visible evidence issues and useful failure recovery.

- [ ] Validate schema, citation membership, repeated titles, brand terminology and numerical qualifier preservation.
- [ ] Flag unsupported/contradicted AI claims without claiming that citation presence proves support.
- [ ] A malformed response receives at most one corrective content attempt under the initial P-LLD budget; exhausted attempts surface an actionable error.

**HLD note:** separate structural validation from factual support checks and human approval.

**LLD note:** use compatible OpenRouter structured-output parameters, then validate locally. P-LLD starts with at most two completed content attempts and four outbound calls per task; persist budgets and deadlines. Retries do not approve or overwrite current content. Split provider-budget wiring into OPS-01B if needed.

**Verify / sources:** invalid JSON, invented evidence ID, changed “up to” qualifier and authentication failure. P-FR FR-GEN-05/06/09, FR-RAG-04/05; P-LLD §3.4; D03, D09.

### Epic C — Reusable, selectable templates

#### TPL-01 — Store a versioned HumbleBee AI brand kit

**P0 · 3 points · Lead: frontend + John · Dependencies: OUT-01; brand asset review**

**Story:** as marketing, I can reuse approved branding across layouts.

- [ ] Configure logo/assets, palette, static fonts, canonical company name, terminology and contact fields.
- [ ] Existing documents retain their pinned brand version after updates.
- [ ] Missing required assets or unapproved configuration produce clear validation findings.

**HLD note:** branding is configurable data, independent from factual content and layout geometry.

**LLD note:** reuse an existing brand model if present; otherwise add an immutable published configuration version plus a draft-edit path. Asset references are registered IDs, not arbitrary remote URLs. Confirm actual colors; the reference's navy/yellow is a starting direction.

**Verify / sources:** change brand draft, confirm old approved preview remains reproducible. FR-GEN-02, FR-EXP-06; P-LLD §§3.5–3.6; F-PDF §§04, 07.

#### TPL-02 — Introduce the template registry and compatibility rules

**P0 · 3 points · Lead: John · Dependencies: OUT-02, TPL-04A**

**Story:** as an editor, I select a known layout compatible with my content type.

- [ ] Registry lists enabled templates with type, schema version, supported options and page budget.
- [ ] Unsupported content/template combinations fail before generation/rendering.
- [ ] Published versions are immutable; existing entries stay pinned until an explicit upgrade.

**HLD note:** keep registry definitions separate from brand kits and user presets.

**LLD note:** start with code-owned definitions and persisted version references; add an authoring UI only when needed. Validate allowed block IDs, field bindings, typography limits and variants. Use fixture contract tests for each published definition.

**Verify / sources:** disable a template, reject an unsupported type, rerender an older pinned version. P-FR FR-GEN-01/02/05, FR-EXP-01/06; P-HLD output responsibilities; F-PDF §§06–07. Registry details are a proposed design.

#### TPL-03 — Extract reusable publication blocks from the pilot

**P0 · 5 points · Lead: frontend · Dependencies: TPL-04A, TPL-02**

**Story:** as a template maintainer, I can assemble consistent layouts from tested blocks.

- [ ] Reusable hero, results, text, steps, capability cards, figure/caption, roadmap, CTA and sources cover the first two presets.
- [ ] Empty optional blocks disappear without reserved whitespace.
- [ ] Each block has size/variant constraints and fixtures for long and sparse content.

**HLD note:** code selects allowed blocks; the model fills semantic fields and cannot inject executable layout code.

**LLD note:** give blocks typed props and stable identifiers for measurement. Preserve image aspect ratio/caption association; define page-break grouping for headings, results and sources. Extract only blocks needed by current templates.

**Verify / sources:** visual checks for dense/sparse data and long footnotes. FR-GEN-01/02, FR-EXP-06/07; F-PDF §§04–07; D08. Split the block set across PRs if five points is exceeded.

#### TPL-04B — Publish the standard two-page case-study preset

**P0 · 3 points · Lead: frontend + Abu · Dependencies: TPL-02/03, RND-01B**

**Story:** as marketing, I can produce a complete case study within two pages.

- [ ] Hero, qualified results, challenge, solution/steps and sources fit representative fixtures.
- [ ] Images, proof and roadmap are optional and never fabricated to fill space.
- [ ] Exceeding the budget produces a fit issue rather than a silent third page.

**HLD note:** this is the main release template, built from the shared blocks.

**LLD note:** page budget includes citations. Keep content limits and typography limits in the versioned definition. Use RND-02's measurement interface; manual fixes are acceptable while automated fitting is refined.

**Verify / sources:** first five case-study entries and QA-01 edge fixtures. P-FR FR-EXP-03/06; F-PDF §§04–09; TPL-04 in PLAN. No claim that all arbitrary future input will fit.

#### TPL-08 — Add a concise one-page case-study preset

**P0 · 3 points · Lead: frontend + Abu · Dependencies: TPL-04B, RND-02**

**Story:** as an editor, I can choose a shorter case-study layout without losing necessary qualifications.

- [ ] The concise preset fits its reference cases in one page including sources.
- [ ] Compatible fields can be reused without another model call.
- [ ] Any necessary shortening creates a reviewable content/projection change and requires renewed approval.

**HLD note:** a layout preset is separate from the optional one-page summary export requirement.

**LLD note:** prioritize a supported subset of fields. Preserve the original standard document and source mapping. Failure to fit offers a clear standard-layout choice; it does not shrink type below the agreed minimum.

**Verify / sources:** compare claims and qualifier retention across concise/standard output. FR-EXP-01/03/06, FR-APR-01/05; F-PDF §§05–06; D07–D08.

#### TPL-05 — Add template/brand selection and real output preview

**P0 · 3 points · Lead: frontend · Dependencies: TPL-01/02, RND-01B**

**Story:** as an editor, I choose a compatible format before requesting publication.

- [ ] Picker shows available templates, page budgets and supported image/options states.
- [ ] Preview identifies content, template and brand revisions and reports fit/validation issues.
- [ ] Changing a selection does not silently rewrite facts or keep stale approval.

**HLD note:** selection is configuration of an entry instance; content type remains explicit.

**LLD note:** server validates selectable IDs/options and returns safe compatible choices. Start with the current preview/job polling path; avoid adding a second progress mechanism. A type suggestion is editable and never silently forces research into case-study sections.

**Verify / sources:** select/switch layout, inspect actual pages, reject a forged template ID. FR-GEN-02, FR-APR-01/05; F-PDF §06; template picker is a feedback extension.

#### TPL-07 — Save reusable workspace presets

**P1 · 3 points · Lead: John + frontend · Dependencies: TPL-05; workspace policy verified**

**Story:** as a workspace member, I can reuse an approved combination of template and brand options.

- [ ] Create/name/duplicate a preset and select it for a new entry.
- [ ] Presets reference compatible published versions; later changes do not alter approved documents.
- [ ] Unauthorized workspace users cannot read or modify the preset.

**HLD note:** presets store configuration, not generated content or arbitrary page code.

**LLD note:** reuse workspace boundaries and existing authorization; define who can publish shared presets during AG-01. Save allowed options and pinned version IDs. Optional-block reordering is constrained by template slots and FR-EDIT-03, not a freeform canvas.

**Verify / sources:** reuse a preset across two entries; cross-workspace denial; preset update leaves old exports unchanged. FR-TEN-01–03, FR-EDIT-03, FR-GEN-02; F-MTG and platform review. Detailed sharing policy is proposed.

### Epic D — Predictable rendering and file quality

#### RND-01B — Harden the shared preview/final render adapter

**P0 · 5 points · Lead: John · Dependencies: RND-01A, TPL-01/02**

**Story:** as a reviewer, I see the layout that the approved PDF will use.

- [ ] Preview and final use the same render model and dependency versions; only intentional draft labeling differs.
- [ ] Font/image readiness, browser deadlines and safe asset resolution are enforced.
- [ ] Unavailable assets and unsupported nodes fail visibly; output cannot fetch arbitrary external content.

**HLD note:** rendering is a controlled adapter over a frozen input bundle, independent of generation.

**LLD note:** pin browser/fonts, print settings and renderer version. Use the server-compatible TipTap entry point for the installed version. Playwright `page.pdf()` uses print media; set page-size/background options explicitly. Cache keys include content, projections, assets, template, brand and renderer identity.

**Verify / sources:** rerender identical input; compare structure/layout with the approved preview, not necessarily byte-identical PDFs. FR-EXP-01/03/06/07; P-LLD §3.6; D06–D07, D12.

#### RND-02 — Enforce page budgets and report layout failures

**P0 · 5 points · Lead: John + frontend · Dependencies: RND-01B, TPL-03**

**Story:** as an editor, I know when a layout cannot fit and how to fix it.

- [ ] Detect entry budget overflow, clipping, detached headings and unintended near-empty pages on fixtures.
- [ ] Collapse empty blocks and use only approved compact variants before requesting copy changes.
- [ ] No repair hides claims/citations, drops necessary qualifiers or silently adds a page.

**HLD note:** layout checks produce structured findings; content rewrites follow the normal proposal/approval path.

**LLD note:** measure configured page/block containers and inspect actual PDF page count. Apply break rules and minimum typography, but do not assume CSS alone guarantees fit. Covers/dividers are explicit sparse-page exceptions. Begin with one deterministic fitting pass and clear manual action; refine from failures.

**Verify / sources:** long title, oversized figure, dense footnotes and isolated conclusion. FR-EXP-03/06, FR-APR-01; F-PDF §04; D07–D08. Automated overlap detection requires measured validation against real PDFs.

#### RND-03 — Optimize images and verify PDF fonts, links and size

**P0 · 3 points · Lead: John + QA · Dependencies: RND-01B, QA-01**

**Story:** as a recipient, I get a readable PDF suitable for sharing.

- [ ] A declared reference email portfolio is below 8 MB with readable charts/screenshots.
- [ ] Inspect final PDF text/font embedding, source links and image quality; avoid unexpected Type 3 fonts.
- [ ] Preserve source originals; high-resolution export uses a separate explicit preset if required.

**HLD note:** optimization belongs to rendering and derived assets, not source mutation.

**LLD note:** generate keyed image derivatives per asset/config hash and choose encoding by image content. Test static font files in the actual renderer; changing the CSS font declaration alone is not proof of correct embedding. Record page/entry count with bytes.

**Verify / sources:** inspect the produced PDF using an existing analyzer and rendered pages. FR-EXP-06/07; F-PDF §§04, 09; D07, D14. The size target is feedback-specific, not an arbitrary-input guarantee.

### Epic E — Editing, migration and exact approval

#### EDT-01 — Migrate existing entries without losing content or evidence

**P0 · 3 points · Lead: John + frontend · Dependencies: OUT-01/02, TPL-02**

**Story:** as an existing user, I can adopt the new layout without losing prior work.

- [ ] Convert representative old entries and retain their original immutable versions.
- [ ] Compare text, sections, images, authorship and evidence coverage before/after.
- [ ] Unknown nodes/missing provenance create migration findings rather than silent deletion or fabricated links.

**HLD note:** migration is an adapter into the semantic contract, not a bulk rewrite of the entire library.

**LLD note:** use an additive schema-version mapping with dry-run report and feature flag. Apply only verified backfills. Migrate a small reviewed set before expanding; source references must retain original identities.

**Verify / sources:** round-trip fixture and rerender old pinned version after migration. FR-GEN-07, FR-EDIT-01/02, FR-RAG-04; P-LLD §§3.5, 3.7; D05–D06.

#### EDT-02 — Preserve authorship and prevent conflicting manual saves

**P0 · 5 points · Lead: John + frontend · Dependencies: OUT-02, EDT-01 where migration needed**

**Story:** as an editor, my saved changes are attributable and do not overwrite another accepted version.

- [ ] Changed subtrees become user-authored; unchanged AI evidence survives only when text identity matches.
- [ ] Manual text bypasses automated support validation, while structure/assets/access still validate.
- [ ] Two saves against the same base produce one accepted result and one conflict; local unsaved content is preserved.

**HLD note:** VersionService remains the sole acceptance boundary; authorship is server-derived.

**LLD note:** compare `baseVersionId`, canonical hash and mutation key in a short transaction. A no-op does not create a version or invalidate approval. Queue/debounce autosaves and pause on 409 instead of retrying stale content against a new base.

**Verify / sources:** stale save, lost-response replay, no-op and mixed AI/user paragraph cases. FR-EDIT-01/02/07, FR-APR-05; P-LLD §3.5; D04–D05.

#### EDT-03 — Confirm AI edits and section regeneration as isolated proposals

**P0 · 5 points · Lead: Abu + John · Dependencies: OUT-05, EDT-02**

**Story:** as an editor, I can inspect an AI change before it modifies accepted content.

- [ ] Generate a section/edit candidate against a captured base; no accepted content changes before confirmation.
- [ ] Show the proposed difference, evidence changes and quality warnings; reject leaves content unchanged.
- [ ] Stale confirmation fails safely; unaffected sections retain content and evidence identity.

**HLD note:** candidate generation and accepted-version mutation are distinct operations.

**LLD note:** reuse candidate/task records; confirm through VersionService with candidate state, base version, mutation key and current permission checks. AI rewrites retain AI authorship and undergo evidence checks. Page-fitting rewrites use this same path.

**Verify / sources:** confirm/reject/stale cases and section-only preservation. FR-GEN-08, FR-EDIT-05/06; P-LLD §§3.4–3.5; D09 for provider output constraints, not approval semantics.

#### APR-01 — Bind review and owner approval to the complete output bundle

**P0 · 5 points · Lead: John · Dependencies: EDT-02, RND-01B; can start from existing approval flow**

**Story:** as the document owner, I approve the exact content and output configuration I reviewed.

- [ ] Enforce Draft/Edited → In Review → Approved through recorded events; owner-only approval.
- [ ] Content, projection, template, brand or asset changes invalidate the relevant review/approval; no-op changes do not.
- [ ] Export publication and download recheck current permission, version and bundle; audit failure rolls approval back.

**HLD note:** acceptance, review, approval and export are separate states/actions.

**LLD note:** freeze a review bundle; atomically compare current/review versions and hash, set approval pointers and append audit. Keep provider/render calls outside the transaction. Apply the AG-01 decision for unsupported AI issues and distinguish manual authorship.

**Verify / sources:** edit/revoke access during render, stale approval and failed audit write. FR-CS-01, FR-APR-01–05/07, FR-SEC-05, FR-EXP-08; P-LLD §§3.5–3.6; D04.

### Epic F — Required presentation and portfolio composition

#### EXP-01 — Verify or implement branded PPTX export

**P0 · 5 points · Lead: John + frontend · Dependencies: APR-01, TPL-01; projection work can use fixtures**

**Story:** as a partner-facing presenter, I can download the required presentation from reviewed content.

- [ ] Produce a real PPTX with a company-approved short slide structure and qualified source-backed results.
- [ ] Slides derive from a reviewed projection; export performs no fresh factual generation.
- [ ] Preview/review the presentation before approval; slides and downloaded file match the approved bundle without clipping or missing assets.

**HLD note:** add or reuse a format adapter; this is required FR scope, not an optional template expansion.

**LLD note:** audit the current generator first. PptxGenJS is a candidate existing library; verify compatibility and rendering before selecting it. Include slide projection, generator version and assets in the bundle/hash. Use deterministic field selection initially; review any rewritten projection.

**Verify / sources:** open and render the actual PPTX in the supported viewer; changed base content invalidates it. FR-EXP-01/05/06/07/08; P-LLD §3.6; D13. Split preview/projection and file adapter if needed.

#### PRT-01 — Compose the basic branded portfolio wrapper

**P0 · 5 points · Lead: frontend + John · Dependencies: TPL-04B, RND-01B**

**Story:** as marketing, I can present a coherent collection instead of concatenated entry pages.

- [ ] Include cover, short company introduction, category-aware contents, ordered entries and contact/back cover.
- [ ] Contents page numbers/links match the final composed document after length changes.
- [ ] Company statistics use approved deduplicated evidence; entry count is not presented as delivered-project count.

**HLD note:** collection wrapper and entry templates have separate responsibilities.

**LLD note:** assemble a manifest of pinned entry revisions and wrapper content. Use a bounded layout/index pass and verify stable page offsets; fail visibly if contents pagination does not converge. Default to the supported case-study subset while other types remain unavailable.

**Verify / sources:** change entry order/length, then verify actual PDF destinations. FR-EXP-01/03/06 plus feedback extension; F-PDF §06. Final publication depends on PRT-04.

#### PRT-04 — Define and enforce collection review and export approval

**P0 · 3 points · Lead: John + product review · Dependencies: APR-01, PRT-01; decision from AG-01**

**Story:** as the authorized collection reviewer, I approve a portfolio whose wrapper and entries match the final output.

- [ ] Final collection includes only accessible, valid approved entry snapshots under the agreed policy.
- [ ] Wrapper copy, ordering, projections and branding are reviewed as a complete collection manifest.
- [ ] A changed entry/configuration or revoked access prevents stale publication/download.

**HLD note:** individual entry approval alone does not approve a newly written introduction or collection projection. Collection authority is a feedback extension to settle explicitly.

**LLD note:** hash the manifest and referenced bundles; revalidate each dependency before publication/download. Lock affected records in stable order or use a verified conflict-check strategy; do not introduce a collection approver who bypasses document ownership.

**Verify / sources:** approved entry edited during collection render; wrapper changed after review. FR-APR-02/05, FR-EXP-08; P-LLD §3.6 as an entry-level basis, extended here.

#### PRT-02 — Add selected-work filtering, ordering and a collection budget

**P1 · 3 points · Lead: frontend · Dependencies: PRT-01/04**

**Story:** as marketing, I create a smaller portfolio relevant to a prospect.

- [ ] Select/filter/reorder accessible saved entries without regenerating their facts.
- [ ] Contents and output contain exactly the selection.
- [ ] Overall budget includes wrapper pages; show when the requested collection cannot fit.

**HLD note:** selection is a collection configuration over pinned approved entries.

**LLD note:** version the manifest and persist entry IDs plus revision/bundle identity. Keep filtering inside workspace/resource permissions. Offer fewer entries or concise presets when ten two-page entries plus the wrapper exceed a twenty-page target.

**Verify / sources:** selection change, inaccessible ID, empty selection and budget overflow. F-PDF §06; related FR-RAG-07, FR-EXP-08. Selected-work behavior is a feedback extension.

### Epic G — Expand the template catalog after the first path passes

#### TPL-06A — Add a product-profile content type and layout

**P1 · 3 points · Lead: Abu + frontend · Dependencies: TPL-02/03/05, OUT-05**

**Story:** as marketing, I describe a product without inventing a client project or deployment result.

- [ ] Show audience, features, workflow, optional screenshots, verified availability and CTA.
- [ ] Missing availability/results are omitted or flagged internally; they are not invented.
- [ ] A user can correct a suggested content type before generation.

**HLD note:** type-specific fields share evidence and brand infrastructure.

**LLD note:** add one versioned schema/adapter and compatible template definition. Keep unsupported conversions explicit; changing an existing entry's type creates a reviewable revision, not a silent relabel.

**Verify / sources:** two product examples including missing availability. F-PDF §06; related FR-GEN-01/05, FR-EXP-06. This type is a feedback extension.

#### TPL-06B — Add a research-brief content type and layout

**P1 · 3 points · Lead: Abu + frontend · Dependencies: TPL-02/03/05, OUT-05**

**Story:** as a reader, I understand research contributions and their limits.

- [ ] Display title, available authors/venue, plain-language summary, optional key figure and evidence-backed findings.
- [ ] Metrics retain dataset, baseline, units and conditions; they do not imply realized commercial impact.
- [ ] Missing publication metadata remains absent or a review issue.

**HLD note:** research is a distinct publication contract, not a case study with renamed headings.

**LLD note:** add typed research sections and metric-context validation. Preserve paper/figure/page links and reference identities. No unreviewed citation or author metadata lookup is performed during export.

**Verify / sources:** two papers, including no business results and a relative benchmark improvement. F-PDF §06; related FR-RAG-04/05, FR-GEN-01/05. Feedback extension.

#### TPL-06C — Add a news/partnership block and layout

**P1 · 2 points · Lead: frontend + Abu · Dependencies: TPL-02/03/05**

**Story:** as marketing, I include company news in a suitable short format.

- [ ] Render headline, sourced event date, short summary and optional approved photo/logos.
- [ ] No forced solution/results sections or invented metrics appear.
- [ ] Short news blocks can share a page without creating unintended empty pages.

**HLD note:** news is a short content type and can be composed inside a collection.

**LLD note:** distinguish event date from source publication date when available. Use approved block variants and deterministic packing; never crop partner marks or reorder material facts to fit.

**Verify / sources:** two news examples, one without a photo/date. F-PDF §06; related FR-GEN-01/05, FR-EXP-06. Feedback extension.

#### PRT-03 — Suggest duplicate or product-family entries

**P2 · 2 points · Lead: Abu · Dependencies: PRT-01, OUT-02**

**Story:** as a reviewer, I can identify repetitive entries before assembling a portfolio.

- [ ] Suggest likely duplicates with a visible reason and linked entries.
- [ ] Reviewer chooses keep, group or exclude; no automatic merge/delete.
- [ ] Distinct projects with similar titles remain available.

**HLD note:** duplicate review assists collection curation and cannot change accepted evidence automatically.

**LLD note:** begin with normalized title/source overlap checks using existing data; do not add a new embedding pipeline for this feature. Record curation choices in the manifest. A merge, if later supported, needs its own reviewed revision flow.

**Verify / sources:** similar customs/product examples and a false-positive pair. F-PDF §03. This is an optional feedback extension.

### Epic H — Jobs, provider settings and controlled release

#### OPS-01A — Expose durable stage-based output progress

**P0 · 3 points · Lead: John · Dependencies: OUT-01**

**Story:** as a user, I see what the system is doing and can recover from a clear failure.

- [ ] Show preparing, retrieving, drafting, validating, rendering and ready-for-review where applicable.
- [ ] Refreshing the UI retains task identity/status; unauthorized task lookup is denied.
- [ ] Record stage durations and safe error codes without invented progress percentages.

**HLD note:** task execution state is separate from document lifecycle and approval.

**LLD note:** reuse the task store and `GET /jobs/:id` contract if present. Add only necessary durable fields, actor/resource links and checkpoint identities. Polling is sufficient initially. Never serialize provider keys or private excerpts into UI status.

**Verify / sources:** refresh during generation, failed render, forbidden task ID. FR-GEN-09, FR-ING-08 where reused; P-LLD §§3.4, 3.8. Operational detail is not optional just because broad generation logging is Want.

#### OPS-01B — Recover interrupted jobs without duplicate accepted outputs

**P0 · 5 points · Lead: John · Dependencies: OPS-01A; OUT-05 integration**

**Story:** as a user, a retry resumes safely instead of losing completed work or silently exceeding budgets.

- [ ] Completed entry checkpoints survive restart and are reused when inputs still match.
- [ ] Expired workers cannot publish after a newer worker claims the task.
- [ ] Persist retry/provider budgets; cancellation and credential expiry stop further stages where possible.

**HLD note:** database outcome/lease is authoritative; transport may deliver more than once.

**LLD note:** follow P-LLD §3.8's lease token/fencing approach and short conditional commits. PostgreSQL polling is the initial proposal unless the audited implementation already has a suitable durable adapter. External queue mode needs transactional dispatch intent. Exactly-once acceptance does not promise exactly-once provider billing.

**Verify / sources:** restart before/after candidate creation, late worker completion, lost HTTP response and rate limit. FR-GEN-09, FR-EXP-08; P-LLD §§3.7–3.8; D04, D10.

#### OPS-02 — Implement safe user-provided model credentials

**P0 · 3 points · Lead: John · Dependencies: OUT-01, AG-01 policy; OPS-01A integration**

**Story:** as a user, I can configure my API access without exposing it to other users or documents.

- [ ] Submit/test/revoke a masked credential; never echo the key through page props or logs.
- [ ] Jobs resolve actor/session-bound references and pause when unavailable.
- [ ] One user's configuration never overwrites a global process key or another user's configuration.

**HLD note:** credential resolution is independent of the content and evidence snapshots.

**LLD note:** reuse the protected server credential store, ownership checks and endpoint allowlist. Use infrastructure environment configuration separately from per-user BYOK. Durable retention requires an accepted encryption/expiry/deletion policy; do not add it implicitly.

**Verify / sources:** two-user isolation, revoke while running, restart/session expiry and key redaction. FR-SEC-03; P-LLD §§3.4, 4.3; F-MTG. The meeting request extends configuration UX.

#### OPS-03 — Validate additional provider adapters behind one contract

**P1 · 3 points per adapter · Lead: John + Abu · Dependencies: OPS-02, OUT-05**

**Story:** as a user, I choose an explicitly supported generation provider.

- [ ] Each enabled adapter passes schema, usage, timeout, authentication and cancellation cases.
- [ ] Unsupported models/options produce clear errors; no silent provider fallback occurs.
- [ ] Embedding configuration stays unchanged unless separately planned.

**HLD note:** add adapters without changing version, evidence or approval contracts.

**LLD note:** refine this parent into separate OpenAI/Google/Anthropic items only when selected. Reuse the current OpenRouter path first. Provider compatibility must be verified against its official documentation at implementation time; an OpenAI-shaped endpoint alone is insufficient evidence.

**Verify / sources:** contract fixtures plus one controlled live call per enabled adapter. F-MTG and platform review; P-LLD §1.6, §3.4; D09 covers OpenRouter only.

#### QA-02 — Automate regression checks across the publication workflow

**P0 · 5 points, delivered incrementally · Lead: Davron + team · Dependencies: QA-01; follows each implemented slice**

**Story:** as the team, we can detect a change that breaks a previously accepted output.

- [ ] Run representative schema/evidence, preview, page-fit, approval-conflict and access tests.
- [ ] Preserve reviewed visual baselines; inspect actual PDF/PPTX artifacts as well as browser screenshots.
- [ ] Report release reference-set results, unresolved defects and failed jobs separately from retries.

**HLD note:** tests accompany development; this is an ongoing quality workstream, not a final integration phase.

**LLD note:** pin visual-test OS/browser/fonts/data, mask volatile UI values, and require intentional baseline updates. Use mocked providers in routine CI and controlled live evaluation separately. Split coverage into story-specific checks; avoid one unfinishable umbrella issue.

**Verify / sources:** demonstrate an intentional citation/layout regression being caught. P-FR relevant changed FRs; P-LLD Appendix A.2; D11. Browser snapshots alone do not prove PDF font embedding or factual accuracy.

#### QA-03 — Compare generation models on output reliability

**P1 · 3 points · Lead: Abu + Davron · Dependencies: QA-01, OUT-05**

**Outcome:** choose a model using measured evidence rather than meeting preference alone.

- [ ] Compare current model and one or two candidates on identical sources/prompts/settings where applicable.
- [ ] Report schema success, AI S/C/U labels, qualifier retention, latency, usage and cost where available.
- [ ] Preserve raw results and distinguish repeated trials from automatic retries.

**HLD note:** model selection is a configurable generation decision, independent of layout templates.

**LLD note:** use three trials per reference prompt initially, record actual model/provider identity and missing usage explicitly. Include corrective attempts in totals. Do not extrapolate a small fixture result into a universal accuracy claim.

**Verify / sources:** reproducible comparison and a documented default-model decision. F-MTG; P-LLD §3.8.3 and Appendix A.2; D09 for capability constraints.

#### REL-01 — Deliver a controlled internal release and handoff

**P0 · 5 points · Lead: John + QA · Dependencies: required-path issues accepted; incremental deployment starts earlier**

**Story:** as stakeholders, we can test the agreed release and reproduce its outputs.

- [ ] Publish an internal test build or Docker fallback with pinned dependencies/fonts/browser assets.
- [ ] Verify migrations, health checks, bounded workers, private storage, backup/restore and rollback compatibility.
- [ ] Hand off user/reviewer instructions, known limitations, measured acceptance results and a before/after demo.

**HLD note:** initial readiness targets controlled internal use, not unmeasured public-scale SaaS.

**LLD note:** deploy behind flags, verify one approved content/source/render bundle restores correctly, and rehearse an interrupted job. Retain newly accepted versions during rollback; do not revert to code that cannot interpret their approval/evidence schema.

**Verify / sources:** staging UAT, one restore rehearsal and required PDF/PPTX sample downloads. P-LLD §§1.6, 3.7–3.8, 4; F-MTG; FR-EXP-03/05/08.

## 5. Initial sprint backlog and subsequent forecast

### 5.1 Sprint 1 candidate: 9–15 November

**Goal:** an editor can open one real case study and preview a concise branded output with readable references and internal-only reviewer notes, preserving evidence and current approval restrictions.

This is a candidate selection, not a team commitment. OUT-01 validates reuse assumptions first. Select the smallest feasible subset at planning; if the audit finds major missing infrastructure, split the pilot and change the forecast rather than claiming the whole list will fit.

| Order / parallel lane | Work | Points | Demonstrable contribution |
| --- | --- | --- | --- |
| Start | OUT-01 | 2 | Verified extension points and baseline sample |
| In parallel | QA-01 | 2 | Reproducible first entry and edge fixtures |
| Early refinement | AG-01 | 1 | Correct Must scope and explicit unresolved decisions |
| Build | OUT-02 | 3 | Minimum semantic/publication contract |
| Build | OUT-03 | 2 | Clean client payload and internal diagnostics |
| Build | OUT-04 | 3 | Readable references with evidence lookup |
| Integrate | TPL-04A | 3 | Branded pilot using approved current assets |
| Integrate | RND-01A | 2 | Actual private preview through the application |
| **Candidate total** | **8 items** | **18** | **One integrated output, not eight disconnected components** |

The points are uncalibrated and do not establish velocity. If only two members can implement substantial code, reduce selected scope accordingly and pair the other members on fixtures, visual review and QA. Existing functionality that passes acceptance checks should be reused and verified, not rebuilt.

**Suggested working tasks:** John traces export/evidence integration; Abu prepares schema/evidence fixtures; frontend adapts the pilot layout against fixtures; QA captures baseline and checks source mapping and visual output. Resolve fixture/schema boundaries early so frontend and content work can progress together.

**Review:** demonstrate before/after, open a supporting excerpt, show reviewer notes absent from client pages, render no-image/no-metric variants, and confirm unapproved output remains a preview. Log changes as issues before expanding the catalog.

### 5.2 Rolling forecast

Only refine the next iteration in detail. The dates are planning windows, not fixed phase gates.

| Window | Proposed goal | Candidate work | Scope adjustment rule |
| --- | --- | --- | --- |
| 16–22 Nov | Reusable and selectable case-study layouts | TPL-01/02/03/05; RND-01B; OUT-05; start OPS-01A | Finish pilot defects before generalizing more blocks |
| 23–29 Nov | Correct edits, fit checks and exact approval | TPL-04B/08; RND-02; EDT-01/02/03; APR-01 | Deliver the highest-risk edit/approval slice first; carry unfinished items explicitly |
| 30 Nov–6 Dec | Composed portfolio and required PPTX path | PRT-01/04; EXP-01; OPS-01B/02; RND-03 | Required PPTX/approval work precedes P1 catalog expansion |
| 7–13 Dec | Release candidate with measured quality | QA-02, REL-01; highest-value remaining P0 defects | Freeze optional scope; reserve room for stakeholder fixes |
| 14 Dec | Handoff and demonstration | Accepted release, known limitations and evidence | Report incomplete Must scope honestly |

P1 types, selected-work export, saved presets, extra providers and model comparison enter only when the usable required path is stable and capacity permits. P2 duplicate suggestions are first to drop. This is a sizable backlog; the horizon is not a promise that every item will fit.

The required baseline extends beyond this new output backlog. OUT-01 must also verify existing authentication, workspaces, ingestion/file-library and RAG Must requirements; passing the new output work alone does not establish completion of all 68 Must requirements listed in P-HLD §3.23.

## 6. Release evidence and acceptance summary

| Check | Evidence to collect |
| --- | --- |
| Content/evidence | Audited AI claims and retained result qualifiers; manual authorship reported separately |
| Client copy | No raw chunk identifiers/internal reviewer notes in extracted client text |
| Layout | Declared reference cases within chosen page budgets; no clipping/orphan headings |
| Formats | Real approved PDF and PPTX; optional HTML/DOCX/CMS status explicit |
| Portfolio | Correct entry order, wrapper, contents destinations and exact manifest approval |
| File production | Font inspection, readable image derivatives and under-8-MB email reference collection |
| Concurrency | Stale edit/AI confirmation/approval/export rejected; valid no-op and replay behavior |
| Recovery | Restart/timeout/cancellation scenarios; no duplicate accepted artifacts or budget reset |
| Permissions | Cross-workspace/source/task/download negative cases; revoked access checked again |
| Stakeholder acceptance | Recorded layout/copy UAT and unresolved defects with owners |

Use the earlier plan's initial 19-of-20 export-job batch as a proposed smoke criterion if adopted, with failures and retries reported separately. It is not a production availability guarantee. Set latency targets after a declared workload baseline; record median/p95 and distinguish ingestion, generation, validation and rendering. Zero unresolved AI support issues in an audited reference set does not establish universal factual accuracy.

## 7. Issue template for ongoing work

```markdown
Title: [ID] User-visible outcome
Priority / estimate / iteration:
Lead / reviewer:
Requirement or feedback source:
Dependencies:

User outcome:

Acceptance criteria:
- [ ] Observable success case
- [ ] Important failure/conflict case
- [ ] Integrated evidence/demo

HLD note:
Component responsibility, boundary and data flow affected.

LLD note:
Smallest API/data/algorithm change, permissions, failure behavior.

Verification:
Representative fixture and meaningful checks.

Documentation delta:
Affected contract or decision; formal section only if needed.

Official references:
Project section and relevant technical documentation.
```

## Appendix A. Official technical references and design boundaries

Reviewed 9 November 2026. Match documentation to the installed package versions during OUT-01. These sources support capabilities; task boundaries, page budgets, naming, new entities and workflow adaptations are project proposals unless explicitly attributed to P-FR/P-HLD/P-LLD.

| ID | Official documentation | Specific use |
| --- | --- | --- |
| D01 | [The Scrum Guide, 2020](https://scrumguides.org/scrum-guide.html) | Ordered evolving backlog, sprint goal/plan, inspection/adaptation and Definition of Done. Local WIP limits/meeting durations are proposed team practices. |
| D02 | [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) | Issues/PR integration, board/table views, custom fields and iterations. No issues were created by this document. |
| D03 | [AdonisJS validation](https://docs.adonisjs.com/guides/basics/validation) | Request validation with VineJS; use a shared domain validator for persisted/model content too. Authorization and factual support remain separate responsibilities. |
| D04 | [Lucid transactions](https://lucid.adonisjs.com/docs/transactions) | Managed/manual transaction support. Version conflicts, lock order, idempotency and approval predicates are application-specific design. |
| D05 | [TipTap persistence](https://tiptap.dev/docs/editor/core-concepts/persistence) | JSON editor persistence. Publication metadata must not become an independently editable duplicate of the document. |
| D06 | [TipTap HTML utility](https://tiptap.dev/docs/editor/api/utilities/html) | JSON/HTML conversion with an extension list; distinguishes browser-only and server-compatible utilities. Check the installed major version and custom nodes. |
| D07 | [Playwright Page PDF API](https://playwright.dev/docs/api/class-page#page-pdf) | Print-media PDF generation and explicit print/background/page-size settings. It does not automatically enforce project layout-quality criteria. |
| D08 | [W3C CSS Fragmentation](https://www.w3.org/TR/css-break-3/) | Page-break, keep-together, widow/orphan concepts. Actual browser/PDF behavior needs representative verification. |
| D09 | [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs) | Compatible model/provider schema output; request configuration depends on API family. Provider enforcement can vary, so retain local validation. Does not prove factual accuracy. |
| D10 | [PostgreSQL SELECT / locking](https://www.postgresql.org/docs/current/sql-select.html) | Row locking and `SKIP LOCKED` for queue-like consumers. Lease renewal, fencing and accepted-outcome deduplication remain project logic. |
| D11 | [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) | Screenshot comparison practices. Pin the environment and inspect PDF/PPTX artifacts separately. |
| D12 | [W3C CSS Font Loading](https://www.w3.org/TR/css-font-loading-3/) | Font loading readiness concepts for rendering. Embed/inspect actual PDF fonts as a separate check. |
| D13 | [PptxGenJS quick start](https://gitbrent.github.io/PptxGenJS/docs/quick-start/) | Existing TypeScript-capable PPTX generator candidate. Adoption and Bun/runtime compatibility are not assumed. |
| D14 | [Sharp image output API](https://sharp.pixelplumbing.com/api-output/) | Candidate image-derivative encoding controls. Verify the installed library before adoption; compression settings must preserve readable evidence figures. |

**Backlog lineage:** OUT-01–05, TPL-01–05/07, RND-02/03, EDT-01/02, PRT-01–03, OPS-02, QA-01/02 and REL-01 retain their earlier intent. TPL-04 and RND-01 are split into pilot/hardened increments; TPL-06 becomes three type-specific stories; OPS-01 becomes progress/recovery stories. AG-01, TPL-08, EDT-03, APR-01, EXP-01, PRT-04, OPS-03 and QA-03 make scope and previously bundled responsibilities explicit. These are issue identifiers, not new functional-requirement IDs.
