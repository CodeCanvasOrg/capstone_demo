# Generation image rejection fix

## Research

On 2026-10-27 the configured provider rejected generation with HTTP 400: one source image required 44,180 processing patches, exceeding its 30,000 limit. Both template and legacy retrieval sent original storage images directly. The task runner retried the permanent error three times and showed a generic message.

Use server-generated, bounded JPEG previews for model input. Preserve original bytes, evidence IDs, source locators, and exported images. Prompt-only instructions cannot change provider image decoding. Dropping visual evidence would weaken the requested case study. Sharp supplies bounded decoding and aspect-preserving resizing; no image processing dependency was previously declared directly. See [constructor limits](https://sharp.pixelplumbing.com/api-constructor/) and [resize options](https://sharp.pixelplumbing.com/api-resize/).

## Implementation plan and architecture

1. Add Sharp through Ace; generate a shared model-image service and tests through Ace.
2. Authorized retrieval / template orchestration → bounded private storage stream → image service → ephemeral JPEG data URI → existing OpenRouter adapter. Check the task lease before and after image processing. Do not persist data URIs or sign original images for model input.
3. Limit input bytes/pixels and output dimensions/bytes. Reject malformed or excessive input with a safe actionable error. Keep `none` policy free of image reads.
4. Treat provider 400/413/422 and invalid images as terminal failures; preserve fresh-request retry semantics.
5. Test real raster resizing, invalid inputs, lease guards, workspace boundaries, provider payloads and terminal error classification. Run codegen, typecheck, lint and build. Attempt existing local Postman simulation; report environmental restrictions separately.
6. Integrate only verified changed files into the active checkout and verify runtime image preparation for affected sources. No database migration or route changes required.

## Verification

Pending implementation. Existing failed task records will not be rewritten. Live provider success and browser success must be reported separately from local tests.

## Verified implementation (2026-10-27)

- Sharp 0.35.5 installed with `TMPDIR=/private/tmp BUN_INSTALL_CACHE_DIR=/private/tmp/capstone-bun-cache node ace add sharp --package-manager bun --verbose`. It has no Adonis configure hook. Initial install hit an unwritable default temporary directory; project dependency installation succeeded using the permitted temporary directory.
- Input limit: 20 MiB / 100 million pixels. Output: JPEG, quality 85, longest edge 2048, no enlargement, white transparency background, maximum 4 MiB. Only JPEG/PNG/WebP/GIF raster inputs accepted; animated input uses its first frame. Original evidence storage remains unchanged.
- Actual affected source images were privately read after membership/evidence checks: 6000×7500 → 1638×2048 (582,842 bytes); 1430×949 → 1430×949 (76,473 bytes); two 2700×1500 images → 2048×1138 (163,293 and 168,744 bytes).
- `QUEUE_DRIVER=sync PORT=3345 node ace test unit functional`: **139 passed, 4 skipped** on the isolated tenancy test database. Includes real raster decoding/resizing, stream byte bounds, no enlargement, corrupt/oversized/unsupported input rejection, authorization guards, no-images storage exclusion, source isolation, and permanent failure state transitions. Provider adapters in existing tests are controlled; this does not establish real HTTP transport.
- `node ace codegen` generated seven indexes. Type checking, ESLint, and production build passed.
- Existing Postman simulation failed before listening: local dataset access under `~/.postman/` was denied. No mock traffic occurred. No permission bypass or cloud publication attempted.
- Fourteen checked files were integrated into the active checkout after matching each existing file against the worktree baseline. The running app answers `/login` with HTTP 200. No migrations were necessary.
- A fresh recovery request for the originally failed document was started through `GenerationService.request`, using its original actor and current workspace authorization. Historical terminal tasks remain untouched. Provider result pending below.

## Follow-up: template validation

The operational retry passed image handling but failed semantic validation after one repair. Inspection found a deterministic contract mismatch: the validator rejected “outcomes have not been measured,” although the generation instructions and repair message explicitly ask for that wording. Its regular expression recognized only “not measured,” “not yet measured,” or “not evaluated.” Fix the grammar variants without weakening the unmeasured-outcome requirement. Add regression coverage for the instructed wording and keep negative examples failing. Preserve bounded, non-content validation diagnostics in task telemetry so future failures identify their actual constraint instead of hiding it behind the generic repair message. No extra repair or provider budget is introduced.

- Follow-up full suite: **145 passed, 4 skipped**. Template-generation group rerun after adding telemetry assertions: **3 passed**. Type checking, lint and build passed after the validation changes.
- The first operational recovery ended after two provider calls with the generic semantic-validation failure (no version published). A second fresh request uses the grammar fix and bounded validation diagnostics; it does not modify prior failed task records.

The second recovery's diagnostics identified the remaining blocker as cross-section evidence citations on both initial and repaired drafts. The generation validator returned early with a generic message, hiding the offending blocks and any other constraint failures. It now reports exact section/block/citation locations together with all other semantic blockers, and the prompt places allowed section names beside each evidence item. Evidence authorization and validation remain strict; the application never silently substitutes citations or accepts invalid drafts. A regression proves one repair receives evidence, word-length and unmeasured-outcome issues together and publishes only the corrected result.

- Prompt identity is now `template-2`, configured once and pinned in task/version snapshots; historical prompt snapshots remain unchanged.
- Final automated suite: **146 passed, 4 skipped** on the disposable test database. A fresh operational request using the improved evidence instructions is pending final publication verification.

## Final operational result

The affected case study `0fc86c9c-f77c-49b5-8f09-c7e06f0f14ce` now has a saved draft. Fresh task `3a509c4d-7629-45ca-96c0-19f72763f25b` succeeded with one task attempt, two real provider calls and one semantic repair. Repair diagnostics were empty on the corrected result. Document state is `ready`, current version `df5c5ca1-b94a-4916-94cd-9f61679abaa2`. Failed tasks retain their original terminal history. This verifies actual source storage, image preparation, retrieval, provider response, validation and version publication for the user's document. It does not imply owner review/approval, browser interaction or PDF visual verification.

Final type checking, lint and production build passed. Runtime/test files in the active checkout were compared byte-for-byte with the verified worktree. Temporary diagnostic/recovery entrypoints were removed from the repository. The Postman mock transport restriction remains separately documented; the real recovery is operational evidence, not a mock simulation result.
