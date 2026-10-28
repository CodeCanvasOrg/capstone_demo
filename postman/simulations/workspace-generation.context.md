# Workspace generation simulation

Run locally: `postman simulation run postman/simulations/workspace-generation.sim.yaml --port 4900 --output ndjson`. Use the returned listening addresses for provider base URLs. The repository's OpenRouter mock supports company outline and legacy generation contracts; this is a local contract mock, not a provider-owned mock.

2026-10-27 image-rejection fix: CLI 1.73.0 exited before listening because dataset files under `~/.postman/` were inaccessible. Every member remained silent; no HTTP transport claim is supported. Do not replace this with a live-provider test or bypass filesystem permissions. The separate recovery of the user's failed document is an operational action, not simulation evidence.

The application now sends transient bounded JPEG data URIs for source images and terminates 400/413/422 failures without automatic task retries. Existing HTTP endpoints and canonical response schema are unchanged. Local raster and failure-state tests passed; rerun the simulation when its normal local dataset access is available to verify the SDK transport.

2026-10-27 company templates: the model now receives a trusted Markdown guide and returns ordinary rich-text sections keyed to its outline (`fill_document_outline`). The local mock follows that contract. User template authoring endpoints are removed. HTTP simulation remains unverified until normal CLI dataset access is available.
