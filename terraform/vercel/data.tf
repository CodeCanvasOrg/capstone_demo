locals {
  name = "${var.project_name}-${var.environment}"
}

# ------------------------------------------------------------------ Neon Postgres (pgvector)
# The `vector` extension is created by the app's migrations (Neon ships pgvector).
# Neon Object Storage is available in aws-us-east-1, aws-us-east-2, aws-eu-central-1 and
# aws-ap-southeast-1 only; keep neon_region to one of those.
resource "neon_project" "main" {
  name       = local.name
  org_id     = var.neon_org_id != "" ? var.neon_org_id : null
  region_id  = var.neon_region
  pg_version = 17

  history_retention_seconds = 86400

  branch {
    name          = "main"
    database_name = var.db_name
    role_name     = var.db_username
  }

  primary_compute {
    autoscaling_limit_min_cu = var.neon_min_cu
    autoscaling_limit_max_cu = var.neon_max_cu
  }
}

locals {
  db_password = urlencode(neon_project.main.database_password)
  # Web (Vercel functions, many short-lived connections) goes through Neon's PgBouncer pooler.
  db_url_pooled = "postgres://${neon_project.main.database_user}:${local.db_password}@${neon_project.main.database_host_pooler}/${neon_project.main.database_name}?sslmode=require"
  # Worker + migrations use a direct connection (session features, advisory locks).
  db_url_direct = "postgres://${neon_project.main.database_user}:${local.db_password}@${neon_project.main.database_host}/${neon_project.main.database_name}?sslmode=require"
}

# ------------------------------------------------------------------ Upstash Redis (job queue)
resource "upstash_redis_database" "main" {
  database_name  = local.name
  region         = "global"
  primary_region = var.upstash_primary_region
  tls            = true
  eviction       = false # queue data must never be evicted
}

resource "random_password" "app_key" {
  length  = 48
  special = false
}
