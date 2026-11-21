# ------------------------------------------------------------------ general
variable "project_name" {
  description = "Prefix for all resource names."
  type        = string
  default     = "capstone"
}

variable "environment" {
  description = "Environment name (prod, staging, ...)."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread subnets over (ALB and RDS need >= 2)."
  type        = number
  default     = 2
}

# ------------------------------------------------------------------ app / edge
variable "image_tag" {
  description = "Tag of the app image in the ECR repository (push it before applying services)."
  type        = string
  default     = "latest"
}

variable "domain_name" {
  description = "Public hostname users reach the app on (e.g. app.example.com). Point a DNS CNAME/alias at the alb_dns_name output. Leave empty to use the ALB hostname."
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN (same region) for the HTTPS listener. Required for real use: session cookies are Secure in production, so login does not work over plain HTTP. If empty, only an HTTP listener is created (smoke tests only)."
  type        = string
  default     = ""
}

variable "app_name" {
  description = "APP_NAME"
  type        = string
  default     = "CodeCanvas"
}

variable "log_level" {
  type    = string
  default = "info"
}

variable "app_key" {
  description = "APP_KEY (>= 16 chars). Leave empty to generate one (stored in Terraform state and Secrets Manager). Changing it invalidates sessions/encrypted data."
  type        = string
  default     = ""
  sensitive   = true
}

# ------------------------------------------------------------------ compute
variable "web_cpu" {
  type    = number
  default = 1024
}

variable "web_memory" {
  description = "MiB. Chromium (PDF export) needs headroom."
  type        = number
  default     = 4096
}

variable "web_desired_count" {
  type    = number
  default = 1
}

variable "worker_cpu" {
  type    = number
  default = 2048
}

variable "worker_memory" {
  description = "MiB. The worker runs OCR, PyMuPDF and embeddings."
  type        = number
  default     = 8192
}

variable "worker_desired_count" {
  type    = number
  default = 1
}

# ------------------------------------------------------------------ data stores
variable "db_name" {
  type    = string
  default = "capstone"
}

variable "db_username" {
  type    = string
  default = "capstone"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "GiB (gp3). Storage autoscaling is enabled up to 4x."
  type        = number
  default     = 50
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_deletion_protection" {
  description = "Also controls whether a final snapshot is taken on destroy."
  type        = bool
  default     = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "s3_force_destroy" {
  description = "Allow `terraform destroy` to delete a non-empty uploads bucket."
  type        = bool
  default     = false
}

# ------------------------------------------------------------------ third-party credentials (secrets)
variable "openrouter_api_key" {
  type      = string
  sensitive = true
}

# ------------------------------------------------------------------ mail (bring your own SMTP, e.g. SES SMTP credentials)
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

variable "pdf_extractor" {
  description = "pymupdf | pdf-parse. The app itself defaults to pdf-parse in production until the PyMuPDF rollout is signed off."
  type        = string
  default     = "pdf-parse"
}

variable "generation_format" {
  description = "branded | legacy"
  type        = string
  default     = "branded"
}

variable "extra_env" {
  description = "Additional plain environment variables for web, worker and migrate tasks."
  type        = map(string)
  default     = {}
}
