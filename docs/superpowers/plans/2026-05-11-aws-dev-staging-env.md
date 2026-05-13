# AWS Dev & Staging Environment Setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy isolated dev (for feature development) and staging (for testers) environments on AWS eu-west-2, each with a .NET 8 API on ECS Fargate, PostgreSQL on RDS, Cognito JWT auth, and EAS internal distribution builds pointing to the respective API endpoint.

**Architecture:** Single AWS account, two namespaced resource sets (`onsitemonday-dev-*`, `onsitemonday-staging-*`). One parametrized Terraform config with separate state backends and var files produces both environments. Shared Terraform provisions ECR and GitHub OIDC once. ECS tasks run in public subnets with public IPs (no NAT Gateway cost) — security groups restrict traffic to ALB-only. CI/CD uses GitHub Actions OIDC (no long-lived AWS keys).

**Tech Stack:** Terraform 1.7+, AWS CLI v2, ECS Fargate, RDS PostgreSQL 16, AWS Secrets Manager, ECR, ALB, GitHub Actions, EAS CLI

---

## Prerequisites (complete before starting)

- AWS account with admin credentials; verify: `aws sts get-caller-identity` returns your account ID
- Two Cognito User Pools provisioned in eu-west-2 (one dev, one staging) — note each pool's **User Pool ID**, **App Client ID**, and **Hosted UI domain**
- **`feat/firebase-to-cognito-migration` must be merged to `main`** — if deployed before merge, unauthenticated health checks pass but every auth endpoint returns 401 (wrong JWKS endpoint)
- Expo account (`hughpaul`) with EAS CLI access
- GitHub repo name known for OIDC trust policy

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `infra/terraform/shared/main.tf` | Create | ECR repo + GitHub OIDC IAM role (apply once) |
| `infra/terraform/shared/outputs.tf` | Create | ECR URL and role ARN outputs |
| `infra/terraform/env/main.tf` | Create | Parametrized VPC, RDS, ECS, ALB, Secrets Manager |
| `infra/terraform/env/variables.tf` | Create | Variable declarations |
| `infra/terraform/env/outputs.tf` | Create | ALB DNS name, RDS endpoint, cluster/service names |
| `infra/terraform/env/backend-dev.hcl` | Create | Dev Terraform state backend config |
| `infra/terraform/env/backend-staging.hcl` | Create | Staging Terraform state backend config |
| `infra/terraform/env/dev.tfvars` | Create | Dev-specific values (gitignored) |
| `infra/terraform/env/staging.tfvars` | Create | Staging-specific values (gitignored) |
| `.gitignore` | Modify | Add Terraform state + tfvars exclusions |
| `.github/workflows/deploy-api-dev.yml` | Create | Build + push + deploy API to dev on push to main |
| `.github/workflows/deploy-api-staging.yml` | Create | Build + push + deploy API to staging (manual trigger) |
| `.github/workflows/build-app-staging.yml` | Create | EAS internal build for staging testers (manual trigger) |
| `frontend/eas.json` | Modify | Add `development` profile; update `preview` with staging URL; remove Firebase vars |

---

## Task 1: Bootstrap Terraform State Backend

**Files:** No files to create — AWS CLI only.

The S3 bucket stores Terraform state files remotely and the DynamoDB table prevents concurrent `terraform apply` calls from corrupting state.

- [ ] **Step 1: Create S3 state bucket**

```bash
aws s3api create-bucket \
  --bucket onsitemonday-terraform-state \
  --region eu-west-2 \
  --create-bucket-configuration LocationConstraint=eu-west-2

aws s3api put-bucket-versioning \
  --bucket onsitemonday-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket onsitemonday-terraform-state \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket onsitemonday-terraform-state \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

Expected: no error output from any command.

- [ ] **Step 2: Create DynamoDB lock table**

```bash
aws dynamodb create-table \
  --table-name onsitemonday-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-2
```

Expected: JSON response with `"TableStatus": "CREATING"`.

- [ ] **Step 3: Verify**

```bash
aws s3 ls s3://onsitemonday-terraform-state
aws dynamodb describe-table --table-name onsitemonday-terraform-locks \
  --query "Table.TableStatus" --output text
