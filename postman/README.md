# Local provider transport simulation

The workspace API contract is the endpoint matrix in `docs/workspace-tenancy-implementation-plan.md`, refined by routes, validators, transformers and the HTTP functional tests. No existing Postman workspace binding was found; no shared workspace or collection was created or pushed.

`contracts/openrouter-client-surface.yaml` records only the embedding and structured-chat surface consumed by the installed clients. It is a local test contract, not a complete vendor specification. The default mock supplies synthetic vectors and a synthetic document; it does not establish model quality, provider image retrieval, S3 behavior, or production compatibility.

With Postman CLI dataset support available locally, start the checked-in simulation:

```bash
postman simulation run postman/simulations/workspace-generation.sim.yaml --port 4900 --no-history
```

The simulation uses the path router on port 4900 and its mock on 4901. Run the opt-in transport test against a disposable database; use a dummy API key, never a production key:

```bash
OPENROUTER_BASE_URL=http://127.0.0.1:4900/openrouter/api/v1 \
OPENROUTER_API_KEY=local-synthetic-test-only \
EMBEDDING_PROVIDER=openrouter \
EMBEDDING_BASE_URL=http://127.0.0.1:4900/openrouter/api/v1 \
PORT=3345 node ace test functional
```

Embeddings use their own base URL (`config/embeddings.ts`, local Ollama by default), so the embedding overrides are required for the embedding client to reach the simulation.

All functional tests require `TEST_DB_URL` pointing to a database named `capstone_tenancy_test`, with the migrations applied. They truncate their fixtures. The transport test skips unless both the chat and embedding base URLs exactly match this local simulation. Ordinary tests use controlled provider/storage adapters.

Verification (2026-10-28, Postman CLI 1.73.0): the simulation started on port 4900 and the transport test passed with the command above, with both the embedding and chat clients pointed at the simulation.

Template canonical responses are modeled by the same local mock. `tests/functional/workspace_provider_transport.spec.ts` also exercises the real structured outline adapter against it. No live model request is substituted. See `docs/template-generation-verification.md`.

## Canvas generation

`contracts/canvas-generation.yaml` is the local contract for the portfolio page generation routes of the canvas editor (`docs/portfolio-template-plan.md`), and `collections/canvas-generation.postman_collection.json` has a request and test script for each: generate (defaults, detailed with three entries and no images, invalid options), status, rewrite or add depth to entry 1, rewrite the cover, and the refusal of a sources page. The "change a page's design" route no longer exists: the portfolio has one design per page kind. The mock answers the structured calls of the portfolio pipeline (`plan_portfolio`, `write_portfolio_entry`, `write_portfolio_cover`) with synthetic content, so the pipeline can be driven end to end through the local simulation without a provider key.

The routes need a signed-in session and a document open in the canvas editor, so the collection is run against a local dev server (`CANVAS_EDITOR=pilot CANVAS_GENERATION=on`), with `workspaceId`, `documentId`, `baseVersionId` and `csrfToken` set from a browser session:

```bash
postman collection run postman/collections/canvas-generation.postman_collection.json \
  --env-var workspaceId=<uuid> --env-var documentId=<uuid> --env-var baseVersionId=<uuid> --env-var csrfToken=<token>
```

The same behaviour is covered by `tests/functional/portfolio_generation_http.spec.ts`. The design checks (`node ace portfolio:template:check`) are not HTTP and are not in the collection.
