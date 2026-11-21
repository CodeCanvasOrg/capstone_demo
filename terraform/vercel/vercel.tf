# ------------------------------------------------------------------ Vercel project (web)
# Build settings (build command, output dir, function config, rewrites) live in the repo's
# vercel.json so they are versioned with the code.
resource "vercel_project" "web" {
  name = var.project_name

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }

  # Node version comes from package.json "engines" (>=24); this provider version only accepts up to 22.x here.
  serverless_function_region = var.vercel_region

  # bin/vercel.ts and pdf_service.ts check process.env.VERCEL at runtime.
  automatically_expose_system_environment_variables = true

  resource_config = {
    fluid                     = true
    function_default_cpu_type = "performance" # 1.7 vCPU / 4 GB: Chromium PDF rendering
    function_default_timeout  = 300
  }

  # Preview deployments would boot against the production database (env vars below are
  # production-only), so they are turned off. Enable them with a separate DB branch if needed.
  preview_deployments_disabled = true
}

resource "vercel_project_environment_variables" "web" {
  project_id = vercel_project.web.id

  variables = concat(
    [for k, v in local.web_env : {
      key    = k
      value  = v
      target = ["production"]
    }],
    [for k, v in local.web_secret_env : {
      key       = k
      value     = v
      target    = ["production"]
      sensitive = true
    }],
  )
}

resource "vercel_project_domain" "web" {
  count      = var.domain_name != "" ? 1 : 0
  project_id = vercel_project.web.id
  domain     = var.domain_name
}

# Optional production deployment of production_branch once env vars exist (manual applies).
# Git auto-deploys are disabled in vercel.json; .github/workflows/deploy.yml deploys main
# with the Vercel CLI and runs apply with deploy_on_apply = false.
resource "vercel_deployment" "web" {
  count      = var.deploy_on_apply ? 1 : 0
  project_id = vercel_project.web.id
  ref        = var.production_branch
  production = true

  depends_on = [vercel_project_environment_variables.web, vercel_project_domain.web]

  lifecycle {
    ignore_changes = all
  }
}