```

Expected: first command returns empty output (bucket exists, no files yet); second returns `ACTIVE`.

---

## Task 2: Shared Resources — ECR + GitHub OIDC

**Files:**
- Create: `infra/terraform/shared/main.tf`
- Create: `infra/terraform/shared/outputs.tf`

ECR holds Docker images for both envs. The GitHub OIDC role lets Actions authenticate to AWS without long-lived credentials. Apply this once — shared across both environments.

- [ ] **Step 1: Create directory**

```bash
mkdir -p infra/terraform/shared
```

- [ ] **Step 2: Write `infra/terraform/shared/main.tf`**

Replace `hughpaul/onsite-monday` in `locals.github_repo` with your actual GitHub org/repo.

```hcl
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "onsitemonday-terraform-state"
    key            = "shared/terraform.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "onsitemonday-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-west-2"
}

locals {
  github_repo = "hughpaul/onsite-monday"
}

resource "aws_ecr_repository" "api" {
  name                 = "onsitemonday-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

# If GitHub OIDC provider doesn't exist in your account, switch this data block
# to a resource block:
#   resource "aws_iam_openid_connect_provider" "github" {
#     url             = "https://token.actions.githubusercontent.com"
#     client_id_list  = ["sts.amazonaws.com"]
#     thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1",
#                        "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
#   }
# and reference it as aws_iam_openid_connect_provider.github.arn below.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_actions" {
  name = "onsitemonday-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${local.github_repo}:*"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions" {
  name = "onsitemonday-github-actions-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:DescribeImages"
        ]
        Resource = aws_ecr_repository.api.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:ListTaskDefinitions"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "arn:aws:iam::*:role/onsitemonday-*-ecs-task-execution"
      }
    ]
  })
}
```

- [ ] **Step 3: Write `infra/terraform/shared/outputs.tf`**

```hcl
output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}
```

- [ ] **Step 4: Apply**

```bash
cd infra/terraform/shared
terraform init
terraform apply
```

If `terraform plan` errors with "No openid connect provider found for url", switch to the `resource` block for the OIDC provider as described in the comment in `main.tf`.

Expected final output:
```
Apply complete! Resources: 4 added, 0 changed, 0 destroyed.

Outputs:
ecr_repository_url = "123456789.dkr.ecr.eu-west-2.amazonaws.com/onsitemonday-api"
github_actions_role_arn = "arn:aws:iam::123456789:role/onsitemonday-github-actions"
```

**Record both output values — used in Tasks 4, 5, and 7.**

- [ ] **Step 5: Commit**

```bash
cd ../../..
git add infra/terraform/shared/
git commit -m "feat: add ECR repo and GitHub OIDC role for CI/CD"
```

---

## Task 3: Parametrized Environment Terraform

**Files:**
- Create: `infra/terraform/env/variables.tf`
- Create: `infra/terraform/env/main.tf`
- Create: `infra/terraform/env/outputs.tf`
- Create: `infra/terraform/env/backend-dev.hcl`
- Create: `infra/terraform/env/backend-staging.hcl`
- Create: `infra/terraform/env/dev.tfvars`
- Create: `infra/terraform/env/staging.tfvars`
- Modify: `.gitignore`

One Terraform config, two separate state files. Both environments share the same resource graph; var files and backend configs differentiate them.

- [ ] **Step 1: Create directory**

```bash
mkdir -p infra/terraform/env
```

- [ ] **Step 2: Write `infra/terraform/env/variables.tf`**

```hcl
variable "env" {
  type        = string
  description = "Environment name: dev or staging"
}

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "vpc_cidr" {
  type = string
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Two public subnets for ALB and ECS tasks"
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Two private subnets for RDS"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "ecr_repository_url" {
  type        = string
  description = "ECR repository URL from shared stack"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "task_cpu" {
  type    = number
  default = 256
}

variable "task_memory" {
  type    = number
  default = 512
}
```

- [ ] **Step 3: Write `infra/terraform/env/main.tf`**

```hcl
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region
}

