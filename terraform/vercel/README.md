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
- Provider credentials exported; `.env.example` lists them together with every input as `TF_VAR_*`.

## Terraform state (local)

State is kept on your machine in `terraform/vercel/terraform.tfstate` (git-ignored); there is no
remote backend. It holds secrets in plain text (`APP_KEY`, the Neon password, the storage key),
so:

- **Back it up** somewhere private and encrypted. Losing it means Terraform no longer knows about
  the Vercel/Neon/Upstash/Railway resources, and they must be imported or recreated.
- **Only one machine runs `terraform apply`.** Anyone else applying with their own state would try to
  create a second copy of everything.
- GitHub Actions does not run Terraform. Apply infrastructure and env var changes locally; the deploy
  workflow only ships code.

## CI/CD (GitHub Actions)

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | every pull request | lint, typecheck, tests (unit / functional / browser, with Postgres+pgvector and Redis), Python worker tests, app build + worker Docker build, `terraform fmt`/`validate` |
| `.github/workflows/deploy.yml` | push to `main` (or manual) | reruns `ci.yml`, then `railway up` for the worker (migrations run in its pre-deploy step), then `vercel build` + `vercel deploy --prebuilt --prod` |

Git auto-deploys are off on both platforms (`vercel.json` → `git.deploymentEnabled: false`; the
Railway service has no source repo), so production only changes after the checks pass.

Configure these on the repo's **`production`** environment (Settings → Environments):

| Secrets | Variables (copy from `terraform output` after the first apply) |
| --- | --- |
| `VERCEL_TOKEN` | `VERCEL_ORG_ID` = `vercel_team_id` (personal account: your Vercel user ID) |
| `RAILWAY_TOKEN` (project token for the production environment: Project → Settings → Tokens) | `VERCEL_PROJECT_ID` = `vercel_project_id` |

The app's own env vars (database, Redis, OpenRouter, SMTP, ...) are not GitHub secrets: Terraform
writes them straight into Vercel and Railway. Protect `main` with the CI jobs as required status checks.

## Manual deploy

```bash
cd terraform/vercel
cp .env.example .env                           # fill in; git-ignored (or terraform.tfvars.example -> terraform.tfvars)
set -a; . ./.env; set +a                       # load credentials and TF_VAR_* inputs
terraform init
terraform apply                                # writes terraform.tfstate here; back it up
terraform output domain_dns                    # create this DNS record if using a custom domain
terraform output                               # IDs for the GitHub variables above
```

A manual apply creates infrastructure and (with `deploy_on_apply = true`) a Vercel deployment, but
the Railway worker has no code until `railway up` runs: push to `main` (or run the Deploy workflow)
to ship both. Re-run `terraform apply` locally whenever variables or `.tf` files change.

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
