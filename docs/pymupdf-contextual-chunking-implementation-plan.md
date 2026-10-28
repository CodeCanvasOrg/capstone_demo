# PyMuPDF extraction and contextual chunking: implementation plan

Status: **approved and implemented** (2026-10-28). Results and open items: `pymupdf-contextual-chunking-verification.md`.
Research: `pymupdf-contextual-chunking-research.md`. Structure: `pymupdf-contextual-chunking-architecture.md`.

Work happens in a dedicated worktree (per `docs/working-rules.md` and the `feature-pipeline` skill):

```bash
git worktree add -b feature/pymupdf-contextual-chunking ../capstone_demo_pymupdf-contextual-chunking
```

## 1. Decisions

| #   | Decision                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | PDF extraction uses **PyMuPDF 2.0** (`Document.to_json`, layout analysis on). `pdf-parse` stays only as a flagged fallback until Phase 5, then is removed                                                                                                                |
| 2   | Python runs as a **long-lived stdio worker pool** spawned by the Node queue process: JSON lines, no port, no HTTP service                                                                                                                                                |
| 3   | The environment is a **uv project with a committed `uv.lock`**, Python pinned to **3.13**, local `.venv`, bytecode precompiled. It is created once by `bun run python:setup`. Node executes `.venv/bin/python -I` directly and never runs `pip` or `uv run` at call time |
| 4   | **Python owns PDF extraction and structure-aware chunking** (headings, tables, captions, header/footer removal). **Node owns the final token budget** (re-count and re-split)                                                                                            |
| 5   | **Contextual chunking in two tiers**: structural context (title › section path › page) always; LLM context optional via `CONTEXTUALIZER=off\|ollama\|openrouter`                                                                                                         |
| 6   | Context is **stored separately** (`chunks.context`), included in the **embedding input and `content_tsv`**, and **never shown or cited** as evidence                                                                                                                     |
| 7   | OCR stays in Node (tesseract.js) for scanned pages and raster figures in this iteration; PyMuPDF runs with `use_ocr=False` so no system Tesseract is required                                                                                                            |
| 8   | `RAG_PIPELINE_VERSION` goes `1 → 2`; existing PDF runs become stale and are re-prepared through the existing stale-run path                                                                                                                                              |
| 9   | Plan docs live in `docs/` (tracked). `.agents/` is git-ignored, so documents written there would not be reviewable                                                                                                                                                       |

## 2. Current-state audit

### 2.1 What runs today

| Concern                             | Location                                                                                                     | Behaviour                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF extraction                      | `app/services/documents/files_service.ts:168` `processPdf`                                                   | `pdf-parse` `getText()` → one `paragraph` block per page; `getImage()` → raster images saved to drive and OCR'd (`mediaType: 'image/png'` at `:214`) |
| Chunking                            | `app/services/documents/chunking_service.ts`                                                                 | Groups blocks by section path and page; 600-token chunks, 60 overlap, `RecursiveCharacterTextSplitter`; prefixes `Section: …` into `content`         |
| Embedding                           | `app/services/documents/embedding_service.ts:75`                                                             | Rejects inputs over **700 tokens**; batches; retries                                                                                                 |
| Persistence                         | `app/services/documents/processing_service.ts:48-130`                                                        | Writes `document_blocks`, `chunks`, `chunk_blocks`, `chunk_embeddings`; embeds `chunk.content`                                                       |
| Full-text                           | migration `1790936547677_alter_chunks_table.ts:17`                                                           | `content_tsv` generated from `content` only                                                                                                          |
| Run currency ("is this run stale?") | `processing_service.ts:21`, `preparation_service.ts:68`, `readiness_service.ts:84`, `file_transformer.ts:21` | The same three-field comparison is duplicated in **four** places                                                                                     |
| Queue                               | `config/queue.ts:15`                                                                                         | Concurrency 5; `bun run queue:work`                                                                                                                  |

### 2.2 Recommendation → status matrix

