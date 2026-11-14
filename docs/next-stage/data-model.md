# Next-stage incremental data model

> **Closing-state update:** [Implementation overlap at handoff](handoff-snapshot.md) records code and migrations that appeared concurrently. Reuse those files; the opening audit and future scaffold lists are not instructions to recreate them.

14 November 2026 · Proposed schema, not applied SQL. Recheck live migration status/catalog in the implementation environment. Migrations and generated model schema can differ; this document claims only repository schema declarations.

## Existing records to reuse

`users.id`/actor IDs are integers; documents, versions, workspaces, tasks and historical catalog IDs are UUIDs. `document_versions.content` remains accepted TipTap JSON with `attrs.publication`; no new editable publication-body table.

Migration `1792984351178_create_template_generations_table.ts` already declares: `workspace_brand_versions`, `document_templates`, `document_template_versions`, `document_generation_candidates`, `document_validation_reports`, `document_evidence_references`, `document_media_bindings`, `document_claim_reviews`, `document_exports`; document setup/version snapshot fields; review/approval snapshot fields; task stage/checkpoint/telemetry/budgets. Migration `1793006927296...` adds payload/snapshot immutability rules. Inspect triggers before updates/backfills.

Code registry IDs such as `case_study_standard` and `humblebee` are text keys, not the UUID IDs of historical catalog tables. Persist `{id,version,definitionHash}` for code-owned layouts. Workspace brands use a tagged reference resolving an existing immutable UUID row; do not put `humblebee` into a UUID foreign key. One brand resolver handles both sources and snapshots normalized trusted definitions. No second workspace brand table.

## M1 — Document layout selection (TPL-02/05)

Closing-state note: a pending create migration/model/service now exists; the SQL below is the target constraint contract. Reconcile missing fields/constraints in that work, never create the table twice.

The new `document_layouts` name is an explicit integration-test contract. This small mutable record selects presentation independently from accepted content; it does not replace historical semantic-template setup.

```sql
CREATE TABLE document_layouts (
  document_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  template_id varchar(80) NOT NULL,
  template_version integer NOT NULL CHECK (template_version > 0),
  brand_id varchar(80) NOT NULL,
  brand_version integer NOT NULL CHECK (brand_version > 0),
  options jsonb NOT NULL DEFAULT '{}',
  definition_hashes jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  preset_id uuid,
  updated_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, document_id),
  FOREIGN KEY (workspace_id, document_id)
    REFERENCES documents(workspace_id, id) ON DELETE CASCADE,
  CHECK (jsonb_typeof(options) = 'object')
);
```

Add a tagged `brand_reference jsonb` if workspace UUID brands are enabled; validate the workspace/version against `workspace_brand_versions` before acceptance. The simple `brand_id/brand_version` fields remain the code-kit API shape expected by tests. Default resolution returns unsaved revision 0. Compare normalized effective selection first: saving the default unchanged creates no row/revision and does not invalidate approval. Changed save checks `baseRevision` under document lock, increments revision, clears review/approval and audits atomically. First insert race serializes on document, not a nonexistent layout row. Index workspace ID for scoped lists. No historical bulk backfill required; first review/export freezes exact defaults.

## M2 — Workspace presets (TPL-07, P1)

`layout_presets`: UUID `id`; UUID `workspace_id` FK; `name varchar(120)` trimmed/nonempty; pinned template/brand references and definition hashes as M1; `options jsonb`; `revision int >=1`; integer `created_by_id/updated_by_id`; timestamps. Unique `(workspace_id,id)` and unique expression index `(workspace_id,lower(btrim(name)))`. Apply copies values to document selection; preset edits never update documents. Nullable layout `preset_id` uses composite workspace FK `ON DELETE SET NULL` on the reference column, or service nulling before delete, preserving workspace ID. Choose syntax supported by deployed PostgreSQL. Optional archive instead of delete if audit retention requires it. Update API carries `baseRevision`; no lost update between two preset editors.

## M3 — Exact review bundles (APR-01/RND-01B)

