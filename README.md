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

- pdf-parse
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

## RAG processing

The web process stores uploads and schedules durable indexing and generation jobs in Redis. Start
the queue worker alongside the web server with `bun run queue:work`. Set `QUEUE_DRIVER=redis` and
configure `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` in the environment. `QUEUE_DRIVER=sync`
is available for local commands that should not connect to Redis.

Apply the new migrations after confirming the PostgreSQL `vector` extension is available on the
database. The migrations create it when the database role has permission.

Embeddings are configured in `config/embeddings.ts`. By default they come from a local
[Ollama](https://ollama.com) server (`ollama pull embeddinggemma-2:740m`, 768 dimensions) through its
OpenAI-compatible endpoint. Set `EMBEDDING_PROVIDER=openrouter` and `RAG_EMBEDDING_DIMENSIONS=1024`
to use OpenRouter instead. Embeddings of each width get their own HNSW index (768 and 1024 are
indexed); after changing the model or dimensions, retry source preparation so files are re-embedded.
