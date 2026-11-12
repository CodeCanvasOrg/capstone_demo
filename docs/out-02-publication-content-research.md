# OUT-02 — Publication-content contract research

12 November 2026 · P0 · 3 points · Leads: Abu + John · Dependency: OUT-01 **implemented, as confirmed by the user**.

**Planning only.** Extend the completed path with a versioned semantic contract over the accepted TipTap document. Keep `document_versions.content` as the editable authority; generate publication DTOs from it. Do not revive the older canonical-template workflow or add a second editable body.

## Sources and scope

[Capstone Project | CodeCanvas](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4/edit), snapshot retrieved earlier in this conversation with provider modification time `2026-11-12T06:30:11.830Z`: OUT-02, P-LLD §§3.4/3.7 and P-FR FR-GEN-01/05/07. The document contains historical requirement revisions; the current release baseline is [release-scope.md](release-scope.md). User-provided OUT-02 wording governs this refinement.

F-PDF §07 and references D03 (Adonis validation) / D05 (TipTap persistence) are linked by the shared backlog. The standalone original feedback PDF was not independently retrieved during this turn; do not claim a fresh section-level review. This plan uses inspected local validators, TipTap persistence code and installed CLI behavior, not assumptions about a different framework.

Checkout inspected at `fa8e080`. In-progress QA-01 work is present in `.gitignore`, `app/services/qa/`, `commands/qa_output_baseline.ts` and `tests/fixtures/output/` / QA tests; it is independent and was not edited or declared accepted by this audit.

## Actual reusable implementation

| File / location | Implemented behavior | OUT-02 gap |
| --- | --- | --- |
| `app/services/documents/publication_projection_service.ts:3` | Versioned pilot projection, title/summary/body, per-render numbered source labels; body not mutated | Presentation projection loses internal identities/metadata and is intentionally not reversible; no typed results/claims/notes contract. |
| `app/services/exports/pdf_service.ts:87` | Legacy/pilot HTML/PDF branches consume saved content | Reuse rendering; do not make layout CSS or source-number order part of semantic content identity. |
| `app/services/documents/content_service.ts:9` | Size/depth caps, TipTap schema parse, optional nesting repair and link protocol checks | Root metadata and unknown attrs are stripped; errors are generic. Non-link mark attrs are deleted. Stable IDs added only to a DTO would not survive save. |
| `app/services/structured_model_output_service.ts:5` | Model/editor recursive TipTap schema, allowed nodes and marks | No root publication schema, block/claim IDs, typed qualifiers or strict unknown-field errors. Model and editor contracts need separate acceptance adapters. |
| `app/services/documents/chunk_metadata_service.ts:50` | Citation/image references hydrated from trusted chunks; unknown references removed | Rebuilds image/citation attrs, so new stable identity attrs must be explicitly preserved. Strict annotated content cannot silently lose a referenced figure/evidence node. |
| `app/services/documents/version_service.ts:17` | Current save path normalizes/hydrates, checks base/replay/no-op, appends version, invalidates approval | Integrate complete metadata validation before accepting new annotated content; preserve concurrency and idempotency. |
| `shared/templates/content.ts:82` | Historical canonical schema v1 with semantic block IDs, some evidence IDs and metric tables | Different schema/lifecycle; lacks the requested docType/hero/typed qualifiers/notes contract. Its schemaVersion 1 must not be repurposed. |
| `app/services/documents/canonical_content_service.ts:29` | Canonical parse, ID/claim hash helpers, scoped evidence manifest concept | Useful prior art; validation is coupled to older template policy and cannot be switched on for all existing drafts. |
| `shared/templates/editor.ts:35`; `legacy_template_service.ts:18` | Paragraph formatting conversion and historical canonical→editable mapping | Not a lossless full-document round trip; historical immutable records must stay interpretable. |
| `app/exceptions/handler.ts:44` | JSON 422 can already expose `errors: [{field,message}]` | Populate it with safe, path-specific domain validation errors; do not send raw excerpts/parser payloads. |
| `inertia/components/documents/editor.tsx:35` | Existing extensions, one autosave at a time and stale-save recovery | Root metadata/global IDs need TipTap extension support; selection/split/paste/undo must preserve or allocate identities predictably. |

Installed versions remain Adonis core 7.5.2, Zod 4.6.5, TipTap core/HTML 3.31.4, Playwright 1.63.0. No package change is proposed. Current schema migration definitions were read, including `1792984351178_create_template_generations_table.ts` and `1793006927296_create_template_snapshot_integrities_table.ts`; no live database change or fresh production-schema verification occurred.

## Defects and design constraints

- **D1 — metadata loss:** validators, structural repair and hydration can strip new identities. Browser/server/model handling must agree before annotated saves are enabled.
- **D2 — irreversible render projection:** pilot numbering/labels omit evidence tuples and original nodes. Never reconstruct an editor body from the client-safe DTO.
- **D3 — evidence validity vs factual support:** valid chunk IDs and source membership are not claim support decisions. Preserve evidence context without enabling policy enforcement or claiming Jev integration complete.
- **D4 — incompatible historical schema:** canonical envelopes and immutability triggers bind existing `content_schema_version=1` to the older template workflow. OUT-02 must not set that column to a new schema number or reinterpret old v1 records.
- **D5 — generic errors and silent repair:** malformed annotated metadata must get field errors, not guessed defaults. Compatibility repair for old model prose must remain a distinct path.
- **D6 — legacy uncertainty:** headings/prose do not reliably establish result measurement category, authorship, claim-level support or public image rights. Mapping must retain unknowns and report them rather than fabricate meaning.

## Options

| Option | Decision |
| --- | --- |
| Store an independently editable `canonical_content` publication body alongside TipTap | Reject: creates conflicting authorities and reactivates historical envelope requirements. |
| Replace TipTap with semantic forms or a new editor | Reject: violates the requested extension of the working path and adds unnecessary migration risk. |
| Add presentation CSS/template IDs and layout blocks to the semantic schema | Reject: content meaning must work across layouts; template selection remains separate. |
| Store semantic annotations within the same TipTap JSON, derive internal/public DTOs and translate edits against the accepted base | Recommend: one atomic version/replay boundary, preserved body, safe compatibility path. |
| Infer all metrics/qualifiers from prose during migration or ask a model to rewrite it | Reject: introduces unreviewed facts and changes historical evidence. |

## Recommendation and boundaries

Use `content.attrs.publication.schemaVersion=1` in a **new namespace**, plus stable IDs on supported TipTap blocks. The metadata references accepted nodes/spans, evidence identities and registered images. Derived DTOs resolve text from those nodes; they are never independently persisted or accepted as replacement editor content. Store internal reviewer notes separately from public body within that same versioned metadata namespace; existing document issues remain workflow issues, not an alternative editable copy of the notes.

Provide a bounded, typed edit adapter against the exact saved base for reverse mapping. A round trip requires the original accepted body and identity/hash bindings; a client-safe DTO alone is insufficient. Unknown optional values stay absent. Reserve `case_study`, `product`, `research`, `news`, enabling only `case_study` initially.

A deterministic legacy→annotated mapping fixture fulfills the migration-mapping requirement without a PostgreSQL migration. An optional explicit command may append one new mapped version; it must not rewrite historical versions or silently change current/approval pointers during reads. Schema validation, source authorization and factual review stay distinct.

Existing targeted unit checks ran during this planning turn: canonical content, content structure, pilot projection and chunk metadata **18/18 passed**. These are baseline checks, not OUT-02 acceptance. See the [implementation plan](out-02-publication-content-implementation-plan.md) for the proposed file schema, UI, CLI, tests and migration controls.
