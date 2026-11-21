# ------------------------------------------------------------------ general
variable "project_name" {
  description = "Used to name the Vercel project, Neon project, Upstash DB, Railway project and S3 bucket."
  type        = string
  default     = "capstone"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "github_repo" {
  description = "GitHub repository as \"owner/name\". Vercel and Railway build from it; both GitHub apps must have access."
  type        = string
}

variable "production_branch" {
  type    = string
  default = "main"
}

# ------------------------------------------------------------------ Vercel (web)
variable "vercel_team" {
  description = "Vercel team slug or ID. Empty = personal account."
  type        = string
  default     = ""
}

variable "vercel_region" {
  description = "Function region. Keep it next to the database (iad1 = us-east-1)."
  type        = string
  default     = "iad1"
}

variable "domain_name" {
  description = "Custom domain for the app (e.g. app.example.com). Empty = use the project's .vercel.app domain."
  type        = string
  default     = ""
}

variable "deploy_on_apply" {
  description = "Create a production deployment of production_branch after env vars are set. Later deploys happen on git push."
  type        = bool
  default     = true
}

# ------------------------------------------------------------------ Neon (Postgres + pgvector + Object Storage)
variable "neon_api_key" {
  description = "Neon API key (set TF_VAR_neon_api_key). Used by the Neon provider and for the Object Storage REST calls."
  type        = string
  sensitive   = true
}

variable "neon_region" {
  type    = string
  default = "aws-us-east-1"
}

variable "neon_org_id" {
  description = "Neon organization ID. Required if your Neon API key belongs to an organization."
  type        = string
  default     = ""
}

variable "db_name" {
  type    = string
  default = "capstone"
}

variable "db_username" {
  type    = string
  default = "capstone"
}

variable "neon_min_cu" {
  type    = number
  default = 0.25
}

variable "neon_max_cu" {
  type    = number
  default = 2
}

# ------------------------------------------------------------------ Upstash (Redis job queue)
variable "upstash_email" {
  description = "Upstash account email (or set TF_VAR_upstash_email)."
  type        = string
}

variable "upstash_api_key" {
  description = "Upstash management API key (or set TF_VAR_upstash_api_key)."
  type        = string
  sensitive   = true
}

variable "upstash_primary_region" {
  type    = string
  default = "us-east-1"
}

# ------------------------------------------------------------------ Railway (queue worker)
variable "railway_workspace_id" {
  description = "Railway workspace ID. Empty = the token's default workspace."
  type        = string
  default     = ""
}

variable "railway_region" {
  type    = string
  default = "us-east4-eqdc4a"
}

# ------------------------------------------------------------------ Neon Object Storage (uploads)
variable "uploads_bucket_name" {
  description = "Name of the private Neon bucket for uploads and generated files."
  type        = string
  default     = "uploads"
}

# ------------------------------------------------------------------ app
variable "app_name" {
  type    = string
  default = "CodeCanvas"
}

variable "app_key" {
  description = "APP_KEY. Leave empty to generate one (stored in state). Changing it logs everyone out."
  type        = string
  default     = ""
  sensitive   = true
}

variable "log_level" {
  type    = string
  default = "info"
}

# ------------------------------------------------------------------ third-party credentials
variable "openrouter_api_key" {
  type      = string
  sensitive = true
}

# ------------------------------------------------------------------ mail (SMTP)
variable "smtp_host" {
  type = string
}

variable "smtp_port" {
  type    = number
  default = 587
}

variable "smtp_secure" {
  description = "true for implicit TLS (port 465); false for STARTTLS (587)."
  type        = bool
  default     = false
}

variable "smtp_username" {
  type    = string
  default = ""
}

variable "smtp_password" {
  type      = string
  default   = ""
  sensitive = true
}

variable "mail_from_name" {
  type    = string
  default = "HumbleBeeAI"
}

variable "mail_from_address" {
  type = string
}

# ------------------------------------------------------------------ AI / RAG tuning
variable "openrouter_model" {
  type    = string
  default = "anthropic/claude-haiku-5.5"
}

variable "openrouter_embedding_model" {
  type    = string
  default = "perplexity/pplx-embed-v1-4b"
}

variable "rag_embedding_dimensions" {
  type    = number
  default = 1024
}

variable "rag_pipeline_version" {
  type    = string
  default = "2"
}

variable "worker_pdf_extractor" {
  description = "PDF_EXTRACTOR for the worker (pymupdf | pdf-parse). The worker image ships PyMuPDF; Vercel always uses pdf-parse."
  type        = string
  default     = "pdf-parse"
}

variable "generation_format" {
  description = "branded | legacy"
  type        = string
  default     = "branded"
}

variable "extra_env" {
  description = "Additional plain environment variables for both web and worker."
  type        = map(string)
  default     = {}
}
