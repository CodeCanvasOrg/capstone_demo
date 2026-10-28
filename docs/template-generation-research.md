> Historical implementation, superseded by [Company document templates](document-outline-templates-plan.md). Retained as a record; its canonical workflow and commands are no longer active.

# Template-guided generation: research and decisions

Date: 26 October 2026. Status: planning evidence; implementation has not started.
Repository baseline: `df9aa47` in `/Users/johnpaul/projects/capstone_demo`.

Read the [implementation plan](./template-generation-implementation-plan.md) for the proposed work and approval decisions, and the [architecture](./template-generation-architecture.md) for component and transaction boundaries.

## 1. Inputs and authority

- [Output specification](/Users/johnpaul/Downloads/capstone-template-output-specification.md): editorial requirements, proposed formats, evidence rules and eight portfolio-page observations.
- [Implementation backlog](/Users/johnpaul/Downloads/capstone-template-implementation-backlog.md): TMP-01–014 and TPL-001–022, priorities, acceptance criteria and suggested sequencing.
- Inspected repository implementation, migrations, tests, installed packages and Ace command registry.

The user's request is to produce an AdonisJS implementation plan for review. The attachments are requirements and design proposals, not authorization to implement, assign teammates, create external issues, publish outputs or migrate frameworks. Their NestJS/Next.js assumption explicitly lacked repository inspection. This plan uses the actual AdonisJS/React/Inertia implementation. Their portfolio observations are supplied research, not a claim that this planning session independently audited the live portfolio. The template names and word budgets remain project proposals rather than official HumbleBeeAI standards.

The referenced meeting record, proposal and slide deck were not supplied separately. No additional requirements are inferred from their titles. Existing local project documentation is useful context, but source code and installed versions resolve disagreements about current behavior.

## 2. Current behavior and the problem

The existing app already has workspace isolation, source revisions, processing runs, canonical **ingestion** blocks, hybrid retrieval, a durable task/outbox system, optimistic version saves, review, approval and PDF export. These are substantial reuse points.

Generation nevertheless asks for a general document and returns TipTap JSON. There is no template catalog in the inspected models, migrations or schema. A template cannot currently enforce section order, typed metrics, availability distinctions or renderer compatibility. The seven project-information fields are treated as universally required for shared-workspace review. The output schema lacks tables and stable section/claim identifiers.

The most consequential integration points are:

| Evidence                                                         | Finding                                                                                                 | Planning consequence                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `app/services/documents/creation_service.ts:11` and `:19`        | Document creation and project creation immediately enqueue generation.                                  | Both entry paths must expose and validate the selected format before enqueueing; persist draft setup separately.           |
| `app/services/documents/generation_service.ts:21`, `:32`, `:124` | Snapshot hashes and source pins exist; execution makes one broad retrieval request.                     | Extend the existing coordinator with template snapshots and section evidence planning.                                     |
| `app/services/documents/retrieval_service.ts:11`                 | Dense vectors plus PostgreSQL `ts_rank_cd`, fused by reciprocal rank; selected-source tenant filtering. | Keep retrieval and embedding configuration. Do not label lexical ranking BM25.                                             |
| `app/services/documents/evidence_service.ts:27`, `:76`           | Current source selection and historical TipTap references authorize dereferencing.                      | Add a version-manifest resolver for canonical content; a legacy node scan cannot validate new claims or portfolio lineage. |
| `app/services/structured_model_output_service.ts:4`              | Recursive TipTap schema, citations/images, no metric/comparison tables.                                 | Add a separate bounded semantic schema and explicit editor adapters.                                                       |
| `app/services/workspaces/task_service.ts:75`, `:126`, `:201`     | Idempotent task creation, membership epochs, leases and atomic finish.                                  | Treat a generation run as a `workspace_tasks` row; extend its payload/checkpoints rather than add another job system.      |
| `app/services/documents/readiness_service.ts:28`, `:150`         | Latest selected sources, seven fields, document-owner approval and a solo-workspace exception.          | Template-specific readiness and snapshot approval require coordinated changes.                                             |
| `app/services/documents/workflow_service.ts:18`, `:74`           | Invalidates prior approval rows; only document owner can approve.                                       | Keep historical template approvals identifiable, add explicit revocation, allow workspace owner as specified.              |
| `app/services/exports/document_export_service.ts:21`, `:179`     | PDF export relies on current document/current approval; solo mode skips approval.                       | Add explicit version/configuration export gates for template content and preserve legacy behavior by discriminator.        |
| `app/services/exports/pdf_service.ts:9`, `:52`, `:136`           | Trusted TipTap-to-HTML PDF rendering; citation attributes/links; network requests blocked.              | Reuse browser rendering and resource isolation; introduce a public-safe canonical HTML projection.                         |
| `app/models/document_block.ts:8`, `app/models/chunk_block.ts:6`  | These are extraction/provenance entities, not generated document blocks.                                | Preserve them; add version-to-evidence relations without overloading ingestion tables.                                     |

