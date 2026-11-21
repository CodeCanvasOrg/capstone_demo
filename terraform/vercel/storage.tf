# ------------------------------------------------------------------ Neon Object Storage (uploads)
# S3-compatible buckets that live on the Neon branch. The app talks to them with the AWS SDK
# (config/drive.ts, path-style). Bucket and credential endpoints are Beta in the Neon API.
locals {
  neon_branch_path = "/projects/${neon_project.main.id}/branches/${neon_project.main.default_branch_id}"
}

resource "restapi_object" "uploads_bucket" {
  path = "${local.neon_branch_path}/buckets"
  data = jsonencode({ name = var.uploads_bucket_name, access_level = "private" })
  # The name is the ID. Pinned because create returns {"bucket": {...}} while the list
  # used for reads returns flat items.
  object_id    = var.uploads_bucket_name
  id_attribute = "name"

  # There is no single-bucket GET; read back from the list.
  read_path = "${local.neon_branch_path}/buckets"
  read_search = {
    results_key  = "buckets"
    search_key   = "name"
    search_value = var.uploads_bucket_name
  }
  destroy_path = "${local.neon_branch_path}/buckets/{id}"

  # No update endpoint; the access level can't change after creation.
  force_new                 = ["name", "access_level"]
  ignore_all_server_changes = true
}

# Server-side credential for the app (read + write). The secret is returned only on create,
# so it is taken from create_response and kept in Terraform state.
resource "restapi_object" "storage_credential" {
  path = "${local.neon_branch_path}/credentials"
  data = jsonencode({
    name           = "${local.name}-app"
    principal_type = "user"
    scopes         = ["storage:read", "storage:write"]
  })
  id_attribute = "token_id"

  read_path = "${local.neon_branch_path}/credentials"
  read_search = {
    results_key  = "credentials"
    search_key   = "token_id"
    search_value = "{id}"
  }
  destroy_path = "${local.neon_branch_path}/credentials/{id}"

  force_new                 = ["name", "principal_type", "scopes"]
  ignore_all_server_changes = true
}

# The branch's S3 endpoint and region (endpoint hostnames vary, so they are never built by hand).
data "http" "neon_storage" {
  url = "https://console.neon.tech/api/v2${local.neon_branch_path}/storage"
  request_headers = {
    Authorization = "Bearer ${var.neon_api_key}"
    Accept        = "application/json"
  }

  depends_on = [restapi_object.uploads_bucket]

  lifecycle {
    postcondition {
      condition     = self.status_code == 200
      error_message = "Neon Object Storage is not available on this branch (HTTP ${self.status_code}): ${self.response_body}. Check that the org has Object Storage access and neon_region supports it."
    }
  }
}

locals {
  neon_storage       = jsondecode(data.http.neon_storage.response_body)
  storage_credential = jsondecode(sensitive(restapi_object.storage_credential.create_response))
}
