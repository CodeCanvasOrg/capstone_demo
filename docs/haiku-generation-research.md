# Haiku generation reliability audit

Date: 2026-11-12. Initial investigation snapshot; the subsequent approved repair
and recovery are recorded in the implementation plan's applied verification section.
Documents live in `docs/` because this session makes `.agents/` read-only.

## Observed failure and current state

The supplied `OutputParserException` is a valid JSON object with an invalid outline
shape: `sections[1]` is a paragraph rather than `{ key, content }`. Its first
paragraph also uses `text` directly on a paragraph rather than a nested text node.
The former fails parsing; the latter incorrectly passes the current node schema.

Read-only checks against the configured local database:

- Source run `244e9661-a1d9-4c6d-b5a2-c15d81d6cc40` is ready, pipeline `1`,
  embedding model `perplexity/pplx-embed-v1-4b`, dimensions 1024.
- All nine stored vectors for that run have 1024 dimensions and matching model/version.
- Task `2091cd31-6ea7-4c5c-ba77-86ac80f218e0` has succeeded with two attempts.
- Document `91fb46be-9de5-4655-bae9-4c00e25b13d8` is ready; its current version is
  version 3, ID `7cbab75a-b929-4137-b6b9-55c76e84abb6`, with 25 top-level blocks,
  created at `2026-11-12T08:11:05.617Z`.

This proves persistence and later recovery, not browser rendering or output quality.
The logged failed attempt alone does not establish terminal task failure.

## Installed versions and implementation

Installed packages: `@langchain/openrouter` 0.4.15, `@langchain/openai` 1.6.0,
`@langchain/core` 1.2.13, Zod 4.6.5.

| Finding | Evidence | Consequence |
| --- | --- | --- |
| D1: Structured output is advisory tool calling | `app/services/open_router_service.ts:156`; installed adapter converts to a forced named function | Correctly requests the function, but supplies no `strict` flag or provider parameter requirement |
| D2: Current schema cannot simply become Claude strict output | `app/services/structured_model_output_service.ts:21`; converted schema has recursive `$ref`, numerical constraints and arbitrary mark attributes | Enabling strict mode without redesign risks HTTP 400 errors |
| D3: Parser errors bypass in-call retries | `app/services/open_router_service.ts:367`; `isRetryable` handles network/429/5xx only | Invalid outline immediately exits the provider call; task-level retries may still recover |
| D4: Invalid node semantics pass validation | `app/services/structured_model_output_service.ts:37`; `app/services/documents/content_service.ts:78` preserves paragraphs without children | Paragraph-level `text` is not converted into editable inline text and can render empty |
| D5: Missing outline sections silently pass | `app/services/open_router_service.ts:154` imposes a maximum only; missing sections get fallback paragraphs | A structurally accepted response can omit requested sections; duplicates fail outside in-call validation |
| D6: Limited response diagnostics | Structured calls omit raw results; generation has no explicit output cap | Task errors lack reliable provider/model/finish-reason/usage data needed to distinguish malformed, truncated and refused output |

Revision has an additional outer parser retry loop; outline, freeform and title do
not share that behavior. Moving retries must remove multiplication of retry budgets.

## Reproduction

An offline fetch replacement returned the malformed shape as the
`fill_document_outline` tool's arguments through the installed ChatOpenRouter
adapter. The real LangChain parser raised `OutputParserException`, code
`OUTPUT_PARSING_FAILURE`. Captured request:

```json
{
  "model": "anthropic/claude-haiku-5.5",
  "tool_choice": {"type": "function", "function": {"name": "fill_document_outline"}},
  "strict": null,
  "provider": null,
  "schemaContainsRecursiveReferences": true
}
```

Null here means absent from the wire request. No paid generation or embedding
request was made. A separate `getStructuredOutput().safeParse` check accepted
`{"type":"doc","content":[{"type":"paragraph","text":"A supported fact."}]}`.

## Model and provider compatibility

[Claude's Haiku 5.5 migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide)
says forced tools are supported but skip thinking. It also requires omitting
temperature/top_p/top_k; the current request leaves those unset.

[OpenRouter endpoint metadata](https://openrouter.ai/api/v1/models/anthropic/claude-haiku-5.5/endpoints)
advertises tools and response formatting, but reports `function:false` and
`required:false` in tool-choice capability metadata. This conflicts with Claude's
guide and is not proof that the observed tool call was rejected: the supplied log
contains parsed tool arguments and the task later succeeded. Resolve with a small
transport compatibility probe before choosing a forced-tool production contract.

[Claude strict-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
excludes recursive schemas and certain bounds/arbitrary properties. It also warns
that refusal or output-token exhaustion can still produce unusable output.
[OpenRouter](https://openrouter.ai/docs/guides/features/structured-outputs)
recommends strict schemas plus `provider.require_parameters:true`, while noting
that enforcement varies across endpoints.

## Embeddings

Claude generation and Perplexity embedding are independent. Indexing and query
embedding both use `config/embeddings.ts`; `EmbeddingService` checks vector length
and finite values. Retrieval filters the vector model, version and dimensions,
uses cosine distance and merges lexical ranking within authorized source pins.
The legacy `EmbeddFileService` is not the retrieval path in this logged outline flow.

[Perplexity](https://docs.perplexity.ai/docs/embeddings/quickstart) documents a native
width of 2560 for the 4B model and configurable reduced dimensions. The application's
explicit 1024 request and matching stored width are not a mismatch. Its direct API
uses quantized encodings; that does not establish the OpenRouter adapter's wire
encoding. Inspect an actual embedding response if independently diagnosing transport.
No evidence here warrants changing embedding models, dimensions, or rebuilding vectors.

## Existing test evidence

`node ace test unit --files=tests/unit/open_router_service.spec.ts`: seven passed.
These cover configuration, freeform message/image plumbing and network/timeout
retries. They do not cover malformed outline output or strict wire contracts.
`git diff --check` passed. No runtime generation fix was applied.

## Options and recommendation

1. Retry existing permissive tool output with validation feedback: smallest
   mitigation, but still dependent on probabilistic format compliance.
2. Enable strict on the existing recursive schema: rejected due to documented
   schema incompatibility.
3. Use a bounded, nonrecursive generation contract, strict JSON response format,
   deterministic conversion to TipTap and application validation: recommended.
   Adds an adapter, but removes arbitrary recursive editor JSON from the model task.

Add bounded validation retries immediately, then adopt option 3 without changing
the editor's saved-content contract. Keep embeddings unchanged. Browser display
of the already saved draft and live provider compatibility remain unverified.