These are source-inspection findings. They do not assert that current features are broken against their previous requirements, or that runtime checks passed in this planning session.

## 3. Options considered

| Decision          | Selected approach and reason                                                                                    | Alternatives and trade-off                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application stack | Extend AdonisJS 7 and Inertia React.                                                                            | A NestJS/Next.js migration adds unrelated scope and discards existing integration work.                                                                         |
| Content contract  | Semantic canonical JSON, with deterministic TipTap and renderer adapters.                                       | Prompt-only formatting cannot enforce structure. Direct TipTap generation couples model behavior to the editor and hides typed metric/claim semantics.          |
| Version storage   | Extend `document_versions`; keep legacy content, add canonical snapshot and pins.                               | One table per document type duplicates review/export logic. Rewriting all legacy content would invent provenance and risk data loss.                            |
| Templates         | New `document_templates` and `document_template_versions`; no existing catalog found.                           | Use an existing equivalent if one appears on the implementation baseline; never maintain two catalogs.                                                          |
| Execution         | Existing `workspace_tasks`, `task_dispatches` and queue jobs, extended with durable stages.                     | Separate generation-run status and queue state would create conflicting authorities.                                                                            |
| Tables            | Bounded custom semantic metric/comparison nodes, using installed TipTap core and typed editing controls.        | Generic TableKit is available but unrestricted cell merging/structure complicates semantic round trips. It is a possible later dependency, not required for P0. |
| Generation calls  | Retrieve per section, deduplicate globally, then normally generate one complete structured draft.               | A model call per section raises cost/latency; reserve it for explicit section regeneration.                                                                     |
| Validation        | Deterministic structure/reference/numeric checks plus human claim review.                                       | A second LLM can assist but cannot certify truth. A citation alone does not prove support.                                                                      |
| Approval          | Explicit approval for final template exports, including solo workspaces; historical snapshot approvals persist. | Applying new rules retroactively to legacy exports would break an intentional existing workflow.                                                                |
| Customization     | Bounded section form and immutable publication in P1.                                                           | A visual page builder is unnecessary for the requested editorial control.                                                                                       |

## 4. Installed compatibility facts

Observed from `node_modules/*/package.json`, not assumed from caret ranges:

| Package                 | Installed version |
| ----------------------- | ----------------- |
| `@adonisjs/core`        | 7.5.2             |
| `@adonisjs/lucid`       | 22.4.2            |
| `@adonisjs/inertia`     | 5.0.1             |
| `@adonisjs/queue`       | 0.6.2             |
| `@tiptap/core`          | 3.31.4            |
| `react`                 | 19.3.0            |
| `@inertiajs/react`      | 3.7.1             |
| `zod`                   | 4.6.5             |
| `@langchain/openrouter` | 0.4.15            |
| `playwright`            | 1.63.0            |

The project requires Node >=24. PostgreSQL is the configured database; `TEST_DB_URL` is used in test mode, with a fallback to `DB_URL`, so explicit test-database isolation is required. New entity IDs should follow the UUID convention; user IDs are integers. The checked-in lockfile is `bun.lock`; no dependency change is proposed for P0.

`config/open_router.ts` uses environment-configured generation and embedding models. Its code defaults differ from the meeting summary's Qwen reference. Runtime secret configuration was not read; preserve the actual configured model and embedding space. The gateway currently selects function-calling structured output and has three transport attempts. Keep schema repair separate from transport retries and impose a run-wide call budget.

Existing UI skill notes also lag some implementation details (for example fonts). Reuse the actual `inertia/css/app.css`, adjacent components and installed primitives instead of restoring older styling from prose documentation.

## 5. External references checked

Ace exposes the command registry and per-command help; local help was checked for controller, model, service, migration, policy, validator, page, test and seed commands. [AdonisJS Ace documentation](https://docs.adonisjs.com/guides/ace/introduction).

Framework scaffolds follow installed generator conventions. Run code generation after backend interface changes and before checking generated route/entity consumers. [AdonisJS command reference](https://docs.adonisjs.com/reference/commands), [code generation](https://docs.adonisjs.com/guides/concepts/codegen).

TipTap 3 supports custom node schemas and attributes suitable for section and semantic block identity. The generic table extension exists, but its flexibility is not needed for the initial constrained metric/comparison editor. [TipTap Node API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node), [Table extension](https://tiptap.dev/docs/editor/extensions/nodes/table).

No new provider integration is selected. The existing local OpenRouter contract and transport simulation are the starting point for expanded provider tests. No Postman workspace setup or publication is needed to write this plan.

## 6. Remaining decisions and risks

The implementation plan proposes defaults for owner permissions, solo approval, English-first release, image policies, source revocation, legacy coexistence and historical exports. Company brand material and the final summary/presentation format remain product inputs. These do not prevent planning the shared foundation, but public branded release and P1 output acceptance depend on them.

Primary risks are semantic/editor drift, losing review history, treating missing evidence as success, retry multiplication, accidental generation before selection, public leakage of internal source URLs, and building more output types than can be evaluated. The staged plan makes these explicit release gates.
