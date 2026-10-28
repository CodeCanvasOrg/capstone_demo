# PDF extraction with PyMuPDF and contextual chunking: research

Status: research for review (2026-10-28). Companion documents:
`pymupdf-contextual-chunking-implementation-plan.md` and `pymupdf-contextual-chunking-architecture.md`.

## 1. Problem statement and current behaviour

Source preparation (`app/services/documents/processing_service.ts`) turns an uploaded file into
canonical blocks, chunks them, embeds the chunks and stores them for hybrid retrieval (pgvector plus
the `chunks.content_tsv` full-text column).

For PDFs today:

- `FileService.processPdf` (`app/services/documents/files_service.ts:168`) uses `pdf-parse` 2.4.5
  (pdf.js 5.4.296). It emits **one paragraph block per page**. Headings, tables, lists, captions,
  reading order and multi-column layout are all lost.
- Because no heading blocks are produced, `ChunkingService` (`chunking_service.ts`) has no section
  path for PDF content. A chunk is "page N text", split by `RecursiveCharacterTextSplitter` at
  600 tokens with 60 overlap.
- Embedded raster images are OCR'd with tesseract.js. Vector charts and diagrams are invisible.
- A chunk is embedded exactly as stored. A chunk such as "Revenue grew 3% over the previous quarter"
  carries no hint of _which_ company, product or period it belongs to. This is the failure mode
  contextual chunking addresses.

Goal set by the product owner: use **PyMuPDF** for PDF extraction and chunking, add **contextual
chunking**, and run Python as a **local script/worker, not a microservice**. The Python environment
must be **prepared once and reused** — never installed per call — and processing must be fast.

## 2. Options considered

### 2.1 PDF extraction engine

| Option                                                       | Strengths                                                                                                                                                              | Weaknesses                                                        | Verdict                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Keep `pdf-parse` (pdf.js)                                    | Already integrated; pure JS                                                                                                                                            | Page-level text only; no layout, headings or tables               | Rejected: cannot deliver structure                   |
| **PyMuPDF 2.0** (`to_json` / `to_markdown`, layout built in) | Fast MuPDF core; layout classes (`section-header`, `table`, `picture`, `caption`, `list-item`, `page-header/footer`…); header levels; bounding boxes; tables; CPU-only | Second runtime (Python); **AGPL-3.0** licence; 219 MB environment | **Recommended**                                      |
| Docling / Unstructured                                       | Richer document models, DOCX/PPTX too                                                                                                                                  | Heavier models, slower cold start; more than PDFs need now        | Deferred (earlier research kept these as candidates) |
| Vision-language parsing                                      | Best on hard layouts                                                                                                                                                   | Per-page model cost and latency; hallucination risk               | Deferred                                             |

### 2.2 How Node calls Python (no microservice)

| Option                                                         | Per-file overhead                                                          | Complexity | Verdict                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| HTTP microservice                                              | Network hop, separate deploy                                               | High       | Rejected by requirement                               |
| Spawn `python script.py` per file                              | Interpreter start plus `import pymupdf` ≈ 0.3 s, measured                  | Low        | Acceptable fallback                                   |
| `uv run script.py` per file                                    | As above plus environment resolution; can trigger a sync or network access | Low        | Rejected: not deterministic, can install at call time |
| **Long-lived stdio worker pool** (child processes, JSON lines) | ≈ 0 after first start; import and layout model loaded once                 | Medium     | **Recommended**                                       |

A persistent child process is still "just a Python script": no port, no server and no deploy unit.
Node owns its lifecycle.

### 2.3 Preparing the environment once

| Option                                                                                                                                      | Notes                                                                          | Verdict                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| `pip install` at runtime / per call                                                                                                         | Slow, network-dependent, non-reproducible                                      | Rejected                    |
| Global/system Python packages                                                                                                               | Drifts per machine; Homebrew Python here is 3.15                               | Rejected                    |
| **uv project with a lockfile** (`pyproject.toml` + `uv.lock` + `.python-version`) and a project-local `.venv`, created by one setup command | Reproducible; ~2.5 s with a warm cache; Node calls `.venv/bin/python` directly | **Recommended**             |
| Docker image                                                                                                                                | Good for deploys, but the repo has no Docker today                             | Deferred to deployment work |