| Recommendation (research)            | Status                                               | Reason                                                               |
| ------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------- |
| PyMuPDF 2.0 extraction               | adopted                                              | Structure is required for useful chunks                              |
| Persistent stdio worker pool         | adopted                                              | Removes 0.3 s interpreter/import cost per file; no service to deploy |
| uv lockfile environment              | adopted                                              | One-time, reproducible, about 2.5 s warm                             |
| Structure-aware chunking in Python   | adopted                                              | Layout classes are only available there                              |
| Structural context tier              | adopted                                              | Free; always available; fallback for LLM tier                        |
| LLM context tier                     | adopted (configurable, default `off` until measured) | Cost, privacy and quality must be measured on our PDFs               |
| PyMuPDF built-in OCR                 | deferred                                             | Would add a system Tesseract dependency; tesseract.js already works  |
| Reranking                            | deferred                                             | Separate change; measured after Phase 5                              |
| Docling / Unstructured / VLM parsing | rejected for now                                     | Heavier; PDFs are the only target                                    |
| Late chunking                        | rejected                                             | Embedding API does not expose token vectors                          |

## 3. Defects to fix first (Phase 0)

### D1 — Run-currency logic duplicated in four places

- **Location:** `processing_service.ts:21`, `preparation_service.ts:68`, `readiness_service.ts:84`, `file_transformer.ts:21`.
- **Symptom:** Adding the contextualizer to staleness (Decision 5) means editing four copies. Missing one leaves a run "ready" in one view and "stale" in another.
- **Fix:** One helper, `isCurrentRun(run)` / `currentRunFields()`, in `app/services/documents/pipeline_identity.ts`. Every caller uses it. Add the `contextualizer` field here in Phase 4.

### D2 — Embedding `input_hash` will not describe the embedded text

- **Location:** `processing_service.ts:118` hashes `chunk.content`; `chunking_service.ts:37` computes a second, different `inputHash` that is never persisted.
- **Symptom:** Once context is prepended, the stored hash no longer identifies what was embedded, so cache reuse and audits break.
- **Fix:** A single `embeddingInput(chunk)` (`context + "\n\n" + content`), hashed once, used for both the embedding call and `input_hash`. Delete the unused hash in `ChunkingService`.

### D3 — PDF structure is discarded at extraction

- **Location:** `files_service.ts:179-190`.
- **Symptom:** PDFs never yield heading blocks, so section paths are empty and tables are flattened into prose.
- **Fix:** This is the purpose of Phases 2–3. It is listed here so later phases reference it.

### D4 — Section prefix is baked into `content`

- **Location:** `chunking_service.ts` (`Section: … \n\n` prepended to `content`).
- **Symptom:** Citations and the evidence shown to users include the synthetic prefix, and the prefix counts against the evidence token budget in retrieval.
- **Fix:** Move the prefix into `chunks.context` (structural tier) in Phase 4, so `content` is pure source text.

## 4. Target architecture

```mermaid
flowchart LR
  Q[Queue worker\nprocessing_service] --> FS[FileService.processFile]
  FS -->|.pdf| PW[PdfWorkerService\nNode pool]
  PW <-->|JSON lines over stdio| PY[(python/pdf_worker\nworker.py · PyMuPDF 2.0)]
  PY -->|blocks + chunk plan + figure PNGs in temp dir| PW
  FS -->|figures| OCR[tesseract.js OCR\n+ drive upload]
  FS -->|.docx/.png/...| TS[existing TS extractors]
  FS --> CH[ChunkingService\ntoken guard / re-split]
  CH --> CX[ContextualizationService\nstructural + optional LLM]
  CX --> EM[EmbeddingService\nembed context+content]
  EM --> DB[(chunks.context · content_tsv(context+content)\nchunk_embeddings)]
```

Details, protocol and failure handling: see the architecture document.

## 5. Data model

### 5.1 Migrations (`node ace make:migration …`)

