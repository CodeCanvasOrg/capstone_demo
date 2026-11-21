# State lives in HCP Terraform so GitHub Actions (.github/workflows/deploy.yml) and local
# runs share it; it holds secrets (APP_KEY, Neon password, storage key), so it must not be local.
#
# The organization and workspace come from the environment:
#   export TF_CLOUD_ORGANIZATION=<org>   TF_WORKSPACE=<workspace>
#   terraform login                       # or TF_TOKEN_app_terraform_io=<token>
#
# Set the workspace's execution mode to "Local": plans run where terraform is invoked
# (your shell or the Actions runner), with the provider credentials from that environment.
terraform {
  cloud {}
}
