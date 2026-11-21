# ------------------------------------------------------------------ Railway (queue worker)
# Vercel can't run long-lived processes, so `node ace queue:work` runs on Railway from the
# repo's Dockerfile (Playwright Chromium + PyMuPDF included). It also runs migrations
# before each deploy.
resource "railway_project" "main" {
  name         = local.name
  workspace_id = var.railway_workspace_id != "" ? var.railway_workspace_id : null

  default_environment = {
    name = "production"
  }
}

resource "railway_service" "worker" {
  name       = "worker"
  project_id = railway_project.main.id

  source_repo        = var.github_repo
  source_repo_branch = var.production_branch
  dockerfile_path    = "Dockerfile"

  predeploy_command   = "node ace migration:run --force"
  restart_policy_type = "ALWAYS"

  regions = [{
    region       = var.railway_region
    num_replicas = 1
  }]
}

resource "railway_variable_collection" "worker" {
  environment_id = railway_project.main.default_environment.id
  service_id     = railway_service.worker.id

  variables = [for k, v in local.worker_env : { name = k, value = v }]
}
