> Historical implementation, superseded by [Company document templates](document-outline-templates-plan.md). Retained as a record; its canonical workflow and commands are no longer active.

# Template generation implementation and verification

**Updated:** 2026-10-27 (Asia/Seoul). **State:** First-release code implemented and automated checks passed; production pilot release gates remain open.

The approved first release is Standard, Technical and Vision case studies. Create case study now shows three template cards below the brief/source controls in place of the single bottom action. Selecting one saves its exact setup and opens the template editor. This report does not mark the later portfolio/custom/short/summary/presentation backlog complete.

## Delivered behavior

- Immutable versioned catalog, canonical content, provenance manifests, validation reports, claim decisions, candidates and export records, with additive database constraints.
- Explicit generation from a saved brief, section-specific retrieval packs, bounded evidence/images, structured output, persisted attempt/repair counters and existing durable task/lease fencing.
- Seven semantic block editors, rich paragraph formatting, exact metric strings/units, linked evidence, source-image preview, brief/source editing and saved version previews.
- Detached section/template-change proposals, explicit omissions, stale-base rejection and idempotent acceptance. No-image changes remove image blocks and captions from the proposed snapshot.
- Owner claim review and exact-version approval, including solo workspaces. Workspace and document owners may approve; other members may edit/submit. New edits preserve historical approval; explicit revocation blocks its exports.
- Private approved HTML/PDF rendering and download. Both outputs share canonical values, rendering logic and embedded fonts. Public approval requires reviewed brand configuration. Staged uploads publish only after access/approval rechecks; revocation during upload prevents publication and cleans the staged object.
- Feature rollout flags, immutable brand publication command, read-only audit command, operator/API guide and local Postman transport fixture.

## Verification performed

| Check                                | Result and limits                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                  | Backend and Inertia TypeScript passed.                                                                                                                                                                                                      |
| `npm run lint`                       | Passed.                                                                                                                                                                                                                                     |
| `npm run build`                      | Production frontend and backend build passed.                                                                                                                                                                                               |
| `PORT=3349 node ace test unit`       | 40 passed, one opt-in real-PDF test skipped. Covers canonical structure, escaping, seven blocks, precision and rich-text round trips, plus existing regression cases.                                                                       |
| `PORT=3347 node ace test functional` | 90 passed, three opt-in transport/external tests skipped. Uses the guarded disposable `capstone_tenancy_test` database.                                                                                                                     |
| Final regression                     | Full functional and unit suites repeated after the public-brand and setup-revision adjustments, with the same passing totals.                                                                                                               |
| Test migrations                      | Both additive migrations applied to the disposable database before functional tests.                                                                                                                                                        |
| Local development installation       | Both migrations applied to local `capstone_tenancy_dev`, then only `document_template_seeder.ts` ran. All three catalog definitions published; audit found zero invalid canonical envelopes.                                                |
| Existing development content         | Before/after counts and checksums matched for nine documents (identity, title, descriptions, status/current version) and twelve versions (identity, parent document, version number and content). No reset or legacy conversion.            |
| Generated routes/types               | Ace generation ran during test boot and production build; generated indexes/types are included. Standalone `ace codegen` printed successful generation but retained open handles, so it is not reported as a clean standalone command exit. |
| Postman 1.73.0 simulation            | Attempted `postman simulation run ... --port 4900 --no-history`; failed before serving because dataset support could not access `~/.postman/`. No live-provider substitute.                                                                 |
| Browser UI                           | Attempted local in-app browser access; the origin approval gate declined permission. No browser walkthrough, viewport, keyboard or dark-mode proof is claimed.                                                                              |
| Real PDF process                     | Chromium launch attempted earlier and failed with macOS sandbox MachPort permission errors. PDF content/rendering code is covered by deterministic tests; real pagination and visual inspection remain unverified.                          |

The functional export test runs actual rendering and HTTP download against a controlled private-storage adapter. It verifies HTML, MIME, checksum, historical approval, replay, revocation during upload, no publication on revocation and staged cleanup. It does **not** establish live S3/provider behavior.

## Requirements and test evidence

