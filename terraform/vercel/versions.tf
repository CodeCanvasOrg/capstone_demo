terraform {
  required_version = ">= 1.6"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.0"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.9"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.5"
    }
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.5"
    }
    restapi = {
      source  = "Mastercard/restapi"
      version = "~> 2.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# Credentials come from environment variables so nothing secret sits in tfvars:
#   VERCEL_API_TOKEN, RAILWAY_TOKEN, TF_VAR_neon_api_key,
#   TF_VAR_upstash_email + TF_VAR_upstash_api_key.
provider "vercel" {
  team = var.vercel_team != "" ? var.vercel_team : null
}

provider "neon" {
  api_key = var.neon_api_key
}

# The Neon provider has no resources for Object Storage yet, so buckets and S3 credentials
# are managed through the Neon REST API directly (see storage.tf).
provider "restapi" {
  uri                   = "https://console.neon.tech/api/v2"
  create_returns_object = true
  headers = {
    Authorization = "Bearer ${var.neon_api_key}"
    Content-Type  = "application/json"
    Accept        = "application/json"
  }
}

provider "upstash" {
  email   = var.upstash_email
  api_key = var.upstash_api_key
}

provider "railway" {}