Initial recommendation: reuse existing `document_reviews.snapshot_hash` and `document_approvals.snapshot_hash` as authoritative bundle hashes. Closing inspection found a new nullable `bundle_hash` migration; coordinate one authoritative mapping with that author before extending, without deleting their work. Add a typed model/computed `bundleHash` accessor for test/API ergonomics rather than an independently writable duplicate column. These fields are nullable historically; new-flow approvals require a bundle. Never assign an inferred hash to an old approval.

New minimal `document_review_bundles` (no equivalent frozen active record found): UUID id; workspace/document/version IDs; `bundle_hash varchar(64)`; `schema_version smallint`; `payload jsonb`; integer creator; created timestamp. Composite scoped FK to document version; unique `(workspace_id,document_id,bundle_hash)` and `(workspace_id,document_id,id)`. Append-only payload/hash trigger; all referenced assets/definitions content-addressed. Review and approval can add nullable `bundle_id` composite FK, while existing snapshot fields and compatibility remain.

Bundle payload: accepted version/content hash; public projection version/hash; source manifest/hash; template key/version/definition hash; tagged brand reference/version/definition hash; normalized options; renderer version/settings; sorted immutable asset identity/checksum/derivative tuples; required validation report identities/status/rubric. Private reports live separately; no key, internal notes or mutable display filename used as evidence identity. SHA-256 canonical serializer must match server/browser test vectors; array order retained except explicitly unordered asset set.

`document_exports` already exists with required non-null approval ID, so reuse it for approved per-document PDFs. Add nullable bundle reference, bytes/checksum and measured-report reference only if absent. Keep solo export results in their existing task path while D-SOLO is open; do not invent a fake approval to fit this table. Collection artifacts need a separate scoped manifest link (M5), not fake document IDs.

## M4 — Candidate and validation extensions (EDT-03/OUT-05)

Reuse `document_generation_candidates`: immutable payload/base/hash/task, pending/accepted/rejected, accepted version pointer already present. Existing kind constraint allows `section/template_change`; extend additively to `edit/layout_repair` only if these cannot be modeled as section requests. Optional `decided_at`, `decided_by_id`, `decision_mutation_id`, `decision_request_hash`; unique scoped decision key for replay. Extend allowed mutable decision columns in the existing immutability trigger only; payload/base remain immutable. A candidate requires a saved non-null base. Accept through the version transaction; reject leaves saved versions untouched.

Reuse append-only `document_validation_reports`: issues/summary JSONB can carry model/provider/resolved identity, rubric version, claim/evidence hashes, probability distribution when returned, coverage counts, unavailable reasons and timing/usage. Do not repurpose human `document_claim_reviews` as model judgments. `phase/validator_version/input_hash` scope every result. Report status belongs in validated summary (`pending/complete/incomplete/failed`), not absence of rows interpreted as success. Prefer indexes on `(workspace_id,document_id,version_id,phase,input_hash)`; identify duplicate results by report hash and task checkpoint. Preserve history rather than updating append-only reports. A mutable task checkpoint references the current completed report.

## M5 — Collections (PRT-01/04/02)

`portfolio_collections`: UUID id/workspace FK; name varchar(255); integer creator; `status` draft/in_review/approved; nullable current manifest/review/approval IDs; revision >=1; timestamps; unique workspace/id. Exposed `.manifest` and `.manifestHash` are service DTO values joined from current immutable revision, not a second mutable JSON authority.

`portfolio_collection_versions`: UUID id; scoped collection IDs; revision; `manifest jsonb`; `manifest_hash varchar(64)`; schema version; integer actor; timestamp. Unique `(collection_id,revision)` and scoped ID. Manifest stores explicit wrapper cover/about/contact, wrapper brand, renderer/settings/projections; ordered entries with document/version/bundle/template/brand/options/asset hash; groups, selection/curation decisions and target preset. Display names included when they affect output. Keep actual rendered page offsets in render report, not a mutable field in an approved manifest.

`portfolio_collection_entries`: immutable dependency index per manifest (not another editable manifest): workspace/collection_version/document/version/review_bundle IDs, ordinal >=0, group key; unique manifest/ordinal and manifest/document; scoped FKs. If duplicate instances become a requirement, revise this explicit constraint; initial selections are unique documents. Restrict deletion of referenced immutable snapshots or retain tombstones; deleted/inaccessible entries always block publication without exposing private titles. Add indexes for reverse dependency/staleness checks.