### 2.4 Contextual chunking technique

| Technique                                                    | What it does                                                                                                                                           | Cost                                                                                   | Verdict                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Structural context**                                       | Prefix each chunk with document title, section path and page (deterministic)                                                                           | Free                                                                                   | **Always on** (baseline tier)               |
| **LLM contextualization** (Anthropic "Contextual Retrieval") | An LLM writes 50–100 tokens situating each chunk in the whole document. The context is prepended before embedding _and_ before BM25/full-text indexing | One LLM pass per document; prompt caching reduces it                                   | **Recommended, configurable** (second tier) |
| Late chunking                                                | Pools token embeddings of the whole document per chunk                                                                                                 | Needs token-level embedding access our OpenAI-compatible embedding API does not expose | Rejected                                    |
| Proposition extraction / RAPTOR / GraphRAG                   | Derived indexes                                                                                                                                        | High                                                                                   | Deferred                                    |

Published result (vendor benchmark, not a promise for our corpus): top-20 retrieval failure fell from
5.7% to 3.7% with contextual embeddings (−35%), to 2.9% when contextual BM25 was added (−49%), and
to 1.9% with reranking (−67%). Prompt caching made the one-off cost about $1.02 per million
document tokens. Our retrieval is already hybrid (dense plus `content_tsv`), so both halves of the
technique apply directly.

## 3. Recommendation

1. **PyMuPDF 2.0 in a long-lived Python stdio worker pool**, owned by the Node queue process.
2. **Environment prepared once** with uv from a committed lockfile, under `python/pdf_worker/.venv`.
   Bytecode is precompiled at setup. Node runs `.venv/bin/python -I` directly, never `uv run` or pip.
3. **Python does PDF extraction and structure-aware chunking.** It uses the layout classes to keep
   headings with their content, keep tables whole (repeating the header row when a table must be
   split), attach captions to figures, and drop page headers and footers. **Node re-validates token
   budgets** with the same tokenizer the embedding path enforces (the 700-token limit in
   `EmbeddingService`).
4. **Contextualization in Node, in two tiers.** Structural context is always applied. LLM context is
   optional, configured with `CONTEXTUALIZER=off|ollama|openrouter`. Python stays offline and holds
   no secrets. Node already owns provider clients, retries, lease guards and the "check before
   disclosing private content" rule.
5. **Context is a derived representation.** It is stored separately (`chunks.context`), used for
   embedding and full-text indexing, and never shown as evidence or cited. That matches the earlier
   research rule that "contextualization … are derived representations, not replacements for source
   evidence".

## 4. Version and compatibility facts (verified 2026-10-28)

Measured in a scratch uv environment on this machine (Apple Silicon, 8 cores). These are not
documentation claims.

