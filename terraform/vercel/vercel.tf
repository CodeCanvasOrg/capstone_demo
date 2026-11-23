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

  # bin/vercel.ts and pdf_service.ts check process.env.VERCEL at runtime.
  automatically_expose_system_environment_variables = true

  resource_config = {
    fluid                     = true
    function_default_regions  = [var.vercel_region]
    function_default_cpu_type = var.vercel_function_cpu_type
    function_default_timeout  = 300
  }

  # Preview deployments would boot against the production database (env vars below are
  # production-only), so they are turned off. Enable them with a separate DB branch if needed.
  preview_deployments_disabled = true
}

# One resource per variable (not one batch): Vercel's bulk endpoint is not atomic, so a failed
# batch left half the variables created but untracked. Per-variable resources keep whatever
# succeeded in state, and the next apply only creates the missing ones.
locals {
  vercel_env = merge(
    { for k, v in local.web_env : k => { value = v, sensitive = false } },
    { for k, v in local.web_secret_env : k => { value = v, sensitive = true } },
  )
}

resource "vercel_project_environment_variable" "web" {
  for_each = nonsensitive(toset(keys(local.vercel_env)))

  project_id = vercel_project.web.id
  key        = each.key
  value      = local.vercel_env[each.key].value
  target     = ["production"]
  sensitive  = local.vercel_env[each.key].sensitive
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

  depends_on = [vercel_project_environment_variable.web, vercel_project_domain.web]

  lifecycle {
    ignore_changes = all
  }
}
