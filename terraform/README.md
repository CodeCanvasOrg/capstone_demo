# Infrastructure (AWS, Terraform)

Deploys the app as one container image running in three roles on **ECS Fargate**:

| Role      | Command                                   | Notes                                  |
| --------- | ----------------------------------------- | -------------------------------------- |
| `web`     | image default (`node bin/server.js`)      | behind an ALB, port 3333               |
| `worker`  | `node ace queue:work --queue=documents`   | indexing, generation, PDF export jobs  |
| `migrate` | `node ace migration:run --force`          | one-off task, run on each release      |

Backing services: RDS Postgres 17 (pgvector), ElastiCache Redis 7, private S3 bucket, ECR,
Secrets Manager (all secret env vars in one JSON secret), CloudWatch Logs, VPC with public/private
subnets and a single NAT gateway. The env var names match `.env.example`.

## Deploy

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars        # fill in; it is git-ignored
terraform init
terraform apply -target=aws_ecr_repository.app      # 1. create the registry first
terraform output -raw push_image_commands | sh      # 2. build (linux/amd64) + push; run from repo root
terraform apply                                      # 3. everything else
terraform output -raw run_migrations_command | sh   # 4. migrate (re-run on releases with migrations)
```

Step 2 builds with the repo's `Dockerfile`; run those commands from the repository root
(`cd .. && terraform -chdir=terraform output -raw push_image_commands | sh`).
Then point your domain at `alb_dns_name`.

## Notes

- **HTTPS is required for login**: session cookies are `Secure` in production. Provide `certificate_arn`
  (ACM, same region). Without it only HTTP is served, which is for smoke tests.
- Redis has no TLS/AUTH because `config/redis.ts` has no TLS option; it is reachable only from the app
  security group. Add TLS support in the app before enabling in-transit encryption.
- The app requires static S3 keys (`config/drive.ts`), so a bucket-scoped IAM user is created and its
  key stored in Secrets Manager.
- Generated secrets (`APP_KEY`, DB password) live in Terraform state: use a remote encrypted backend
  (see `versions.tf`).
- `db_deletion_protection = true` (default) blocks destroy and keeps a final snapshot.
- Cost levers: `db_instance_class`, `redis_node_type`, `worker_memory`, and the single NAT gateway.
- Roll out a new image: push a new tag, set `image_tag`, `terraform apply`.