locals {
  name = "onsitemonday-${var.env}"
  azs  = ["eu-west-2a", "eu-west-2b"]
  tags = {
    Project     = "onsitemonday"
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

# ─── Networking ───────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(local.tags, { Name = "${local.name}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${local.name}-igw" })
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${local.name}-public-${count.index + 1}" })
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]
  tags              = merge(local.tags, { Name = "${local.name}-private-${count.index + 1}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.tags, { Name = "${local.name}-public-rt" })
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ─── Security Groups ──────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "ALB — allow HTTP from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-alb-sg" })
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${local.name}-ecs-tasks"
  description = "ECS tasks — port 8080 from ALB only; all outbound for ECR/Secrets Manager"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-ecs-tasks-sg" })
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "RDS PostgreSQL — port 5432 from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = merge(local.tags, { Name = "${local.name}-rds-sg" })
}

# ─── RDS ──────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_db_instance" "postgres" {
  identifier        = "${local.name}-postgres"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true

  db_name  = "onsitemonday"
  username = "onsitemonday"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false
  publicly_accessible = false
  deletion_protection = false
  skip_final_snapshot = true

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  tags = merge(local.tags, { Name = "${local.name}-postgres" })
}

# ─── Secrets Manager ──────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  description             = "App secrets for ${var.env}"
  recovery_window_in_days = 0
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  # ASP.NET Core reads double-underscore env vars as nested config keys:
  # Aws__Region → Aws:Region, ConnectionStrings__DefaultConnection → ConnectionStrings:DefaultConnection
  secret_string = jsonencode({
    ConnectionStrings__DefaultConnection = "Host=${aws_db_instance.postgres.address};Port=5432;Database=onsitemonday;Username=onsitemonday;Password=${var.db_password}"
    Aws__Region                          = var.aws_region
    Aws__CognitoUserPoolId               = var.cognito_user_pool_id
    Aws__CognitoClientId                 = var.cognito_client_id
    ASPNETCORE_ENVIRONMENT               = "Development"
  })
}

# ─── IAM ──────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name}-secrets-read"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = aws_secretsmanager_secret.app.arn
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

# ─── ECS ──────────────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${local.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
  tags              = local.tags
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${var.ecr_repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      containerPort = 8080
      hostPort      = 8080
      protocol      = "tcp"
    }]

    # Each valueFrom uses the format: "<secret-arn>:<json-key>::"
    # The trailing :: means "current version, no specific version stage".
    # ECS resolves each key individually from the JSON blob stored in Secrets Manager.
    secrets = [
      {
        name      = "ConnectionStrings__DefaultConnection"
        valueFrom = "${aws_secretsmanager_secret.app.arn}:ConnectionStrings__DefaultConnection::"
      },
      {
        name      = "Aws__Region"
        valueFrom = "${aws_secretsmanager_secret.app.arn}:Aws__Region::"
      },
      {
        name      = "Aws__CognitoUserPoolId"
        valueFrom = "${aws_secretsmanager_secret.app.arn}:Aws__CognitoUserPoolId::"
      },
      {
        name      = "Aws__CognitoClientId"
        valueFrom = "${aws_secretsmanager_secret.app.arn}:Aws__CognitoClientId::"
      },
      {
        name      = "ASPNETCORE_ENVIRONMENT"
        valueFrom = "${aws_secretsmanager_secret.app.arn}:ASPNETCORE_ENVIRONMENT::"
      }
    ]

    environment = [{
      name  = "ASPNETCORE_URLS"
      value = "http://+:8080"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }

    # No healthCheck block: base image (mcr.microsoft.com/dotnet/aspnet:8.0) has no curl.
    # Health is determined solely by the ALB target group health check below.
  }])

  tags = local.tags
}

# ─── ALB ──────────────────────────────────────────────────────────────────────

resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false
  tags                       = local.tags
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api-tg"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  # 60s drain: lets EF migrations complete before ALB marks the target healthy,
  # and gives in-flight requests time to finish during rolling deploys.
  deregistration_delay = 60

  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_ecs_service" "api" {
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  # With desired_count = 1, minimum_healthy_percent must be 0 or ECS cannot
  # replace the only running task during a rolling deploy.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true  # Required for ECR pulls without a NAT gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_execution_managed,
    aws_iam_role_policy.ecs_execution_secrets,
    aws_lb_listener.http
  ]

  lifecycle {
    # CI updates task_definition on every deploy; ignore here to prevent
    # terraform apply from reverting to the initially registered revision.
    ignore_changes = [task_definition]
  }

  tags = local.tags
}
```

- [ ] **Step 4: Write `infra/terraform/env/outputs.tf`**

```hcl
output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "Use as EXPO_PUBLIC_API_URL base in eas.json (prefix with http://)"
}

