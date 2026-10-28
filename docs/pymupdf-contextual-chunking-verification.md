# PyMuPDF extraction and contextual chunking: verification

Branch `feature/pymupdf-contextual-chunking`, verified 2026-10-28 on Apple Silicon (8 cores),
Python 3.13.16 (uv-managed), PyMuPDF 2.0, Ollama `embeddinggemma-2:740m` (768 dimensions).
Plan: `pymupdf-contextual-chunking-implementation-plan.md`.

## 1. Phase status

| Phase                                  | Status                                        | Evidence                                                                                                                                               |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — D1 run identity, D2 embedding hash | Done                                          | `tests/unit/services/pipeline_identity.spec.ts`                                                                                                        |
| 1 — Environment prepared once          | Done                                          | `bun run python:setup`: 1.3 s first run, 0.11 s re-run (no-op); `node ace verify:pdf-worker`: ready in 270–456 ms                                      |
| 2 — Worker pool and extraction (D3)    | Done                                          | `python/pdf_worker/tests/test_extraction.py`, `tests/unit/services/files_service.spec.ts`                                                              |
| 3 — Structure-aware chunk plan         | Done                                          | `python/pdf_worker/tests/test_chunking.py`, `tests/unit/services/chunking_service.spec.ts`                                                             |
| 4 — Contextual chunking (D4)           | Done                                          | `tests/unit/services/contextualization_service.spec.ts`, `tests/functional/contextual_chunking.spec.ts`, transport test against the Postman simulation |
| 5 — Evaluation                         | Harness done; **production sign-off pending** | §3 below; see §4 for what is still open                                                                                                                |

## 2. Commands and results

```bash
bun run python:setup          # 0.11 s when already prepared
bun run python:test           # 18 passed
node ace verify:pdf-worker    # Worker ready … Python 3.13.16, pymupdf:2.0, protocol 1
npm run typecheck && npm run lint
node ace test                 # 170 passed, 3 skipped (transport tests need the simulation)
node ace eval:retrieval       # §3
```

Against the local Postman simulation (`postman simulation run … --port 4900`), with chat,
embeddings and the contextualizer all pointed at it:

```text
✔ real embedding and chat clients read the local simulation contract
✔ the real contextualizer client reads the local simulation contract
```

The transport test skips unless both the chat and embedding base URLs target the simulation. The
contextualizer transport test also needs `CONTEXTUALIZER=openrouter` pointed at the simulation.

## 3. Retrieval evaluation (synthetic corpus)

`tests/eval/pdf_retrieval.json` has 22 questions over `eval_sites.pdf`, `sections.pdf` and
`tables.pdf`. In `eval_sites.pdf` the paragraphs never name their site; only the section heading
does, and two sites share each page. Real Ollama embeddings were used, ranked by dense plus BM25
retrieval with reciprocal rank fusion, as in production.

```text
| Configuration        | Chunks | Recall@1 | Recall@3 | Recall@5 | Top-1 tokens | Extract/page |
| -------------------- | ------ | -------- | -------- | -------- | ------------ | ------------ |
| pdf-parse (baseline) | 7      | 100%     | 100%     | 100%     | 93           | 33 ms        |
| pymupdf, no context  | 12     | 18%      | 55%      | 77%      | 35           | 129 ms       |
| pymupdf + structural | 12     | 100%     | 100%     | 100%     | 36           | 66 ms        |
```

Reading it honestly:

- **Context is what makes structure-aware chunks retrievable.** Without context, small chunks lose
  the site name and recall@1 drops to 18%. Structural context restores it to 100% at no model
  cost.
- **The baseline ties on recall only because its chunks are whole pages.** Each top hit carries
  about 2.6× more text (93 vs 36 tokens), including the other site on the same page and its
  figures. Containment-based recall rewards that. Generation then receives mixed-site evidence.
- **Speed:** PyMuPDF is ~66 ms/page warm, within the plan's 150 ms gate. The 129 ms row includes
  the first worker start. pdf-parse is faster but yields no headings, tables or figures.
- **LLM tier not measured:** `CONTEXTUALIZER=off` here, and no local chat model is installed. Run
  `CONTEXTUALIZER=ollama CONTEXTUALIZER_MODEL=<model> node ace eval:retrieval` to add a row.
- **Limits:** a 22-question synthetic corpus cannot sign off production. It only shows the
  mechanisms work and where baseline recall is misleading.

## 4. Defects found and fixed during implementation

| Found by                       | Defect                                                                         | Fix                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Fixture `standard-font.pdf`    | Layout labelled a lone line `page-footer`; dropping all furniture lost content | Drop headers/footers only when they repeat across pages or are page numbers  |
| Fixture `tables.pdf`           | `find_tables().extract()` glued words ("Counttime")                            | Rebuild cell text from span geometry                                         |
| Fixture `tables.pdf`           | Borderless tables became prose                                                 | Detect column alignment across lines                                         |
| Fixture `eval_sites.pdf`       | Layout returned a heading box with no text lines (Cardiff section lost)        | Recover text from the page within the box; take heading level from font size |
| Fixture `eval_sites.pdf`       | Ligature "Cardiﬀ" broke search                                                 | NFKC-normalise extracted text                                                |
| Test run                       | Idle worker pipes kept Node alive (tests and commands never exited)            | `unref` idle processes and pipes                                             |
| Splitter                       | Re-split parts could overshoot the budget by a few tokens                      | Split below the budget and re-split survivors                                |
| Contextualizer                 | Title repeated when it is also the H1                                          | Skip a leading section equal to the title                                    |
| Pre-existing (not this branch) | `node ace codegen` writes its files then never exits, on `main` too            | Not fixed; run it with a timeout                                             |

## 5. Still open before PyMuPDF becomes the production default

1. **Licence decision** (plan §8.1): PyMuPDF is AGPL-3.0 unless a commercial licence is bought.
   `PDF_EXTRACTOR` therefore still defaults to `pdf-parse` when `NODE_ENV=production`
   (`config/pdf_worker.ts`).
2. **Real-corpus evaluation** (plan §8.5): rerun `node ace eval:retrieval --corpus=<file>` on
   consented case-study PDFs.
3. **Removal of `pdf-parse`**: deferred until 1 and 2 are done. It remains the fallback path
   with its own regression test.
4. **LLM contextualizer**: implemented and tested with fakes and the Postman mock, but not run
   against a live model. It is off by default.
5. **Deployment** (plan §8.4): production hosts need uv, `bun run python:setup`, and the
   `verify:pdf-worker` check.

## 6. Rollout notes

- `RAG_PIPELINE_VERSION=2` (in `.env.example`) and the new contextualizer identity mark existing
  sources as _outdated_. They are re-prepared through the normal preparation flow.
- Apply migrations `1793196331105_alter_chunks_table` and `1793196332550_alter_processing_runs_table`
  (both have working `down()`; the rollback was verified on the test database).
- Rollback without a deploy: `PDF_EXTRACTOR=pdf-parse` and/or `CONTEXTUALIZER=off`, then restart
  the queue worker.
