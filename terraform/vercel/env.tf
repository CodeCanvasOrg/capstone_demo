# Environment shared by the Vercel web functions and the Railway worker.
# Names match .env.example / start/env.ts; see .env.production.example at the repo root.
locals {
  app_url = var.domain_name != "" ? "https://${var.domain_name}" : "https://${var.project_name}.vercel.app"
  app_key = var.app_key != "" ? var.app_key : random_password.app_key.result

  plain_env = merge({
    NODE_ENV       = "production"
    HOST           = "0.0.0.0"
    PORT           = "3333"
    TZ             = "UTC"
    LOG_LEVEL      = var.log_level
    APP_NAME       = var.app_name
    APP_URL        = local.app_url
    SESSION_DRIVER = "cookie"

    # Individual DB_* values are required by start/env.ts; the app connects with DB_URL.
    DB_HOST     = neon_project.main.database_host
    DB_PORT     = "5432"
    DB_USER     = neon_project.main.database_user
    DB_DATABASE = neon_project.main.database_name

    # Neon Object Storage through the app's S3 driver (path-style).
    DRIVE_DISK  = "s3"
    S3_REGION   = local.neon_storage.region
    S3_BUCKET   = var.uploads_bucket_name
    S3_ENDPOINT = local.neon_storage.s3_endpoint

    QUEUE_DRIVER = "redis"
    REDIS_HOST   = upstash_redis_database.main.endpoint
    REDIS_PORT   = tostring(upstash_redis_database.main.port)
    REDIS_TLS    = "true"

    OPENROUTER_MODEL           = var.openrouter_model
    OPENROUTER_EMBEDDING_MODEL = var.openrouter_embedding_model
    EMBEDDING_PROVIDER         = "openrouter"
    RAG_PIPELINE_VERSION       = var.rag_pipeline_version
    RAG_EMBEDDING_DIMENSIONS   = tostring(var.rag_embedding_dimensions)
    CONTEXTUALIZER             = "off"
    GENERATION_FORMAT          = var.generation_format

    MAIL_MAILER       = "smtp"
    MAIL_FROM_NAME    = var.mail_from_name
    MAIL_FROM_ADDRESS = var.mail_from_address
    SMTP_HOST         = var.smtp_host
    SMTP_PORT         = tostring(var.smtp_port)
    SMTP_SECURE       = tostring(var.smtp_secure)
    SMTP_USERNAME     = var.smtp_username
  }, var.extra_env)

  secret_env = merge({
    APP_KEY              = local.app_key
    DB_PASSWORD          = neon_project.main.database_password
    REDIS_PASSWORD       = upstash_redis_database.main.password
    OPENROUTER_API_KEY   = var.openrouter_api_key
    S3_ACCESS_KEY_ID     = restapi_object.storage_credential.id
    S3_SECRET_ACCESS_KEY = local.storage_credential.s3_secret_access_key
  }, var.smtp_password != "" ? { SMTP_PASSWORD = var.smtp_password } : {})

  # Vercel reserves some names (https://vercel.link/reserved-env-variable); its runtime is UTC already.
  vercel_reserved_env = ["TZ", "AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"]

  web_env = merge({ for k, v in local.plain_env : k => v if !contains(local.vercel_reserved_env, k) }, {
    # The Vercel build has no Python, so PyMuPDF is unavailable there.
    PDF_EXTRACTOR = "pdf-parse"
  })
  web_secret_env = merge(local.secret_env, { DB_URL = local.db_url_pooled })

  worker_env = merge(local.plain_env, local.secret_env, {
    DB_URL        = local.db_url_direct
    PDF_EXTRACTOR = var.worker_pdf_extractor
    APP_ROLE      = "worker" # docker/entrypoint.sh runs `node ace queue:work --queue=documents`
  })
}
