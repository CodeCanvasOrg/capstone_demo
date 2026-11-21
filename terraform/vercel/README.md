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

- The Vercel GitHub app has access to `github_repo` (the project is linked to it; auto-deploys are off).
- An HCP Terraform workspace with execution mode **Local** holds the state (`backend.tf`).
- Provider credentials exported (see `terraform.tfvars.example`), plus `TF_CLOUD_ORGANIZATION`,
  `TF_WORKSPACE` and `terraform login`.

## CI/CD (GitHub Actions)

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | every pull request | lint, typecheck, tests (unit / functional / browser, with Postgres+pgvector and Redis), Python worker tests, app build + worker Docker build, `terraform fmt`/`validate` |
| `.github/workflows/deploy.yml` | push to `main` (or manual) | reruns `ci.yml`, then `terraform apply`, `railway up` for the worker (migrations run in its pre-deploy step), then `vercel build` + `vercel deploy --prebuilt --prod` |

Git auto-deploys are off on both platforms (`vercel.json` → `git.deploymentEnabled: false`; the
Railway service has no source repo), so production only changes after the checks pass.

Configure these on the repo's **`production`** environment (Settings → Environments):

| Secrets | Variables |
| --- | --- |
| `TF_API_TOKEN` (HCP Terraform) | `TF_CLOUD_ORGANIZATION`, `TF_WORKSPACE` |
| `VERCEL_TOKEN` | `VERCEL_TEAM` (empty = personal account) |
| `RAILWAY_API_TOKEN` (account/workspace token) | `RAILWAY_WORKSPACE_ID` (optional) |
| `NEON_API_KEY` | `NEON_ORG_ID` (optional) |
| `UPSTASH_API_KEY` | `UPSTASH_EMAIL` |
| `OPENROUTER_API_KEY` | `GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET` | `SMTP_HOST`, `SMTP_USERNAME`, `MAIL_FROM_ADDRESS` |
| `SMTP_PASSWORD` | `DOMAIN_NAME` (empty = `<project>.vercel.app`) |
| `APP_KEY` (optional; generated and kept in state if empty) | |

Other variables keep their defaults from `variables.tf`; add a `TF_VAR_*` line to the apply step to
override one. Protect `main` with the CI jobs as required status checks.

## Manual deploy

```bash
cd terraform/vercel
cp terraform.tfvars.example terraform.tfvars   # fill in; git-ignored
terraform init
terraform apply
terraform output google_oauth_redirect_uri     # add to the Google OAuth client
terraform output domain_dns                    # create this DNS record if using a custom domain
```

A manual apply creates infrastructure and (with `deploy_on_apply = true`) a Vercel deployment, but
the Railway worker has no code until `railway up` runs; normally let the deploy workflow do both.

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