```bash
node ace make:migration add_context_to_chunks --alter --table=chunks
node ace make:migration add_contextualizer_to_processing_runs --alter --table=processing_runs
```

### 5.2 Columns

| Table             | Column           | Type                | Notes                                                                             |
| ----------------- | ---------------- | ------------------- | --------------------------------------------------------------------------------- |
| `chunks`          | `context`        | `text null`         | Derived; never cited                                                              |
| `chunks`          | `context_source` | `varchar(16) null`  | `structural` \| `llm`                                                             |
| `chunks`          | `content_tsv`    | regenerated         | `to_tsvector('english', coalesce(context,'') \|\| ' ' \|\| coalesce(content,''))` |
| `processing_runs` | `contextualizer` | `varchar(255) null` | e.g. `structural:v1`, `openrouter:<model>:v1`; part of run currency (D1)          |
| `processing_runs` | `extractor`      | `varchar(64) null`  | e.g. `pymupdf:2.0`, `pdf-parse:2.4.5`; reported by the worker handshake           |

### 5.3 Regenerating `content_tsv` (the tricky part)

A generated column cannot be altered in place:

```ts
this.defer(async (db) => {
  await db.rawQuery('DROP INDEX IF EXISTS chunks_content_tsv_gin')
  await db.rawQuery('ALTER TABLE chunks DROP COLUMN content_tsv')
  await db.rawQuery(
    "ALTER TABLE chunks ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(context, '') || ' ' || coalesce(content, ''))) STORED"
  )
  await db.rawQuery('CREATE INDEX chunks_content_tsv_gin ON chunks USING gin (content_tsv)')
})
```

`down()` restores the content-only expression. Then run `node ace migration:run` and `node ace codegen`
so `database/schema.ts` picks up the new columns.

## 6. Phases

Each phase leaves the app working and ships behind configuration until Phase 5.

### Phase 0 — Defects D1, D2 (and D4 groundwork)

- `pipeline_identity.ts` with `currentRunFields()` and `isCurrentRun()`. All four call sites use it.
- `embeddingInput(chunk)` used by both `EmbeddingService` and `input_hash`. Unused hash removed.
- **Acceptance:** `node ace test` is green with no behaviour change. A new unit test proves the four call sites agree for a run differing in each field.

### Phase 1 — Python environment, prepared once

- `python/pdf_worker/` containing `pyproject.toml` (`pymupdf==2.0`), `uv.lock`, `.python-version` (`3.13`), `worker.py`, `tests/`.
- `package.json` scripts:
  - `python:setup` → `uv sync --project python/pdf_worker --frozen --compile-bytecode --python 3.13`
  - `python:test` → `uv run --project python/pdf_worker --frozen pytest` (dev only)
- `.gitignore`: `python/pdf_worker/.venv`.
- `node ace verify:pdf-worker`: spawns the worker, performs the `hello` handshake, and prints the Python, PyMuPDF and protocol versions plus the time to ready.
- README "Local setup" gets one added step: `bun run python:setup`.
- **Acceptance:**
  - Fresh clone: `bun run python:setup` succeeds, and a second run is a no-op in under 1 s.
  - `node ace verify:pdf-worker` reports `pymupdf 2.0` and ready in under 1 s.
  - Running the app without the venv fails at worker start with "Run `bun run python:setup`", not a stack trace.

### Phase 2 — Worker pool and PDF extraction (fixes D3, part 1)

