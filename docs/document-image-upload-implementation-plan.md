# Document image uploads: implementation plan

Date: 2026-10-24. Status: approved and implemented using the configured S3 bucket.
See [verification](./document-image-upload-verification.md) for checks and browser limitations.
Inputs: [research](./document-image-upload-research.md),
[architecture](./document-image-upload-architecture.md).

## 1. Decisions

- Add an **Add image** toolbar button opening an accessible upload dialog with a
  file field, an image description field, and an Insert image action.
- Accept PNG/JPEG up to 10 MB; insert at the captured editor selection after upload.
- Persist private document attachments without OCR, embedding, or source selection.
- Preserve autosave, conflict recovery, generated citations, version history and PDF.
- Implement inside the user-selected existing worktree; preserve unrelated edits.

## 2. Current-state audit

| Recommendation | Current location | Status |
| --- | --- | --- |
| Reuse rendered image nodes | `inertia/components/extensions/image.tsx` | Adopt |
| Extend compact toolbar | `inertia/components/documents/editor.tsx` | Adopt |
| Preserve trusted image hydration | `app/services/documents/evidence_service.ts` | Extend |
| Reuse source uploads | `app/services/upload_service.ts` | Reject: queues ingestion |
| Keep private export streams | `app/services/exports/document_export_service.ts` | Extend |
| Add pasted images / drag and drop | Editor input handling | Defer: toolbar upload requested |

## 3. Defects to fix first

- **D1:** `structured_model_output_service.ts:38` strips any attachment identifier.
  Add a separate editor-content schema extension; do not let generation invent
  document attachment identifiers.
- **D2:** `chunk_metadata_service.ts:48` removes images without a source chunk.
  Resolve document attachments through a trusted server lookup and preserve only
  validated references. Unknown or foreign attachment references return 422.
- **D3:** PDF image embedding only handles `sourceChunkId`. Extend it to use the
  same authorized attachment stream for uploaded images.

## 4. Target architecture

See [architecture](./document-image-upload-architecture.md). Controllers handle
HTTP; a document-image service owns storage, validation and trusted resolution.

## 5. Data model

Add `document_images`: UUID id, workspace_id, document_id, uploader_id, private
object_key, filename, MIME type, byte_size, created_at, updated_at. Add foreign
keys and a workspace/document lookup index. Enforce document/workspace alignment
using the repository's composite tenancy constraint convention. Never expose the
object key. TipTap image attributes gain `documentImageId`; returned `src` is an
authenticated application URL and is reconstructed on save/read.

## 6. Phases and acceptance criteria

1. **Private attachment API and persistence (D1/D2).** Scaffold model, migration,
   controller, validator, service and tests with Ace. Check membership and document
   edit policy before upload; serialize membership checks with the private write.
   Compensate storage on failed database insert. Confirm valid upload/stream,
   malformed/empty/oversized rejection, and cross-document/workspace rejection.
2. **Content persistence and PDF (D1/D2/D3).** Extend editor normalization and image
   hydration using batched trusted attachment lookups. Preserve existing evidence
   behavior. Confirm save/reload, historical versions, removal/undo, PDF embedding,
   foreign-ID rejection and existing citation tests.
3. **Toolbar and dialog.** Reuse Radix dialog, tokens, feedback components and API
   helper. Retain the chosen file and description on failure; allow retry; prevent
   duplicate requests. Track the selection across document edits while the upload
   is pending, and stop insertion if the editor is destroyed or becomes read-only.
   Disable insertion during generation/reveal and warn about leaving while upload
   is pending. Confirm keyboard operation, cancel, failure recovery, save/reopen,
   mobile layout and both themes in browser checks.

### Proposed API contract

Session authentication, workspace membership, document authorization and existing
CSRF protection apply to both routes.

| Method and path | Request | Success | Failures |
| --- | --- | --- | --- |
| POST `/workspaces/:workspaceId/documents/:documentId/images` | multipart `file` (PNG/JPEG, nonempty, <=10 MB) | 201 `{ data: { id, filename, mime, byteSize, src } }` | 401 unauthenticated; 404 missing/inaccessible resource; 422 invalid image; retryable storage/server failure |
| GET `/workspaces/:workspaceId/documents/:documentId/images/:imageId` | None | 200 private image stream with trusted MIME, nosniff and private/no-store | 401 unauthenticated; 404 missing/inaccessible attachment |

Description/alt text is stored in the version's image node. Nodes must reference
an attachment belonging to this exact document and workspace. Never fetch client
URLs. Uploaded images do not become evidence citations or generation sources.

## 7. Risks and mitigations

Retain old attachment objects for version history. Handle pending insertion and
unmount safely. Test conflict recovery with attachments. Apply the migration only
to an explicitly identified test/development database; never reset a non-test DB.
Use the current worktree's UI patterns, since older skill styling notes may be stale.

## 8. Open questions

None required to implement these defaults. Unused attachment reclamation and
additional formats are deferred.

## 9. Verification

After approval, inspect current Ace help before scaffolding. Expected commands:

```sh
node ace make:model DocumentImage -m
node ace make:controller document_images store show
node ace make:validator document_image
node ace make:service documents/document_image
node ace make:test document_images --suite=functional
node ace codegen
npm run typecheck
npm run lint
node ace test functional --files='tests/functional/document_images.spec.ts'
npm test
npm run build
git diff --check
```

Use an isolated test database for functional/browser tests. Browser acceptance:
open a document, place cursor between paragraphs, Add image, choose PNG/JPEG, add
description, insert, wait for Saved, reload and verify the image is loaded. Repeat
with invalid/oversized files and a simulated failed upload; verify retry/cancel,
readonly generation state, undo, narrow viewport, keyboard focus, light/dark,
historical version rendering and PDF preview/export. Report unavailable runtime,
storage or browser proof separately from static checks.
