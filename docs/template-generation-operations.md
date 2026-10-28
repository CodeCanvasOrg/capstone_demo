> Historical implementation, superseded by [Company document templates](document-outline-templates-plan.md). Retained as a record; its canonical workflow and commands are no longer active.

# Template case-study operations

The first release implements Standard, Technical and Vision case studies. Create case study shows these choices directly beneath the brief and source controls. Clicking a template saves a draft; generation starts explicitly from the editor. Existing documents keep their legacy editor and export policy.

## Installation and rollback

Apply only the pending additive migrations, then seed only the template catalog:

```sh
node ace migration:status
node ace migration:run --force
node ace db:seed --files=database/seeders/document_template_seeder.ts
node ace templates:audit
```

Do not use `migration:fresh`, reset the development database or run unrelated seeders. The catalog seed uses an advisory lock and content hashes; identical definitions are a no-op and changed definitions receive a new immutable version. Published definitions and canonical history cannot be rewritten or deleted.

`config/templates.ts` contains the evidence, image, concurrency, provider and semantic-repair budgets. Hard database/schema caps still apply: at most one semantic repair, six provider attempts and four images. Raise those only through a reviewed schema/contract change.

Local development enables the feature by default. Production requires both `TEMPLATE_ENABLED=true` and the workspace UUID in comma-separated `TEMPLATE_WORKSPACES`. Keep production disabled until the verification report's release gates are met. Set `TEMPLATE_ENABLED=false` and restart both web and queue processes to roll back new creation/generation. Existing canonical versions remain editable, reviewable and exportable through their exact snapshot rules. Do not roll back the schema after canonical data exists.

Restart the existing web and document queue processes after installation. The queue is the existing `documents` queue:

```sh
npm run dev
npm run queue:work
```

## Reviewed brand content

Public final output requires a published brand version. Internal previews work without a brand. No company contacts or marketing claims are fabricated. A workspace owner supplies reviewed JSON with `name` and optional `description`, HTTPS `contactUrl` and `cta`:

```sh
node ace templates:publish-brand --workspace=<workspace-uuid> --actor=<owner-user-id> --file=/absolute/path/reviewed-brand.json
```

The command verifies active ownership and publishes a new immutable version, or returns the existing identical version. Select it in output settings; after content exists, accept the template-change proposal, review and approve the resulting snapshot. Changing brand, audience or image policy does not change historical approvals.

## Authoring and recovery

1. Write a brief, select source files, project stage and image policy, then choose Standard, Technical or Vision.
2. Correct the brief or sources in the editor and save those inputs before generation. Unprocessed/failed sources must be prepared first.
3. Generate. Tasks expose safe stages and preserve the previous saved version if generation fails. Retry with a new request after resolving the reported problem.
4. Edit canonical paragraphs, lists, capability groups, metric/comparison tables, resource links and source images. Numerical values are strings so precision and units survive editing/export.
5. Review each saved claim against its evidence, or explicitly accept a user-supplied assertion with a reason. Source citation alone is not factual verification. Image approval includes the exact source, caption, alt text and public disposition.
6. Submit the exact version, acknowledge its warnings, then approve as the document owner or workspace owner. Solo template documents also need approval. Other members can edit and submit.
7. Export the selected approved version as HTML or PDF. Historical approvals remain usable after new drafts; explicit revocation or unavailable source/access blocks delivery.

Section regeneration creates a separate proposal. Compare before/after, then accept or reject it. Acceptance requires its exact base version and input revisions. A stale proposal returns 409 and preserves newer content. Template changes explicitly list content omitted by the target; choosing no images removes image blocks and captions from that proposal.

Save, generation, acceptance, review and export requests retain mutation UUIDs for uncertain-response replay. Reusing a UUID with different payloads returns 409. On conflicts, preserve local edits and compare with the current saved version. Do not silently overwrite another member's work.

## API contract

All paths below begin `/workspaces/:workspaceId`, require the existing session and active membership, and require CSRF for mutations. Cross-workspace resources return 404. Owner-only actions return 403 for ordinary members. Shape errors return 422; stale versions, exhausted repair, unavailable evidence and workflow conflicts return 409.

| Method | Path                                                               | Request / result                                                               |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| GET    | `/templates`                                                       | Published selectable catalog, version IDs, hashes and ordered definitions      |
| GET    | `/templates/:templateId/versions/:versionId`                       | Exact scoped published definition                                              |
| POST   | `/documents`                                                       | Existing brief/files plus optional `templateSetup`; redirects to saved draft   |
| PUT    | `/documents/:documentId/setup`                                     | Setup plus `setupRevision`; only before first version                          |
| POST   | `/documents/:documentId/generation`                                | `baseVersionId`, `mutationId`; task ID/status                                  |
| POST   | `/documents/:documentId/versions`                                  | `baseVersionId`, canonical `content`, `mutationId`; saved version              |
| POST   | `/documents/:documentId/sections/:sectionKey/regenerate`           | Exact base + mutation UUID; task producing candidate                           |
| POST   | `/documents/:documentId/template-change`                           | Setup, base and mutation UUID; candidate ID                                    |
| GET    | `/documents/:documentId/candidates/:candidateId`                   | Safe canonical proposal, base, omissions and state                             |
| POST   | `/documents/:documentId/candidates/:candidateId/accept`            | Base and mutation UUID; new version ID                                         |
| POST   | `/documents/:documentId/candidates/:candidateId/reject`            | Reject pending proposal                                                        |
| GET    | `/documents/:documentId/versions/:versionId/validation`            | Version-scoped report with blocking/warning issues                             |
| POST   | `/documents/:documentId/versions/:versionId/claim-reviews`         | Claim/evidence hashes, decision, reason, mutation UUID; owner only             |
| GET    | `/documents/:documentId/versions/:versionId/evidence/:referenceId` | Safe source text/label; `referenceId` is a chunk ID in this version's manifest |
| POST   | `/documents/:documentId/reviews`                                   | Exact base and mutation UUID                                                   |
| POST   | `/documents/:documentId/approvals`                                 | Exact base, review ID, warning hashes, mutation UUID; owner only               |
| POST   | `/documents/:documentId/approvals/:approvalId/revoke`              | Reason; owner only, idempotent                                                 |
| GET    | `/documents/:documentId/versions/:versionId/preview/:format`       | Watermarked draft HTML/PDF, private no-store                                   |
| POST   | `/documents/:documentId/versions/:versionId/exports`               | Approval ID, `html` or `pdf`, mutation UUID; task                              |
| GET    | `/documents/:documentId/exports/:taskId/download`                  | Authorized private approved artifact                                           |

`templateSetup` contains `templateVersionId`, `language: en`, `stage`, `imagePolicy`, `imageChunkIds`, `audience`, nullable `brandVersionId`. Canonical version 1 and the seven block contracts are defined in `shared/templates/content.ts`; the frontend consumes generated transformer types. The existing task status, metadata and source-selection routes are reused. `node ace list:routes` is the authoritative installed route inventory.

Rendering uses an immutable canonical/template/brand/source/configuration snapshot and embedded fonts. Export records contain a checksum and private object key; public output contains neither storage keys nor claim/review diagnostics. Rendering uploads outside the publication transaction, then rechecks approval and access before publishing. Revocation during upload removes the staged object and prevents a new export record. Crash-orphan cleanup remains an operational storage-retention concern; a crash cannot publish an unapproved record.
