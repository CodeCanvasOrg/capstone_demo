# Local provider transport simulation

The workspace API contract is the endpoint matrix in `docs/workspace-tenancy-implementation-plan.md`, refined by routes, validators, transformers and the HTTP functional tests. No existing Postman workspace binding was found; no shared workspace or collection was created or pushed.

`contracts/openrouter-client-surface.yaml` records only the embedding and structured-chat surface consumed by the installed clients. It is a local test contract, not a complete vendor specification. The default mock supplies synthetic vectors and a synthetic document; it does not establish model quality, provider image retrieval, S3 behavior, or production compatibility.

With Postman CLI dataset support available locally, start the checked-in simulation:

```bash
postman simulate start postman/simulations/workspace-generation.sim.yaml
```

The simulation uses the path router on port 4900 and its mock on 4901. Run the opt-in transport test against a disposable database; use a dummy API key, never a production key:

```bash
OPENROUTER_BASE_URL=http://127.0.0.1:4900/openrouter/api/v1 \
OPENROUTER_API_KEY=local-synthetic-test-only \
PORT=3345 node ace test functional
```

All functional tests require `TEST_DB_URL` pointing to a database named `capstone_tenancy_test`, with the migrations applied. They truncate their fixtures. The transport test skips unless the base URL exactly matches this local simulation. Ordinary tests use controlled provider/storage adapters.

Verification in this session: simulation startup failed because the CLI could not access dataset files under `~/.postman/`. The real client-to-mock transport test therefore remains skipped. No claim is made that it passed. The fixture can be rerun in an environment with that permission; do not work around it by changing the user's home directory or using live services.
