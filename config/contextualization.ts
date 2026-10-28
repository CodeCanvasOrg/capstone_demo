import env from '#start/env'

const provider = env.get('CONTEXTUALIZER') ?? 'off'
const VERSION = 'v1'
const model =
  env.get('CONTEXTUALIZER_MODEL') ??
  (provider === 'openrouter' ? (env.get('OPENROUTER_MODEL') ?? 'openai/gpt-6-luna') : '')

/**
 * Contextual chunking. Every chunk gets a structural context (document › section › page). When a
 * provider is configured, an LLM also writes a short sentence situating the chunk in the whole
 * document. Context is embedded and full-text indexed with the chunk but never shown as evidence.
 * Changing the provider or model changes `identity`, which makes existing runs stale.
 */
const contextualizationConfig = {
  provider,
  model,
  baseUrl:
    env.get('CONTEXTUALIZER_BASE_URL') ??
    (provider === 'ollama'
      ? 'http://127.0.0.1:11434/v1'
      : (env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1')),
  apiKey: () =>
    provider === 'ollama'
      ? 'ollama' // Ollama ignores the key; the OpenAI client requires one.
      : env.get('OPENROUTER_API_KEY').release(),
  /** Chunks per structured call; the document prefix is shared so providers can cache it. */
  batchSize: 8,
  /** Upper bound for one generated context sentence. */
  maxContextTokens: 100,
  /** Upper bound for the whole stored context (structural label + generated sentence). */
  maxTotalTokens: 120,
  /** Documents longer than this are sent as an outline plus the batch's own section. */
  documentTokens: 24_000,
  timeoutMs: 60_000,
  identity: provider === 'off' ? `structural:${VERSION}` : `${provider}:${model}:${VERSION}`,
}

export default contextualizationConfig
