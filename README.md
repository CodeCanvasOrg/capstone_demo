# Project Demo

## Getting Started

Set up and run the project with the helper script:

```bash
./bin/run-dev.sh
```

The script will:

1. Check for [Bun](https://bun.com) and install it if missing.
2. Install project dependencies with `bun install`.
3. Start the development server with `bun run dev`.

If the script is not executable, run it with `bash bin/run-dev.sh` (or make it executable first with `chmod +x bin/run-dev.sh`).

Before running, copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

## Projected Scope

- Basic auth behaviour
- AI/RAG Pipeline
- Export document to PDF

## Dependencies

### Core

- Adonis
- TypeScript
- React
- PostgreSQL (Supabase)
- pgvector
- Zod

## Authentication

- Adonis Auth
- bcrypt — password hashing

### AI / RAG

- LangChain
- LangGraph
- @langchain/openai
- @langchain/textsplitters

### Rich Text Editor

- @tiptap/react
- @tiptap/pm
- @tiptap/starter-kit
- @tiptap/extension-placeholder
- @tiptap/extension-link
- @tiptap/extension-underline

### Document Processing

- PyMuPDF 2.0 (Python worker, see "PDF extraction worker" below)
- pdf-parse (fallback until the PyMuPDF rollout is signed off)
- mammoth
- unified
- remark-parse
- remark-rehype

### OCR

- tesseract.js (To confirm)

### File Storage

- S3-compatible object storage

### PDF Export

- playwright

### UI

- Tailwind CSS
- shadcn/ui

## PDF extraction worker

PDFs are extracted and chunked by PyMuPDF in a pool of long-lived Python processes started by the
queue worker (no separate service). The environment is created once from `python/pdf_worker/uv.lock`
and reused; nothing is installed when a PDF is processed.

```bash
bun run python:setup        # once per checkout (needs uv); re-running is a no-op
node ace verify:pdf-worker  # starts a worker and prints Python / PyMuPDF versions
bun run python:test         # worker tests
```

`PDF_EXTRACTOR=pymupdf|pdf-parse` selects the extractor (default: `pymupdf`, or `pdf-parse` in
production until the rollout is signed off). `PDF_WORKER_POOL_SIZE`, `PDF_WORKER_TIMEOUT_MS`,
`PDF_WORKER_MAX_REQUESTS` and `PDF_WORKER_THREADS` tune the pool. Design:
`docs/pymupdf-contextual-chunking-architecture.md`.

## Contextual chunking

Every chunk stores a `context` that situates it in its document. The structural context
(`Title › Section › Subsection — page N`) is always written and costs nothing. Set
`CONTEXTUALIZER=ollama` (with `CONTEXTUALIZER_MODEL`, a local chat model) or
`CONTEXTUALIZER=openrouter` to also have an LLM add one or two sentences per chunk; the
document text is sent once per batch of 8 chunks as a shared prefix. Generated sentences that
are too long or contain figures absent from the document fall back to the structural context.

Context is embedded and full-text indexed together with the chunk (`chunks.content_tsv`) but is
never shown as evidence or cited: generation receives the source text with its section label.
Changing the contextualizer, like changing the embedding model or `RAG_PIPELINE_VERSION`,
marks existing sources for re-preparation.

## RAG processing

The web process stores uploads and schedules durable indexing and generation jobs in Redis. Start
the queue worker alongside the web server with `bun run queue:work`. Set `QUEUE_DRIVER=redis` and
configure `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` in the environment. `QUEUE_DRIVER=sync`
is available for local commands that should not connect to Redis.

Apply the new migrations after confirming the PostgreSQL `vector` extension is available on the
database. The migrations create it when the database role has permission.

Embeddings are configured in `config/embeddings.ts`. By default they come from OpenRouter
(`OPENROUTER_EMBEDDING_MODEL`, `RAG_EMBEDDING_DIMENSIONS=1024`). Set `EMBEDDING_PROVIDER=ollama` and
`RAG_EMBEDDING_DIMENSIONS=768` to use a local [Ollama](https://ollama.com) server
(`ollama pull embeddinggemma-2:740m`) through its OpenAI-compatible endpoint instead. Embeddings of each width get their own HNSW index (768 and 1024 are
indexed); after changing the model or dimensions, retry source preparation so files are re-embedded.
