import env from '#start/env'

const openRouterApiConfig = {
  apiKey: env.get('OPENROUTER_API_KEY'),
  model: 'openai/gpt-6-luna',
  embeddingModel: 'perplexity/pplx-embed-v1-4b',
  embeddingDimensions: env.get('RAG_EMBEDDING_DIMENSIONS'),
  pipelineVersion: env.get('RAG_PIPELINE_VERSION'),
}

export default openRouterApiConfig
