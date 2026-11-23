import env from '#start/env'
import embeddingsConfig from '#config/embeddings'

const openRouterApiConfig = {
  apiKey: env.get('OPENROUTER_API_KEY'),
  baseUrl: env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
  model: env.get('OPENROUTER_MODEL') ?? 'anthropic/claude-haiku-5.5',
  // The canvas pipeline's own models; each falls back to the one before it.
  canvasPlannerModel:
    env.get('CANVAS_PLANNER_MODEL') ?? env.get('OPENROUTER_MODEL') ?? 'anthropic/claude-haiku-5.5',
  canvasWriterModel:
    env.get('CANVAS_WRITER_MODEL') ??
    env.get('CANVAS_PLANNER_MODEL') ??
    env.get('OPENROUTER_MODEL') ??
    'anthropic/claude-haiku-5.5',
  // Kept for existing callers; config/embeddings.ts is the source of truth.
  embeddingModel: embeddingsConfig.model,
  embeddingDimensions: embeddingsConfig.dimensions,
  pipelineVersion: env.get('RAG_PIPELINE_VERSION'),
  // Per-call deadlines. Document generation writes a whole case study as structured JSON from
  // evidence and images and regularly takes 30-110 s; a title is a few words. A timed-out call is
  // retried once, so the worst case (title 2x + document 2x) stays inside the 10-minute job limit.
  timeoutMs: env.get('OPENROUTER_TIMEOUT_MS') ?? 180_000,
  titleTimeoutMs: 60_000,
  // One canvas page or plan: a few thousand tokens of structured prose, so shorter than a whole case study.
  canvasTimeoutMs: env.get('OPENROUTER_TIMEOUT_MS') ?? 120_000,
  images: {
    maxInputBytes: 20 * 1024 * 1024,
    maxInputPixels: 100_000_000,
    maxEdge: 2048,
    maxOutputBytes: 4 * 1024 * 1024,
  },
  failureMessages: {
    400: 'The model rejected the generation request. Check the selected sources and model settings before trying again.',
    413: 'The generation request is too large. Select fewer or smaller sources and try again.',
    422: 'The model could not process the generation input. Check the selected sources and try again.',
    401: 'OpenRouter authentication failed. Check the server API key, restart the server and retry.',
    402: 'OpenRouter has insufficient credits. Add credits to the configured account and retry.',
    403: 'OpenRouter denied this model request. Check the account and model permissions.',
    404: 'The configured OpenRouter model is unavailable. Check the server model setting.',
    429: 'OpenRouter is rate limiting requests. Wait a moment and retry.',
  } as Record<number, string>,
}

export default openRouterApiConfig