- `worker.py`: an `extract` op returning canonical blocks. Each block has a type mapped from `boxclass`, a heading level, page, bbox, `extractionMethod: 'pymupdf-layout'`, and table rows. Figures are written as PNG crops to a per-request temp dir. Page headers and footers are dropped. `use_ocr=False`.
- `app/services/documents/pdf_worker_service.ts`: lazy pool (default size 2, `PDF_WORKER_POOL_SIZE`), handshake, per-request timeout (`PDF_WORKER_TIMEOUT_MS`, default 120 s), crash and restart, recycling after N requests, ordered shutdown on process exit.
- `files_service.ts` `processPdf` dispatches on `PDF_EXTRACTOR=pymupdf|pdf-parse` (default `pymupdf` in dev, `pdf-parse` until Phase 5 sign-off for production). Figures go through the existing drive-upload and OCR path. Pages with no text layer are rendered by the worker and OCR'd by tesseract.js.
- Fixtures in `tests/fixtures/pdf/`: headings and sections, ruled table, two-column, figure with caption, scanned page, standard font (existing), encrypted, corrupt.
- **Acceptance:**
  - `bun run python:test`: the Python unit tests pass for every fixture.
  - `node ace test unit --files=tests/unit/services/files_service.spec.ts`: heading blocks carry levels, the table yields `table_row` blocks, the header/footer text is absent, the scanned page yields OCR text, and corrupt/encrypted files raise a user-safe preparation error.
  - The second PDF processed by a warm worker has no import cost (asserted from the handshake and request timings).

### Phase 3 — Structure-aware chunking in Python (fixes D3, part 2)

- `worker.py` returns a **chunk plan** alongside blocks: ordered groups of block IDs that respect section boundaries. Tables are kept whole up to the budget, otherwise split by rows with the header row repeated. Captions stay with their figure. The target is about 450 tokens, estimated at 4 chars per token.
- `ChunkingService` accepts a chunk plan when present. It re-counts with `countTokens`, re-splits any chunk over the budget, and otherwise behaves as today for non-PDF files.
- Token budget: `content ≤ 520` + `context ≤ 120` + separator stays **under the 700-token embedding cap**.
- **Acceptance:** chunk unit tests show no chunk crossing a top-level section, table chunks start with the header row, and no embedding input exceeds 700 tokens across all fixtures (property-style test).

### Phase 4 — Contextual chunking (fixes D4)

