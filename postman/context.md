# Template case-study API context

Current task implements the approved first-release Standard, Technical and Vision formats in the existing Adonis/Inertia application. Source of truth: `docs/template-generation-operations.md` endpoint matrix, `start/routes.ts`, Vine validators and generated transformers. User approved implementation; no shared Postman publication requested.

Existing local layout reused; no new workspace binding. The OpenRouter surface spec and local simulation remain under `contracts/`, `mocks/` and `simulations/`. The mock now returns canonical schema responses when the caller requests template content, and preserves its legacy structured response.

Verification: 90 functional tests passed with three opt-in external/transport tests skipped; source/approval/export guarantees use controlled provider/storage adapters. Postman CLI 1.73.0 `simulation run` failed at dataset initialization because `~/.postman/` was inaccessible. No cloud run, real provider call, credentials change or permission bypass attempted. Template transport test is opt-in and refuses to use a non-local mock URL.

Open gates: real HTTP transport via the local mock, live source-image storage, reviewed model quality/latency, browser and PDF visual checks. Detailed evidence and limitations: `docs/template-generation-verification.md`.