`portfolio_collection_reviews` and `portfolio_collection_approvals`: UUID scoped IDs; manifest ID/hash; bundle/dependency hash; integer reviewer/approver; mutation UUID/request hash; timestamp. Append-only. Approval authority only enabled after D-COLLECTION. An internal preview review is not final publication approval. All entry approvals remain independently checked.

`portfolio_collection_exports`: UUID ID; scoped collection/manifest IDs; nullable approval for internal preview only; task UUID unique; audience internal/public; format constrained pdf; bundle hash, private key, checksum, bytes, render report and timestamp. Public audience requires non-null accepted approval. Task link and scoped FKs prevent cross-workspace attachment. Publication/download perform current dependency and access checks; artifact records alone grant nothing.

## M6 — Tasks and credentials (OPS-01)

Reuse task `stage,error_code,checkpoint,telemetry,repair_count,provider_attempts`, lease/token/expiry and existing dispatch table. Current DB permits repair_count 0..1 and provider_attempts 0..6. Initial content-call policy is stricter (four calls, one corrective); enforce it in conditional reservations without relaxing DB constraints. Add only missing `deadline_at`, `credential_reference_id` (opaque string, never secret), and cancellation/credential-wait state support after checking task status constraint. Cumulative evaluator budget must be separately named and included in a total task ceiling before enabling; content budget cannot silently fund dozens of claim checks.

Persist stage events/timing samples in bounded telemetry, current checkpoint in existing JSONB, using token-conditional writes. If collection checkpoint volume warrants a table, use `task_checkpoints(task_id,entry_id,input_hash,stage,payload,result_hash,created_at)` with unique task/entry/input/stage and scoped task FK. Initial single-entry checkpoints need no new table. Index task status/lease expiry/next retry fields according to existing claim/reconcile queries; avoid duplicate indexes.

OPS-02 initially proposes existing protected session/Redis storage keyed by opaque random reference, actor and session binding, TTL/revoke index, server-only secret value. No durable SQL key table or encryption dependency until D-CREDENTIALS is accepted. Store credential references outside immutable task-intent fields when replacement is required: link through a mutable authorized task credential binding rather than rewriting a trigger-protected payload. Restart/expiry produces explicit waiting/reconnect state without resetting budget.

## Migration order, CLI and rollback

1. Read `node ace migration:status`, deployed catalog/constraints/indexes and task payload triggers. Confirm backups and disposable test connection.
2. Add M1 and M3 nullable references before wiring review/export; M2 only with P1 presets; M4 with candidates/quality; M5 with collections; M6 only for verified missing fields. Generate models only for records used by Lucid. Use existing models/schema adapters elsewhere.
3. Dry-run legacy mappings and snapshot creation; report unknown provenance and leave historical approvals unverified. Validate backfilled scope/hash fields before tightening new-flow constraints.
4. Apply to disposable database, verify constraints/triggers/conflicts, then staging. Record exact migration names and catalog diff. No `migration:fresh` on working data.

```sh
node ace make:migration create_document_layouts
node ace make:migration create_document_review_bundles
node ace make:migration create_layout_presets
node ace make:migration extend_publication_candidates --alter
node ace make:migration create_portfolio_collections
node ace make:migration extend_publication_tasks --alter
node ace migration:status
node ace migration:run
node ace schema:dump
node ace codegen
```

These are conditional future commands, not a blanket six-migration requirement. Separate independent deploy steps as needed. Verify `schema:dump` updates the repository's expected generated schema before committing. Keep generated schema and model decorators aligned. All raw SQL inside coordinated writes uses the transaction client.

Rollback application features first and preserve accepted rows/assets/renderer compatibility. No down migration that deletes accepted versions/manifests/approvals. Prefer corrective forward migration after adoption. Retain original source assets; derivative cleanup only deletes unreferenced keys. Audit trigger cascades: historical immutable delete triggers can block workspace/document cascades, so test retention/deletion behavior explicitly rather than dropping those triggers globally.
