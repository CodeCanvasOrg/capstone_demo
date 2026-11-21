output "app_url" {
  description = "APP_URL the app was configured with."
  value       = local.app_url
}

output "google_oauth_redirect_uri" {
  description = "Add this to the Google OAuth client's authorized redirect URIs."
  value       = "${local.app_url}/oauth/google/callback"
}

output "vercel_project_id" {
  value = vercel_project.web.id
}

output "vercel_team_id" {
  description = "VERCEL_ORG_ID for the Vercel CLI in the deploy workflow."
  value       = vercel_project.web.team_id
}

output "vercel_deployment_url" {
  value = try(vercel_deployment.web[0].url, null)
}

output "domain_dns" {
  description = "DNS record to create for the custom domain (if not managed by Vercel)."
  value       = var.domain_name != "" ? "CNAME ${var.domain_name} -> cname.vercel-dns.com (apex domain: A -> 76.76.21.21)" : null
}

output "neon_project_id" {
  value = neon_project.main.id
}

output "database_url_direct" {
  description = "Direct Neon connection string (for running migrations or psql by hand)."
  value       = local.db_url_direct
  sensitive   = true
}

output "upstash_endpoint" {
  value = upstash_redis_database.main.endpoint
}

output "railway_project_id" {
  value = railway_project.main.id
}

output "railway_environment_id" {
  value = railway_project.main.default_environment.id
}

output "railway_worker_service_id" {
  value = railway_service.worker.id
}

output "uploads_bucket" {
  value = var.uploads_bucket_name
}

output "storage_s3_endpoint" {
  value = local.neon_storage.s3_endpoint
}
