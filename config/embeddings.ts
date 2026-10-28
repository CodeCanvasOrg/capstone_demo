import env from '#start/env'

const provider = env.get('EMBEDDING_PROVIDER') ?? 'ollama'

/**
 * Embedding provider used for source indexing and retrieval. Both providers are reached through
 * an OpenAI-compatible `/embeddings` endpoint. Changing the model or dimensions marks existing
 * processing runs stale, so sources are re-prepared with the new embedding space.
 */
const embeddingsConfig = {
  provider,
  baseUrl:
    env.get('EMBEDDING_BASE_URL') ??
    (provider === 'ollama'
      ? 'http://127.0.0.1:11434/v1'
      : (env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1')),
  model:
    env.get('EMBEDDING_MODEL') ??
    (provider === 'ollama'
      ? 'embeddinggemma-2:740m'
      : (env.get('OPENROUTER_EMBEDDING_MODEL') ?? 'perplexity/pplx-embed-v1-4b')),
  dimensions: env.get('RAG_EMBEDDING_DIMENSIONS'),
  // Ollama ignores the key but the OpenAI client requires a non-empty value.
  apiKey: () =>
    provider === 'ollama'
      ? (env.get('EMBEDDING_API_KEY')?.release() ?? 'ollama')
      : (env.get('EMBEDDING_API_KEY') ?? env.get('OPENROUTER_API_KEY')).release(),
}

export default embeddingsConfig
