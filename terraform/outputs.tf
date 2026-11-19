output "app_url" {
  description = "APP_URL the app was configured with. Add <app_url>/... callback to the Google OAuth client's authorized redirect URIs."
  value       = local.app_url
}

output "alb_dns_name" {
  description = "Point your domain's DNS record here."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "app_secret_arn" {
  description = "Secrets Manager secret holding APP_KEY, DB_URL, S3 keys, API keys."
  value       = aws_secretsmanager_secret.app.arn
}

output "push_image_commands" {
  value = <<-EOT
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app.repository_url}
    docker build --platform linux/amd64 -t ${aws_ecr_repository.app.repository_url}:${var.image_tag} .
    docker push ${aws_ecr_repository.app.repository_url}:${var.image_tag}
  EOT
}

output "run_migrations_command" {
  description = "Run once after the first deploy and after every release that adds migrations."
  value       = <<-EOT
    aws ecs run-task --region ${var.aws_region} --cluster ${aws_ecs_cluster.main.name} --launch-type FARGATE \
      --task-definition ${aws_ecs_task_definition.app["migrate"].family} \
      --network-configuration 'awsvpcConfiguration={subnets=[${join(",", aws_subnet.private[*].id)}],securityGroups=[${aws_security_group.app.id}]}'
  EOT
}
