# Infrastructure: Vercel + Neon + Upstash + Railway (Terraform)

| Piece            | Where                    | Notes                                                    |
| ---------------- | ------------------------ | -------------------------------------------------------- |
| Web (AdonisJS)   | Vercel Function          | `api/index.mjs` → `bin/vercel.ts`; config in `vercel.json` |
| Static assets    | Vercel CDN               | `build/public` (Vite output)                              |
| Queue worker     | Railway (repo Dockerfile)| `APP_ROLE=worker`; runs migrations as a pre-deploy step   |
| Postgres+pgvector| Neon                     | web uses the pooler, worker uses a direct connection     |
| Uploads          | Neon Object Storage      | private bucket + scoped S3 credential, via the Neon API  |
| Redis (queue)    | Upstash (TLS)            | `REDIS_TLS=true`                                          |

The AWS/ECS stack in `../` is independent; use one or the other.

## Prerequisites

- The Vercel GitHub app and the Railway GitHub app both have access to `github_repo`.
- The code changes for Vercel (`vercel.json`, `api/`, `bin/vercel.ts`, `scripts/vercel_manifest.mjs`,
  Redis TLS, serverless Chromium) are pushed to `production_branch` **before** `terraform apply`,
  because the first deploys build from that branch.
- Provider credentials exported (see `terraform.tfvars.example`).

## Deploy

```bash
cd terraform/vercel
cp terraform.tfvars.example terraform.tfvars   # fill in; git-ignored
terraform init
terraform apply
terraform output google_oauth_redirect_uri     # add to the Google OAuth client
terraform output domain_dns                    # create this DNS record if using a custom domain
```

After that, pushes to `production_branch` redeploy both Vercel (web) and Railway (worker; it runs
`node ace migration:run --force` before starting).

## Known limits on Vercel

- **Request body cap 4.5 MB**: file uploads larger than that are rejected by Vercel before reaching the
  app (`config/bodyparser.ts` allows 20 MB). Fixing this needs direct-to-S3 presigned uploads.
- **Collection PDF export** (`collections_controller` → `merge_pdfs.py`) shells out to Python, which the
  Vercel runtime doesn't have. It works only where the Docker image runs (i.e. the worker).
- Single-document PDF preview uses `@sparticuz/chromium` on Vercel (cold starts add a few seconds).
- Functions time out after 300 s (`vercel.json`); long work belongs in queued jobs.
- Upstash bills per command and the queue worker polls Redis; check usage after a few days.
- **Neon Object Storage** bucket/credential endpoints are Beta and the Neon Terraform provider doesn't
  cover them, so `storage.tf` calls the REST API (Mastercard/restapi). The org must have Object Storage
  access; `terraform apply` stops with the API's reason if not. Versioning and lifecycle rules are not
  enforced by Neon, so there is no object version history like S3 versioning gave. Buckets branch with
  the database: a Neon branch made for testing gets a copy-on-write copy of production files.
- Destroying the bucket requires it to be empty first.
- Generated secrets (`APP_KEY`), the Neon password and the storage secret live in Terraform state: use an encrypted remote
  backend for anything shared.