output "rds_endpoint" {
  value     = aws_db_instance.postgres.address
  sensitive = true
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}

output "secret_arn" {
  value     = aws_secretsmanager_secret.app.arn
  sensitive = true
}
```

- [ ] **Step 5: Write `infra/terraform/env/backend-dev.hcl`**

```hcl
bucket         = "onsitemonday-terraform-state"
key            = "env/dev/terraform.tfstate"
region         = "eu-west-2"
dynamodb_table = "onsitemonday-terraform-locks"
encrypt        = true
```

- [ ] **Step 6: Write `infra/terraform/env/backend-staging.hcl`**

```hcl
bucket         = "onsitemonday-terraform-state"
key            = "env/staging/terraform.tfstate"
region         = "eu-west-2"
dynamodb_table = "onsitemonday-terraform-locks"
encrypt        = true
```

- [ ] **Step 7: Write `infra/terraform/env/dev.tfvars`**

Fill in real values before applying. The `ecr_repository_url` comes from Task 2 Step 4 output.

```hcl
env                  = "dev"
aws_region           = "eu-west-2"
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.0.0/24", "10.0.1.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]

db_password          = "REPLACE_ME_DEV_DB_PASSWORD_32CHARS"
cognito_user_pool_id = "eu-west-2_REPLACE_ME"
cognito_client_id    = "REPLACE_ME_DEV_CLIENT_ID"
ecr_repository_url   = "123456789.dkr.ecr.eu-west-2.amazonaws.com/onsitemonday-api"
image_tag            = "latest"
task_cpu             = 256
task_memory          = 512
```

- [ ] **Step 8: Write `infra/terraform/env/staging.tfvars`**

```hcl
env                  = "staging"
aws_region           = "eu-west-2"
vpc_cidr             = "10.1.0.0/16"
public_subnet_cidrs  = ["10.1.0.0/24", "10.1.1.0/24"]
private_subnet_cidrs = ["10.1.10.0/24", "10.1.11.0/24"]

