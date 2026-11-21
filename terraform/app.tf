locals {
  app_url = var.domain_name != "" ? "${var.certificate_arn != "" ? "https" : "http"}://${var.domain_name}" : "${var.certificate_arn != "" ? "https" : "http"}://${aws_lb.main.dns_name}"

  app_key = var.app_key != "" ? var.app_key : random_password.app_key.result

  # Non-secret configuration (mirrors .env.example).
  environment = merge({
    NODE_ENV       = "production"
    HOST           = "0.0.0.0"
    PORT           = "3333"
    TZ             = "UTC"
    LOG_LEVEL      = var.log_level
    APP_NAME       = var.app_name
    APP_URL        = local.app_url
    SESSION_DRIVER = "cookie"

    DB_HOST     = aws_db_instance.main.address
    DB_PORT     = tostring(aws_db_instance.main.port)
    DB_USER     = var.db_username
    DB_DATABASE = var.db_name

    DRIVE_DISK  = "s3"
    S3_REGION   = var.aws_region
    S3_BUCKET   = aws_s3_bucket.uploads.bucket
    S3_ENDPOINT = "https://s3.${var.aws_region}.amazonaws.com"

    QUEUE_DRIVER = "redis"
    REDIS_HOST   = aws_elasticache_cluster.main.cache_nodes[0].address
    REDIS_PORT   = "6379"

    OPENROUTER_MODEL           = var.openrouter_model
    OPENROUTER_EMBEDDING_MODEL = var.openrouter_embedding_model
    EMBEDDING_PROVIDER         = "openrouter"
    RAG_PIPELINE_VERSION       = var.rag_pipeline_version
    RAG_EMBEDDING_DIMENSIONS   = tostring(var.rag_embedding_dimensions)
    PDF_EXTRACTOR              = var.pdf_extractor
    CONTEXTUALIZER             = "off"
    GENERATION_FORMAT          = var.generation_format

    MAIL_MAILER       = "smtp"
    MAIL_FROM_NAME    = var.mail_from_name
    MAIL_FROM_ADDRESS = var.mail_from_address
    SMTP_HOST         = var.smtp_host
    SMTP_PORT         = tostring(var.smtp_port)
    SMTP_SECURE       = tostring(var.smtp_secure)
    SMTP_USERNAME     = var.smtp_username
  }, var.extra_env)

  # Secret values live in ONE Secrets Manager secret (JSON); ECS injects each key separately.
  secret_values = merge({
    APP_KEY     = local.app_key
    DB_PASSWORD = random_password.db.result
    # RDS enforces TLS; `no-verify` encrypts without bundling the RDS CA into the image.
    DB_URL               = "postgres://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}?sslmode=no-verify"
    OPENROUTER_API_KEY   = var.openrouter_api_key
    S3_ACCESS_KEY_ID     = aws_iam_access_key.app_s3.id
    S3_SECRET_ACCESS_KEY = aws_iam_access_key.app_s3.secret
  }, var.smtp_password != "" ? { SMTP_PASSWORD = var.smtp_password } : {})

  container_environment = [for k, v in local.environment : { name = k, value = v }]
  container_secrets     = [for k in keys(local.secret_values) : { name = k, valueFrom = "${aws_secretsmanager_secret.app.arn}:${k}::" }]
}

# ------------------------------------------------------------------ secrets
resource "random_password" "app_key" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app-env"
  recovery_window_in_days = var.db_deletion_protection ? 7 : 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(local.secret_values)
}

# ------------------------------------------------------------------ IAM
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Execution role: pulls the image, writes logs, reads the secret at task start.
resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-app-secret"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.app.arn
    }]
  })
}

# Task role: what the running app itself may do (ECS Exec for debugging).
resource "aws_iam_role" "task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "task_exec" {
  name = "ecs-exec"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssmmessages:CreateControlChannel", "ssmmessages:CreateDataChannel", "ssmmessages:OpenControlChannel", "ssmmessages:OpenDataChannel"]
      Resource = "*"
    }]
  })
}

# ------------------------------------------------------------------ ECS
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
}

resource "aws_ecs_cluster" "main" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

locals {
  image = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"

  # role -> sizing + command override (null = image default CMD, i.e. the web server)
  roles = {
    web     = { cpu = var.web_cpu, memory = var.web_memory, command = null }
    worker  = { cpu = var.worker_cpu, memory = var.worker_memory, command = ["node", "ace", "queue:work", "--queue=documents"] }
    migrate = { cpu = 512, memory = 1024, command = ["node", "ace", "migration:run", "--force"] }
  }
}

resource "aws_ecs_task_definition" "app" {
  for_each = local.roles

  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64" # match the platform the image is built for (docker build --platform linux/amd64)
  }

  container_definitions = jsonencode([merge({
    name         = each.key
    image        = local.image
    essential    = true
    environment  = local.container_environment
    secrets      = local.container_secrets
    portMappings = each.key == "web" ? [{ containerPort = 3333, protocol = "tcp" }] : []
    # tini-style init so Chromium/Python child processes are reaped.
    linuxParameters = { initProcessEnabled = true }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = each.key
      }
    }
  }, each.value.command != null ? { command = each.value.command } : {})])
}

resource "aws_ecs_service" "web" {
  name                   = "${local.name}-web"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.app["web"].arn
  desired_count          = var.web_desired_count
  launch_type            = "FARGATE"
  enable_execute_command = true

  health_check_grace_period_seconds = 60

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.app.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3333
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http, aws_lb_listener.https]
}

resource "aws_ecs_service" "worker" {
  name                   = "${local.name}-worker"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.app["worker"].arn
  desired_count          = var.worker_desired_count
  launch_type            = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.app.id]
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

# ------------------------------------------------------------------ load balancer
resource "aws_lb" "main" {
  name               = local.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  idle_timeout       = 120 # document generation / PDF export requests can be slow
}

resource "aws_lb_target_group" "web" {
  name_prefix = "web-"
  vpc_id      = aws_vpc.main.id
  port        = 3333
  protocol    = "HTTP"
  target_type = "ip"

  deregistration_delay = 30

  health_check {
    path = "/"
    # "/" redirects anonymous users to the login page.
    matcher             = "200-399"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  lifecycle { create_before_destroy = true }
}

# HTTP: redirect to HTTPS when a certificate is configured, otherwise serve the app directly.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = var.certificate_arn != "" ? "redirect" : "forward"
    target_group_arn = var.certificate_arn != "" ? null : aws_lb_target_group.web.arn

    dynamic "redirect" {
      for_each = var.certificate_arn != "" ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.certificate_arn != "" ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}
