import env from '#start/env'

const openRouterApiConfig = {
  apiKey: env.get('OPENROUTER_API_KEY'),
  model: 'openai/gpt-6-luna',
  embeddingModel: 'perplexity/pplx-embed-v1-4b',
}

export default openRouterApiConfig