db_password          = "REPLACE_ME_STAGING_DB_PASSWORD_DIFFERENT"
cognito_user_pool_id = "eu-west-2_REPLACE_ME"
cognito_client_id    = "REPLACE_ME_STAGING_CLIENT_ID"
ecr_repository_url   = "123456789.dkr.ecr.eu-west-2.amazonaws.com/onsitemonday-api"
image_tag            = "latest"
task_cpu             = 256
task_memory          = 512
```

- [ ] **Step 9: Add Terraform exclusions to `.gitignore`**

Append to the root `.gitignore`:

```
# Terraform — state files and tfvars contain secrets/generated data
**/.terraform/
*.tfstate
*.tfstate.backup
.terraform.lock.hcl
infra/terraform/env/*.tfvars
```

- [ ] **Step 10: Commit Terraform files (not tfvars)**

```bash
git add infra/terraform/env/main.tf \
        infra/terraform/env/variables.tf \
        infra/terraform/env/outputs.tf \
        infra/terraform/env/backend-dev.hcl \
        infra/terraform/env/backend-staging.hcl \
        .gitignore
git commit -m "feat: add parametrized Terraform for dev and staging environments"
```

---

## Task 4: Apply Dev Environment

**Files:** No new files — run Terraform and push initial Docker image.

Before ECS can start a task, at least one image must exist in ECR. Push a bootstrap image locally before applying.

- [ ] **Step 1: Authenticate Docker to ECR**

Replace `<ACCOUNT_ID>` with your AWS account ID from `aws sts get-caller-identity`.

```bash
aws ecr get-login-password --region eu-west-2 | \
  docker login --username AWS \
  --password-stdin <ACCOUNT_ID>.dkr.ecr.eu-west-2.amazonaws.com
```

Expected: `Login Succeeded`

- [ ] **Step 2: Build and push bootstrap image**

The `Dockerfile` lives in `backend/` and uses relative paths — build from the repo root with `-f` flag.

```bash
docker build \
  -f backend/Dockerfile \
  -t <ACCOUNT_ID>.dkr.ecr.eu-west-2.amazonaws.com/onsitemonday-api:latest \
  backend/

docker push <ACCOUNT_ID>.dkr.ecr.eu-west-2.amazonaws.com/onsitemonday-api:latest
```

Expected: `Push complete` for all layers.

- [ ] **Step 3: Apply dev Terraform**

Fill in the real values in `dev.tfvars` first (db_password, cognito IDs, account ID in ecr_repository_url).

```bash
cd infra/terraform/env
terraform init -backend-config=backend-dev.hcl
terraform apply -var-file=dev.tfvars
```

Type `yes` when prompted. RDS provisioning takes ~5 minutes.

Expected final output:
```
Apply complete! Resources: 22 added, 0 changed, 0 destroyed.

Outputs:
alb_dns_name = "onsitemonday-dev-alb-XXXXXXXX.eu-west-2.elb.amazonaws.com"
```

**Record the `alb_dns_name` — this is the dev API base URL.**

- [ ] **Step 4: Verify health check**

Wait ~3 minutes for ECS task to start and EF migrations to run, then:

```bash
DEV_ALB=$(terraform output -raw alb_dns_name)
curl http://$DEV_ALB/api/health
```

Expected: `{"status":"healthy",...}` HTTP 200.

If you get 502: the task is still starting. Check logs:

```bash
aws logs tail /ecs/onsitemonday-dev --follow --region eu-west-2
```

Common causes of 502:
- Secrets Manager resolution failed: verify the task execution role policy was applied
- EF migration error: check the connection string in the secret matches the RDS endpoint
- Image not found in ECR: confirm `image_tag = "latest"` in tfvars and image was pushed

---

## Task 5: Apply Staging Environment

**Files:** No new files — same Terraform config, different backend and vars.

- [ ] **Step 1: Re-init Terraform with staging backend**

```bash
cd infra/terraform/env
terraform init -reconfigure -backend-config=backend-staging.hcl
```

The `-reconfigure` flag switches the state backend without migrating state (correct — these are independent environments).

- [ ] **Step 2: Apply staging Terraform**

Fill in real values in `staging.tfvars` (different db_password and cognito IDs from dev).

```bash
terraform apply -var-file=staging.tfvars
```

Expected:
```
Apply complete! Resources: 22 added, 0 changed, 0 destroyed.

Outputs:
alb_dns_name = "onsitemonday-staging-alb-YYYYYYYY.eu-west-2.elb.amazonaws.com"
```

**Record the staging `alb_dns_name`.**

- [ ] **Step 3: Verify staging health check**

```bash
STAGING_ALB=$(terraform output -raw alb_dns_name)
curl http://$STAGING_ALB/api/health
```

Expected: HTTP 200 JSON health response.

---

## Task 6: GitHub Actions CI/CD for API

**Files:**
- Create: `.github/workflows/deploy-api-dev.yml`
- Create: `.github/workflows/deploy-api-staging.yml`

**Prerequisite:** In GitHub repo Settings → Secrets and variables → Actions, add:
- `AWS_GITHUB_ACTIONS_ROLE_ARN` = the `github_actions_role_arn` output from Task 2

- [ ] **Step 1: Create workflows directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `.github/workflows/deploy-api-dev.yml`**

Triggers on push to `main` when `backend/` files change. Registers a new task definition revision with the commit SHA image tag, then deploys it.

```yaml
name: Deploy API to Dev

on:
  push:
    branches:
      - main
    paths:
      - "backend/**"

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: eu-west-2
  ECR_REPOSITORY: onsitemonday-api
  ECS_CLUSTER: onsitemonday-dev-cluster
  ECS_SERVICE: onsitemonday-dev-api
  CONTAINER_NAME: api

jobs:
  deploy:
    name: Build and deploy to dev
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_GITHUB_ACTIONS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build \
            -f backend/Dockerfile \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest-dev \
            backend/
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest-dev
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition onsitemonday-dev-api \
            --query taskDefinition \
            > task-definition.json

      - name: Update image in task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
          wait-for-minutes: 10
```

- [ ] **Step 3: Write `.github/workflows/deploy-api-staging.yml`**

Manual dispatch only — Hugh triggers this when he's ready for testers to use a build.

```yaml
name: Deploy API to Staging

on:
  workflow_dispatch:
    inputs:
      image_sha:
        description: "Git SHA to deploy (leave blank to build from current HEAD)"
        required: false
        default: ""

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: eu-west-2
  ECR_REPOSITORY: onsitemonday-api
  ECS_CLUSTER: onsitemonday-staging-cluster
  ECS_SERVICE: onsitemonday-staging-api
  CONTAINER_NAME: api

jobs:
  deploy:
    name: Build and deploy to staging
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_GITHUB_ACTIONS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.event.inputs.image_sha || github.sha }}
        run: |
          docker build \
            -f backend/Dockerfile \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest-staging \
            backend/
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest-staging
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition onsitemonday-staging-api \
            --query taskDefinition \
            > task-definition.json

      - name: Update image in task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
          wait-for-minutes: 10
```

- [ ] **Step 4: Commit and push to trigger first CI deploy**

```bash
git add .github/workflows/deploy-api-dev.yml \
        .github/workflows/deploy-api-staging.yml
git commit -m "feat: add GitHub Actions CI/CD for dev and staging API deployments"
git push origin main
```

Expected: GitHub Actions triggers `deploy-api-dev.yml`. Check the Actions tab — all steps should go green in ~5 minutes.

- [ ] **Step 5: Verify CI deploy succeeded**

```bash
curl http://<DEV_ALB_DNS>/api/health
```

Expected: HTTP 200. The response should come from the newly deployed image (check CloudWatch logs for the deployment timestamp).

---

## Task 7: EAS Build Profiles + App Tester Distribution

**Files:**
- Modify: `frontend/eas.json`
- Create: `.github/workflows/build-app-staging.yml`

Replace `<DEV_ALB_DNS>` and `<STAGING_ALB_DNS>` with the actual ALB DNS names from Tasks 4 and 5. Replace the Cognito placeholder values with real values from your provisioned User Pools.

**Prerequisite:** Add `EXPO_TOKEN` as a GitHub Actions secret. Get it from expo.dev → Account Settings → Access Tokens → Create Token.

- [ ] **Step 1: Update `frontend/eas.json`**

Current `eas.json` has a `preview` profile with Firebase env vars and the Railway API URL. Replace the entire file:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://<DEV_ALB_DNS>/api",
        "EXPO_PUBLIC_AWS_REGION": "eu-west-2",
        "EXPO_PUBLIC_COGNITO_USER_POOL_ID": "<DEV_COGNITO_USER_POOL_ID>",
        "EXPO_PUBLIC_COGNITO_CLIENT_ID": "<DEV_COGNITO_CLIENT_ID>",
        "EXPO_PUBLIC_COGNITO_DOMAIN": "<DEV_COGNITO_DOMAIN>"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://<STAGING_ALB_DNS>/api",
        "EXPO_PUBLIC_AWS_REGION": "eu-west-2",
        "EXPO_PUBLIC_COGNITO_USER_POOL_ID": "<STAGING_COGNITO_USER_POOL_ID>",
        "EXPO_PUBLIC_COGNITO_CLIENT_ID": "<STAGING_COGNITO_CLIENT_ID>",
        "EXPO_PUBLIC_COGNITO_DOMAIN": "<STAGING_COGNITO_DOMAIN>"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://onsite-monday-production.up.railway.app/api"
      }
    }
  }
}
```

- [ ] **Step 2: Verify `frontend/src/services/api.ts` reads `EXPO_PUBLIC_API_URL`**

```bash
grep -n "EXPO_PUBLIC_API_URL" frontend/src/services/api.ts
```

Expected output: `process.env.EXPO_PUBLIC_API_URL` on line 11 (already confirmed).

- [ ] **Step 3: Write `.github/workflows/build-app-staging.yml`**

```yaml
name: Build Mobile App for Staging (Testers)

on:
  workflow_dispatch:
    inputs:
      platform:
        description: "Platform to build"
        required: true
        default: "all"
        type: choice
        options:
          - all
          - android
          - ios

permissions:
  contents: read

jobs:
  build:
    name: EAS Build — preview profile
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Install EAS CLI
        run: npm install -g eas-cli

      - name: Build with EAS internal distribution
        working-directory: frontend
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
        run: |
          PLATFORM="${{ github.event.inputs.platform }}"
          if [ "$PLATFORM" = "all" ]; then
            eas build --profile preview --platform all --non-interactive
          else
            eas build --profile preview --platform $PLATFORM --non-interactive
          fi
```

- [ ] **Step 4: Commit and push**

```bash
git add frontend/eas.json .github/workflows/build-app-staging.yml
git commit -m "feat: add EAS dev and staging build profiles with internal distribution"
git push origin main
```

- [ ] **Step 5: Trigger a staging tester build**

In GitHub → Actions → "Build Mobile App for Staging (Testers)" → Run workflow → platform: `all`.

Build takes ~15-20 minutes. When complete, the EAS dashboard at expo.dev shows download links.

- [ ] **Step 6: Share with testers**

From expo.dev → Builds → find the latest staging build → copy the install link. iOS testers must first register their UDID at the Expo device registration URL (shown in the build details). Android testers download the APK directly.

---

## Updating Secrets After Deployment

If you need to add or change a secret value (e.g., adding a Stripe test key) without running `terraform apply`:

```bash
# Read current secret, add a key, write back
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id onsitemonday-dev/app \
  --query SecretString \
  --output text)

NEW=$(echo $CURRENT | jq '. + {"Stripe__SecretKey": "sk_test_REPLACE_ME"}')

aws secretsmanager put-secret-value \
  --secret-id onsitemonday-dev/app \
  --secret-string "$NEW"

# Force ECS to restart and pick up the new secret
aws ecs update-service \
  --cluster onsitemonday-dev-cluster \
  --service onsitemonday-dev-api \
  --force-new-deployment \
  --region eu-west-2
```

---

## Verification Checklist

### Dev environment
- [ ] `curl http://<DEV_ALB_DNS>/api/health` → HTTP 200
- [ ] Push a backend change to `main` → GitHub Actions "Deploy API to Dev" completes green
- [ ] CloudWatch log group `/ecs/onsitemonday-dev` shows app startup and EF migration logs
- [ ] RDS instance `onsitemonday-dev-postgres` visible in AWS Console

### Staging environment
- [ ] `curl http://<STAGING_ALB_DNS>/api/health` → HTTP 200
- [ ] Manual trigger "Deploy API to Staging" → completes green
- [ ] "Build Mobile App for Staging" → produces APK + IPA download links on expo.dev

### End-to-end with app
- [ ] Preview build app opens sign-in screen
- [ ] Sign in with email → Cognito auth token accepted by staging API → `GET /api/jobs` returns 200

---

## Estimated Monthly AWS Cost (eu-west-2)

| Resource | Dev | Staging | Total |
|----------|-----|---------|-------|
| RDS db.t3.micro | ~£13 | ~£13 | £26 |
| ECS Fargate (256 CPU / 512 MB, ~730h) | ~£10 | ~£10 | £20 |
| ALB | ~£16 | ~£16 | £32 |
| ECR storage (~1 GB) | ~£0.50 | — | £0.50 |
| CloudWatch Logs | ~£1 | ~£1 | £2 |
| **Total** | | | **~£80/month** |

To reduce cost when not in use, stop ECS services and RDS instances:

```bash
# Stop dev (set desired count to 0, stop RDS)
aws ecs update-service --cluster onsitemonday-dev-cluster \
  --service onsitemonday-dev-api --desired-count 0 --region eu-west-2

aws rds stop-db-instance --db-instance-identifier onsitemonday-dev-postgres \
  --region eu-west-2

# Restart when needed
aws ecs update-service --cluster onsitemonday-dev-cluster \
  --service onsitemonday-dev-api --desired-count 1 --region eu-west-2

aws rds start-db-instance --db-instance-identifier onsitemonday-dev-postgres \
  --region eu-west-2
```
