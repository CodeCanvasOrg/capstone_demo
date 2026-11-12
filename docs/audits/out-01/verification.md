# OUT-01 verification record

12 November 2026. See [audit](../../out-01-generation-export-audit.md) for commands, data provenance and limitations.

| Check | Result | Boundary |
| --- | --- | --- |
| Content structure, chunk metadata, PDF unit tests | 7 passed | PDF browser mocked |
| Document creation, approved export, solo export | 16 passed, 1 failed | Provider/storage/PDF controlled doubles; real separate PostgreSQL |
| Save/review/approval workflow and generation conflicts | 21 passed | Disposable PostgreSQL fixtures |
| Workspace isolation, preparation, retrieval, tasks | 11 passed | Controlled fixtures; no live model evaluation |
| Authenticated real entry editor/HTML preview/evidence | 12 responses, all HTTP 200 | No interactive browser test |
| Current HTML generation through export service | 680,731 bytes | Private preview, with embedded image and font |
| Native PDF generation through export service | E_PDF_UNAVAILABLE | Chromium launch blocked in this environment |
| Historical entry-01 PDF inspection | 4 pages, 594,766 bytes | First page visually inspected; original file copied, not regenerated |
| Working database | Read-only catalog/data capture and service reads | No entry content, approval or task mutations |
| Test database | Separate capstone_tenancy_test created and existing migrations applied | Fixture resets only in disposable database |

Total selected automated cases: **55 passed, 1 failed**. The failed case is `document_creation_generation.spec.ts:162`: creating a project does not create the document that the test expects. `Projects.store` currently saves only the project. Record the accepted product behavior before changing either implementation or test.

Initial environment failures were an occupied port 3344 and a missing configured test database. The recorded runs used port 3397 after creating/migrating that separate database. No failed checks were removed and no application fixes were applied.

Local execution logs/scripts are in `output/out-01/`. They are audit aids, not production runbook entry points or sanitized CI fixtures. Captured samples contain authorized internal evidence and IDs; they must not be treated as public client exports. Credentials and session cookies are not in the captured HTTP report.

Remaining acceptance: actual browser save and owner approval on a disposable copy of the real source-backed entry, then native PDF preview/render/download in a Chromium-capable runtime, with stale-bundle rejection and visual/qualifier inspection. Existing test doubles and historical PDFs cannot supply that proof.

## Test correction follow-up — 12 November 2026

Corrected the stale automatic-case-study expectation to match documented separate project creation. The regression retains rich-brief assertions and verifies project redirects plus zero generated documents/tasks on create and rename. Creation, minimal-creation, approved-export and solo-export suites now pass **21/21**. Earlier failures above remain historical audit evidence; browser/native-PDF acceptance remains outstanding.
