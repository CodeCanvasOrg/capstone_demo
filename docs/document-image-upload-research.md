# Document image uploads: research

Date: 2026-10-24. Status: approved and implemented; see [verification](./document-image-upload-verification.md).
Worktree: `/private/tmp/capstone-ui-simple`, branch `fix/ui-simple`.

## Problem and current behavior

The document toolbar has no image insertion control. The installed
`@tiptap/extension-image` is 3.31.4 (manifest range ^3.31.3); the existing
`inertia/components/extensions/image.tsx` already renders and resizes images.
[Tiptap's official documentation](https://tiptap.dev/docs/editor/extensions/nodes/image)
confirms that its image extension renders images but does not upload them.

Adding a file picker alone would lose uploaded images during save:

- `app/services/structured_model_output_service.ts:38` only retains known image
  attributes, currently including `sourceChunkId`, `alt`, and `title`.
- `app/services/documents/chunk_metadata_service.ts:48` removes images without a
  trusted source chunk. `EvidenceService.hydrate` uses this during version saves.
- `UploadService` stores workspace source files privately and queues ingestion;
  using it directly would make insertion depend on OCR/embedding preparation and
  source selection rather than the completion of the upload itself.
- PDF export currently embeds source-chunk images through an authorized stream.

## Options

| Option | Tradeoff | Decision |
| --- | --- | --- |
| Store base64 in document JSON | Inflates every version and conflicts with the 2 MB document limit | Reject |
| Use temporary blob URLs | URLs expire and do not survive reopening | Reject |
| Reuse source ingestion | Couples simple image insertion to background processing and evidence selection | Reject |
| Store document image attachments privately | Requires a small persistence/API addition; supports immediate insertion, version history and export | Adopt |

## Recommendation

Use a document-owned private image attachment, referenced in TipTap by an opaque
`documentImageId`. Resolve its URL on the server after verifying workspace and
document ownership. Keep generated evidence images on their existing source-chunk
path. Reuse the image node, file-size convention, storage driver, session/CSRF
protection, and document policy. No dependency addition is needed.

## Risks and defaults

- Start with PNG and JPEG, up to 10 MB, matching existing upload types and limits.
  Validate actual image signatures on the server, not only extensions/MIME labels.
- Image objects must remain available to older saved versions after removal from
  the current draft. Do not delete an object when its editor node is deleted.
- Failed object/database writes need compensation. Uploads canceled before insertion
  may leave unused attachments; reclamation is deferred to a future retention policy.
- Preserve the existing pending UI changes in this worktree.

The user approved the design and requested the configured S3 bucket for storage.
