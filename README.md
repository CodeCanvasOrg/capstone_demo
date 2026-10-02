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
database. The migrations create it when the database role has permission. The embedding contract
uses 1024 dimensions to stay within pgvector's HNSW index limit; change `RAG_EMBEDDING_DIMENSIONS`
only with a matching pgvector schema and embedding request.
