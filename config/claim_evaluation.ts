import openRouterApiConfig from '#config/open_router'

// D-CLAIM-MODEL: pinned model id, never a moving alias. The endpoint is OpenRouter's alpha Decisions
// API, so its contract must be reverified before enabling.
const claimEvaluationConfig = {
  model: 'typesafe/jev-1.13',
  endpoint: 'https://openrouter.ai/api/alpha/decisions',
  apiKey: openRouterApiConfig.apiKey,
  timeoutMs: 30_000,
}

export default claimEvaluationConfig