- Migrations from §5. Run currency gains `contextualizer` (via D1's helper).
- `ContextualizationService`:
  - **Structural tier (always):** `"{file title} › {section path} — page {n}"`; moved out of `content`.
  - **LLM tier (`CONTEXTUALIZER=ollama|openrouter`):** the document text comes first (a stable prefix for provider prompt caching), followed by a batch of 8 chunks in one structured call returning `[{chunkId, context}]`, each context at most 100 tokens. Documents over 24k tokens use the section plus neighbouring sections instead of the whole document. `tasks.check(lease)` runs before any disclosure. Provider failures and validation failures (context over the cap; context containing numbers absent from the source) fall back to the structural tier **per chunk**, and the fallback is recorded in run warnings.
  - Config in `config/contextualization.ts` with `CONTEXTUALIZER`, `CONTEXTUALIZER_MODEL`, `CONTEXTUALIZER_BASE_URL` added to `start/env.ts` and `.env.example`.
- `processing_service.ts` embeds `embeddingInput(chunk)` and stores `context` and `context_source`.
- Retrieval and generation still use **`content`** for evidence and citations. `context` only influences ranking.
- `RAG_PIPELINE_VERSION=2`.
- The Postman mock gains a `contextualize_chunks` function, and the transport test covers it.
- **Acceptance:**
  - Functional test: preparing the two-section fixture stores a non-null context on every chunk, `content` has no `Section:` prefix, `content_tsv` matches a term that appears only in the context, and the evidence returned to generation excludes the context.
  - With `CONTEXTUALIZER=off` the run's contextualizer is `structural:v1`. Switching to `openrouter` makes existing runs stale in **all four** views.
  - `OPENROUTER_BASE_URL=<sim> … EMBEDDING_BASE_URL=<sim> node ace test functional --files=tests/functional/workspace_provider_transport.spec.ts` passes.

### Phase 5 — Evaluation, production default, removal of `pdf-parse`

- Evaluation set: 10 to 20 real (non-confidential or consented) PDFs from case-study work, with 3 to 5 questions each and their expected source pages (`tests/eval/pdf_retrieval.json`, outside the default test suites).
- `node ace eval:retrieval` prints recall@5 and recall@20 for four configurations: `pdf-parse`, `pymupdf + structural`, `pymupdf + llm`, plus extraction time per page.
- **Gate:** `pymupdf + structural` ≥ `pdf-parse` on recall@20, and p95 extraction ≤ 150 ms/page warm. The LLM tier is enabled by default only if it beats structural on recall@20 and the per-document cost is accepted.
- Then: `PDF_EXTRACTOR` defaults to `pymupdf` everywhere, `pdf-parse` and its pdf.js font plumbing are removed, and the README and `.env.example` are updated.
- **Acceptance:** the eval report is committed to `docs/pymupdf-contextual-chunking-verification.md`; `bun remove pdf-parse`; full suite green.

## 7. Risks and mitigations

| Risk                                                                  | Mitigation                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| AGPL licence obligations                                              | Owner decision before Phase 5 production default; `pdf-parse` fallback kept until then                                          |
| Library diagnostics corrupt the stdout protocol                       | Worker dups fd 1 → fd 2 at start and replies on a private dup (verified in research)                                            |
| Worker hangs or leaks memory on hostile PDFs                          | Per-request timeout and kill; recycle after N requests; 10 MB upload cap already enforced; temp dir per request, always removed |
| CPU oversubscription (onnxruntime threads × pool × queue concurrency) | Pool size 2 by default; set `OMP_NUM_THREADS` per worker; measure in Phase 5                                                    |
| Layout misclassifies tables/figures                                   | Fixtures plus the eval set; figures still OCR'd, so text is not lost                                                            |
| LLM context invents facts                                             | Never cited; validation and per-chunk structural fallback; default `off` until measured                                         |
| Re-preparation load after pipeline version bump                       | Existing on-demand stale path; documents can still generate from ready runs until they are re-prepared                          |
| Environment missing on a host                                         | Fail fast with a setup instruction; `verify:pdf-worker` in deploy checklist                                                     |

## 8. Open questions

1. **Licence:** is AGPL acceptable for this project, or should a commercial licence be bought? (Must be answered before Phase 5.)
2. **LLM tier provider:** local Ollama (needs a chat model pulled, e.g. a small instruct model) or OpenRouter (whole-document text leaves the machine)? Or both, with Ollama as the default?
3. **Scope:** should contextual chunking also apply to DOCX and image sources? The design is format-agnostic. The recommendation is yes in Phase 4, and it costs one config flag.
4. **Deployment target:** which host runs the queue worker in production? This decides whether to add a Dockerfile or a setup step to the existing deploy.
5. **Evaluation corpus:** can we use real case-study PDFs for Phase 5, and who provides them?

## 9. Verification

Per phase, in the worktree:

```bash
bun run python:setup                        # once; re-runs are no-ops
bun run python:test                         # Python worker unit tests
node ace verify:pdf-worker                  # handshake + versions + time-to-ready
node ace codegen && npm run typecheck && npm run lint && node ace test
```

Phase 4 transport check against the local Postman simulation:

```bash
postman simulation run postman/simulations/workspace-generation.sim.yaml --port 4900 --no-history &
SIM=http://127.0.0.1:4900/openrouter/api/v1
OPENROUTER_BASE_URL=$SIM OPENROUTER_API_KEY=local-synthetic-test-only \
EMBEDDING_PROVIDER=openrouter EMBEDDING_BASE_URL=$SIM CONTEXTUALIZER=openrouter \
PORT=3345 node ace test functional --files=tests/functional/workspace_provider_transport.spec.ts
```

Manual run (user-visible): `bun run dev` and `bun run queue:work`. Upload a multi-section PDF in
**Files**, wait for _Ready_, create a case study from it, and confirm that citations point at the
right pages and show plain source text (no `Section:` prefix and no generated context).