| Backlog                       | Implementation / test evidence                                                                                                                                    | Outstanding acceptance                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| TPL-001–003 / TMP-01,02,04,05 | Shared catalog/content contracts; `canonical_content.spec.ts`, `template_documents.spec.ts`; immutable seed/replay and database enforcement                       | Editorial review of the default formats                                                           |
| TPL-004 / TMP-03,09,11        | Workspace-scoped policies/FKs; `template_candidates.spec.ts`, existing tenancy tests                                                                              | Broader production role pilot                                                                     |
| TPL-005 / TMP-01,07           | Create cards and setup; `document_creation_generation.spec.ts`, `minimal_creation.spec.ts`; HTTP editor props in `template_workflows.spec.ts`                     | Browser accessibility/mobile/dark-mode walkthrough                                                |
| TPL-006–009 / TMP-03,04,05,12 | Per-section packs, budget limits and persisted repair/attempt state; `template_generation.spec.ts`, existing task/retrieval regressions                           | Live relevance/injection/numeric evaluation, model transport and sustained retry/latency workload |
| TPL-010 / TMP-06,09           | Typed editing, candidate diff/accept/reject; `template_candidates.spec.ts`, `template_generation.spec.ts`, `template_rendering.spec.ts`                           | Browser editing/candidate walkthrough                                                             |
| TPL-011 / TMP-07              | Source-only media, scoped source stream, no-image proposal; canonical/media fixtures and existing asset isolation tests                                           | Live private-storage media and visual review                                                      |
| TPL-012–013 / TMP-08,09       | Semantic renderer, exact snapshot approval/export/revocation; `template_workflows.spec.ts`, `template_rendering.spec.ts`; legacy solo export regressions retained | Actual PDF pagination and live HTML/PDF sample signoff                                            |
| TPL-017–018 / TMP-12          | Synthetic fixtures, operations guide, bounded telemetry, flag rollback test                                                                                       | Reviewed quality/performance results and mentor pilot signoff                                     |
| TPL-014–016,019–020 (P1)      | Explicit later scope in approved plan                                                                                                                             | Portfolio, custom-template authoring, short case, summary and presentation remain unimplemented   |
| TPL-021–022 (P2)              | Explicit optional scope                                                                                                                                           | Resume/illustration work requires separate agreed formats/provider                                |

The synthetic fixture text proves contracts, not writing quality or factual accuracy. Every generated claim starts unverified; owner approval is explicit. No unsupported inference is automatically promoted to a verified fact solely because it has an evidence ID. The under-one-minute generation goal has not been measured.

## Release gate and reproducible follow-up

Keep production disabled until real provider transport, reviewed factual/availability/numeric fixtures, authorized media storage, browser interactions and every-page PDF inspection pass. Review supplied brand/CTA content and public media clearance before public artifacts. Use `docs/template-generation-operations.md` for routes, CLI installation, publishing, rollback and recovery.

After local tooling permissions are available, run the opt-in Postman transport check using the exact local mock URL and dummy key in `postman/README.md`. Run `RUN_TEMPLATE_PDF=1 node ace test unit --files=tests/unit/template_rendering.spec.ts` in an environment that can launch Chromium. Complete the manual create → generate → review → approve → export journey for all three formats, including stale candidates and historical revocation. No shared Postman workspace, deployment, CMS publication or remote Git push was performed.

## Integration

Implementation was isolated on `codex/template-generation` in `/private/tmp/capstone-template-generation`, backed by `/private/tmp/capstone-template-origin.git`. The app-managed worktree was unused because it lay outside writable roots; it has been archived. The verified source files are integrated into `/Users/johnpaul/projects/capstone_demo` after matching the original Git baseline and existing planning-document checksums. Main checkout Git metadata is read-only in this session, so these are reviewable working-tree changes, not a claimed merge or main-branch commit. The isolated branch retains the implementation commits.

Integration verified 77 files byte-for-byte, followed by a passing main-checkout type check and zero-invalid-envelope audit. The development server is running at `http://127.0.0.1:3344`. Native watching hit `EMFILE`; restarting with `CHOKIDAR_USEPOLLING=true node ace serve --hmr --poll` succeeded and reported active filesystem watching. This proves server startup, not browser UI acceptance.
