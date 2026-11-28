/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  APP_NAME: Env.schema.string(),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
  DB_URL: Env.schema.string(),
  TEST_DB_URL: Env.schema.string.optional(),

  // Open Router API key
  OPENROUTER_API_KEY: Env.schema.secret(),
  OPENROUTER_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  OPENROUTER_MODEL: Env.schema.string.optional(),
  OPENROUTER_EMBEDDING_MODEL: Env.schema.string.optional(),
  OPENROUTER_TIMEOUT_MS: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the drive package
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['s3'] as const),
  S3_ACCESS_KEY_ID: Env.schema.string(),
  S3_SECRET_ACCESS_KEY: Env.schema.string(),
  S3_REGION: Env.schema.string(),
  S3_BUCKET: Env.schema.string(),
  S3_ENDPOINT: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring @adonisjs/queue
  |----------------------------------------------------------
  */
  QUEUE_DRIVER: Env.schema.enum(['redis', 'sync'] as const),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.secret.optional(),
  REDIS_TLS: Env.schema.boolean.optional(),

  RAG_PIPELINE_VERSION: Env.schema.string(),
  RAG_EMBEDDING_DIMENSIONS: Env.schema.number(),

  GENERATION_FORMAT: Env.schema.enum.optional(['branded', 'legacy'] as const),
  PUBLICATION_LAYOUT: Env.schema.enum.optional(['pilot', 'templates'] as const),
  /** Canvas editor for brochure layouts; off unless `pilot`. */
  CANVAS_EDITOR: Env.schema.enum.optional(['pilot'] as const),
  /** Multi-stage portfolio page generation for the canvas; needs CANVAS_EDITOR=pilot too. */
  CANVAS_GENERATION: Env.schema.enum.optional(['on'] as const),
  /** Model for the portfolio plan; defaults to OPENROUTER_MODEL. */
  CANVAS_PLANNER_MODEL: Env.schema.string.optional(),
  /** Model for canvas page prose; defaults to the planner model. A Sonnet-class model is recommended. */
  CANVAS_WRITER_MODEL: Env.schema.string.optional(),

  // PDF extraction worker (see config/pdf_worker.ts)
  PDF_EXTRACTOR: Env.schema.enum.optional(['pymupdf', 'pdf-parse'] as const),
  PDF_WORKER_PYTHON: Env.schema.string.optional(),
  PDF_WORKER_POOL_SIZE: Env.schema.number.optional(),
  PDF_WORKER_TIMEOUT_MS: Env.schema.number.optional(),
  PDF_WORKER_MAX_REQUESTS: Env.schema.number.optional(),
  PDF_WORKER_THREADS: Env.schema.number.optional(),

  // Contextual chunking (see config/contextualization.ts)
  CONTEXTUALIZER: Env.schema.enum.optional(['off', 'ollama', 'openrouter'] as const),
  CONTEXTUALIZER_MODEL: Env.schema.string.optional(),
  CONTEXTUALIZER_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),

  // Embedding provider (see config/embeddings.ts)
  EMBEDDING_PROVIDER: Env.schema.enum.optional(['ollama', 'openrouter'] as const),
  EMBEDDING_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  EMBEDDING_MODEL: Env.schema.string.optional(),
  EMBEDDING_API_KEY: Env.schema.secret.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  MAIL_MAILER: Env.schema.enum(['smtp'] as const),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_FROM_ADDRESS: Env.schema.string(),
  SMTP_HOST: Env.schema.string(),
  SMTP_PORT: Env.schema.number(),
  SMTP_SECURE: Env.schema.boolean.optional(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.secret.optional(),
})
