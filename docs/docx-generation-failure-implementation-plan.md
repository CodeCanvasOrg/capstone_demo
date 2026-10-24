# DOCX generation failure implementation plan

Status: approved by the user and implemented on 2026-10-20.

## Decisions and current state

Use the existing file extraction service and xmldom dependency. No endpoint, schema, provider contract, or frontend change is needed. Research evidence is in `docx-generation-failure-research.md`.

| Defect | Location | Fix |
| --- | --- | --- |
| D1 | `app/services/documents/files_service.ts:234` | Parse Mammoth's fragment inside one HTML/body root, retaining all sibling blocks. |
| D2 | `app/jobs/process_file.ts` catch | Log the caught exception with task/run identifiers before existing failure handling. |
| D3 | `app/jobs/generate_document.ts` catch | Log the exception and a general error status, avoiding the unsupported claim that every status came from the provider. |

## Architecture and data model

The existing flow remains upload → source processing → block extraction → embedding → ready source → generation. D1 repairs extraction; D2/D3 improve diagnosis. Existing failed-source and lease/input guards remain intact. No tables, migrations, new services, or external dependencies.

## Implementation and verification

1. Develop in a dedicated worktree based on `main`, following the project isolation rule. If Git writes are blocked by the environment, report the exact limitation rather than claiming a merge.
2. Add regression coverage to the existing FileService unit suite, using real in-memory DOCX fixtures with multiple paragraphs and mixed block types. Verify the tests fail before D1 and pass after it. Include empty content and embedded images if feasible without external OCR/storage.
3. Apply D1 and D2/D3. Keep server diagnostics separate from safe client error strings. Verify extraction errors still reach the existing task failure handling.
4. Run targeted unit tests, `node ace codegen`, `npm run typecheck`, `npm run lint`, relevant generation workflow tests, and `git diff --check`. Use the separate configured test database for database tests. If exercising embedding/generation provider calls, use the existing Postman simulation and inspect its request log; pure DOCX extraction requires no provider request.
5. Integrate the verified fix into `main` if Git permissions allow. Report actual checks and any live provider or runtime behavior not verified.

Acceptance: a real multi-block DOCX no longer triggers HierarchyRequestError; all expected source blocks are retained; job failures retain their original server-side diagnostics; existing generation concurrency and failed-source guards still pass.

## Recovery and risks

Terminal tasks need source preparation followed by a fresh generation request after the worker loads the fix. Do not change task state with ad hoc SQL or bypass source readiness. Live regeneration may consume provider resources and is separate from the offline extraction regression. No automatic retry or data mutation is included in this plan.

## Open questions

None for implementation.

## Implementation results

- D1–D3 are implemented. Three real DOCX fixtures cover mixed sibling blocks, empty content, and an embedded image between paragraphs. All three regression tests failed before the parser fix and passed afterward.
- The isolated worktree passed `QUEUE_DRIVER=sync PORT=3345 node ace test unit functional`: 81 passed, 2 skipped. The opt-in provider transport and local SMTP tests were skipped.
- `npm run typecheck`, `npm run lint`, and `git diff --check` passed. `node ace codegen` generated its files and printed success, but the process remained alive and was interrupted; the test runner independently generated its indexes and exited successfully.
- Postman CLI 1.73.0 could not start the existing simulation because local dataset support cannot access `~/.postman/`. No live provider generation or production storage test was performed.
- The original repository's `.git` directory is read-only in this session. Worktree creation there failed while creating the branch lock. Implementation and verification instead used a dedicated worktree at `/private/tmp/capstone-demo-docx-fix` from a local shared clone, based on `main` at `1aaa1c7`.
- Commit `60e5ec3` in that temporary clone contains the verified implementation and regression fixtures. Its patch was checked and applied to the original `main` working files; those changes are uncommitted in the original repository. No merge or push is claimed.
- The original failed source/generation task rows remain unchanged. Restart the document queue worker to load the fix, request source preparation again, then submit a fresh generation request.