| Fact                                             | Value                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PyMuPDF                                          | **2.0**, dual-licensed AGPL-3.0 / Artifex commercial; `requires_python >= 3.11`; wheels for macOS arm64/x86_64, manylinux x86_64/aarch64 and Windows                                                                                        |
| pymupdf4llm                                      | 2.0 is an empty shim; the functionality now ships inside `pymupdf` (`Document.to_markdown/to_json/to_text`). `import pymupdf4llm` still works as a compatibility layer                                                                      |
| Pulled-in dependencies                           | `pymupdf_layout`, `onnxruntime` 1.31, `numpy` 2.5, `networkx`, `protobuf`, `flatbuffers`, `psutil`                                                                                                                                          |
| Environment size                                 | **219 MB**                                                                                                                                                                                                                                  |
| `uv sync` (warm cache)                           | **2.5 s**                                                                                                                                                                                                                                   |
| `import pymupdf`                                 | **0.24 s**                                                                                                                                                                                                                                  |
| `to_json(page_chunks=True)`, layout on, 20 pages | ≈ 1.1 s (≈ **55 ms/page** warm)                                                                                                                                                                                                             |
| `to_markdown(page_chunks=True)`, layout off      | ≈ 0.5 s (≈ 25 ms/page)                                                                                                                                                                                                                      |
| Raw `page.get_text("dict")`                      | ≈ 2 ms/page                                                                                                                                                                                                                                 |
| `to_json` page box fields                        | `boxclass`, `header_level`, `x0..y1`, `textlines/spans` (font, size), `table`, `image`                                                                                                                                                      |
| Layout box classes observed                      | `section-header`, `text`, `picture`, `page-header` (documented: also `table`, `caption`, `title`, `list-item`, `footnote`, `formula`, `page-footer`)                                                                                        |
| OCR                                              | Built-in selective OCR uses system **Tesseract** when present (`/opt/homebrew/bin/tesseract` 5.5.3 here); `use_ocr=False` disables it. RapidOCR is optional                                                                                 |
| stdout                                           | The parser prints diagnostics ("=== Document parser messages ===", RapidOCR warning) **at file-descriptor level**. `contextlib.redirect_stdout` does _not_ capture them. A stdout protocol must dup fd 1 away at startup (verified working) |
| Python on this machine                           | Homebrew 3.15.0 and 3.14.8; uv-managed 3.13.16. Pin **3.13** via `.python-version`                                                                                                                                                          |
| Existing Node side                               | `pdf-parse` 2.4.5 → pdf.js 5.4.296; queue concurrency 5 (`config/queue.ts:15`); embedding input cap 700 tokens (`embedding_service.ts`)                                                                                                     |

## 5. Risks and open questions

1. **Licence (decision needed).** PyMuPDF is AGPL-3.0 unless a commercial licence is bought. If this
   app is offered to users over a network, AGPL obligations may extend to the application. A
   separate-process boundary does not reliably avoid that. This needs an owner decision (and legal
   advice if the product is commercial) before production use. This is not legal advice.
2. **Layout misclassification.** In the probe, a ruled grid drawn with text boxes was classified as
   `picture`, not `table`. Real-world accuracy must be measured on our own sample PDFs (Phase 5).
3. **Contextualization privacy and cost.** The OpenRouter tier sends whole-document text to the chat
   provider. Generation already does that with retrieved excerpts, but this sends more. The Ollama
   tier keeps text local but needs a local chat model (only `embeddinggemma-2:740m` is installed
   today).
4. **Hallucinated context.** LLM context could invent facts. It is never cited, and simple checks
   (length cap; figures must appear in the source) fall back to structural context.
5. **Token-budget drift.** Python cannot use the exact Node tokenizer cheaply. Node re-checks and
   re-splits.
6. **Re-preparation.** Bumping `RAG_PIPELINE_VERSION` marks every existing PDF run stale. Sources are
   re-prepared, and their embeddings and LLM context are recomputed.
7. **CPU contention.** `onnxruntime` uses several threads per worker. The pool size must be measured
   against queue concurrency 5 on the deployment host.
8. **Deployment.** There is no Dockerfile. Production hosts need uv, the Python 3.13 runtime and the
   setup step. Optional system Tesseract is needed only if PyMuPDF OCR is enabled.

## 6. Sources

- PyMuPDF on PyPI (version, licence, Python support): https://pypi.org/project/PyMuPDF/
- pymupdf4llm 2.0 shim notice: https://pypi.org/project/pymupdf4llm/
- PyMuPDF 2.0 consolidation announcement: https://artifex.com/blog/pymupdf-2-0
- PyMuPDF4LLM API (Document methods, page chunks, header detection): https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/api.html
- Anthropic, Contextual Retrieval: https://www.anthropic.com/engineering/contextual-retrieval
- Earlier internal research: `docs/rag-document-processing-research.md` §6–§8 and `docs/rag-implementation-plan.md` §1 and Phase 3–4
