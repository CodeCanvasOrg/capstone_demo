import env from '#start/env'

const openRouterApiConfig = {
  apiKey: env.get('OPENROUTER_API_KEY'),
  baseUrl: env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
  model: env.get('OPENROUTER_MODEL') ?? 'openai/gpt-6-luna',
  embeddingModel: env.get('OPENROUTER_EMBEDDING_MODEL') ?? 'perplexity/pplx-embed-v1-4b',
  embeddingDimensions: env.get('RAG_EMBEDDING_DIMENSIONS'),
  pipelineVersion: env.get('RAG_PIPELINE_VERSION'),
  failureMessages: {
    401: 'OpenRouter authentication failed. Check the server API key, restart the server and retry.',
    402: 'OpenRouter has insufficient credits. Add credits to the configured account and retry.',
    403: 'OpenRouter denied this model request. Check the account and model permissions.',
    404: 'The configured OpenRouter model is unavailable. Check the server model setting.',
    429: 'OpenRouter is rate limiting requests. Wait a moment and retry.',
  } as Record<number, string>,
}

export default openRouterApiConfig
