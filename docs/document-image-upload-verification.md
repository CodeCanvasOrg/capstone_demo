# Document image upload verification

Date: 2026-10-24. Worktree: `/private/tmp/capstone-ui-simple`.

## Delivered behavior

The document toolbar includes **Add image**, opening a file/description dialog.
Users can upload PNG/JPEG images up to 10 MB. Successful uploads insert an image
at the tracked selection and use the existing autosave/version conflict behavior.
Uploads display pending/error states and retain file and description on failure.
Cancel aborts the client request. Pending uploads participate in unsaved-change
tracking. Generation/reveal/conflict state disables new insertion.

The existing `supabase` Drive disk is S3-compatible. Images use the configured
S3 credentials/bucket and a document-scoped object key with private visibility.
Application URLs authorize every read. No public/signed bucket URL or object key
is returned to the client. The new `document_images` table is applied to local
`capstone_tenancy_dev` and disposable `capstone_tenancy_test`. Existing source
ingestion and model generation do not accept document image attachment IDs.

Attachments are resolved from their workspace and document when saving/loading.
Alt text and image layout survive versions. Removed images remain available to
historical versions. PDF preparation reads authorized private bytes and embeds
data URLs using the existing PDF renderer.

## Checks completed

- `node ace codegen`: passed; registered named image upload/read routes with auth
  and workspace middleware.
- `npm run typecheck`: passed, backend and Inertia.
- `npm run lint`: passed.
- `npm run build`: passed, Vite assets and TypeScript server build.
- Unit suite: **35 passed**. Includes image normalization, safe generation schema,
  binary multipart transport, and existing generation/citation/image regressions.
- Functional suite: **80 passed, 2 skipped**. Includes multipart validation,
  cross-workspace/document/guest/revoked-member access, save/reload, historical
  versions, undo-style restoration, PDF byte hydration and failed-write cleanup.
  The two skips are the existing optional provider-transport and SMTP checks.
- `git diff --check`: passed.

The functional run used `PORT=3356` because another listener occupied 3344, and an
isolated Vite cache. It uses the repository's disposable test database and local
Drive fake, so the regular test suite does not write to the development bucket.

## Actual configured S3 verification

Executed the application's configured Drive driver, without substituting storage:

1. Uploaded an image with private visibility and read back identical bytes.
2. An anonymous request to its Supabase public-object URL returned HTTP 400;
   image bytes were not accessible anonymously.
3. Deleted the temporary verification object.

Also ran the actual document-image service against the configured development
database and S3 bucket: created a temporary document in an existing authorized
workspace, uploaded an image, saved a document version, checked its trusted image
URL, streamed identical bytes through the service, then removed the temporary
document and S3 object. Every step and cleanup passed.

## Browser limitations

Two browser regression tests were added for keyboard upload, autosave/reload,
mobile/light/dark rendering, retry retention, invalid files and cancellation.
Their execution was blocked before any browser test ran: Chromium failed its
macOS MachPortRendezvous bootstrap permission check. A subsequent attempt to open
the local preview in the app browser was denied by its origin approval gate.
No alternate browser action was attempted after that denial.

Visual appearance, actual browser file-picker operation, selection behavior and
PDF rendering with the browser engine remain unverified in this session. PDF
image preparation is covered by the functional test; the renderer is unchanged.

## Operational notes

Retain image objects for version history. Unused attachment reclamation is
deferred; canceling after server completion can leave an unused attachment.
Existing unrelated UI and concurrent export changes in this worktree were
preserved. No credentials or environment files were changed.
