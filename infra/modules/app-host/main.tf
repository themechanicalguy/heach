# The app host: one ARM instance running the apps, PostgreSQL and Redis in Docker, behind Caddy.
# Synthetic data only (SO-07). Managed RDS and ElastiCache replace the containers before real data.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Latest Amazon Linux 2023 for ARM, from AWS's public parameter.
data "aws_ssm_parameter" "al2023_arm" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_iam_role" "host" {
  name = "${var.name}-host"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Session Manager access and command execution, instead of SSH (SO-06).
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

locals {
  parameter_arn_prefix = "arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${var.parameter_path}"
}

# The host itself: deploy.sh, database bootstrap and migrations, and nightly backups. It reads the
# environment's parameters, including the administrator and migrator passwords, so no container
# may use it: instance metadata is out of a container's reach (hop limit 1 below).
resource "aws_iam_role_policy" "host" {
  name = "pull-images-read-config"
  role = aws_iam_role.host.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = "ecr:GetAuthorizationToken", Resource = "*" },
      {
        Effect   = "Allow"
        Action   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
        Resource = var.ecr_repository_arns
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "${local.parameter_arn_prefix}/*"
      },
      # Short-lived credentials of the API role for the API container (api-credentials.sh).
      {
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = aws_iam_role.api.arn
      },
      # The backup key only: dumps are encrypted with it on upload (EN-10.3). Only these two
      # actions (EN-04.2).
      {
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource = var.backup_kms_key_arn
      },
      # Nightly dumps (EN-10.3): write and read for restores; no delete, so a compromised host
      # cannot erase the history (versioning keeps replaced objects).
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${var.backups_bucket_arn}/pg/*"
      },
      {
        Effect    = "Allow"
        Action    = "s3:ListBucket"
        Resource  = var.backups_bucket_arn
        Condition = { StringLike = { "s3:prefix" = ["pg/*"] } }
      },
    ]
  })
}

# The API's own identity (security review 2026-10-24, finding 7): exactly its runtime
# parameters, never the administrator or migrator password; the data-domain keys; uploads; alerts.
# Only the host role may assume it, and only for one hour at a time.
resource "aws_iam_role" "api" {
  name                 = "${var.name}-api"
  max_session_duration = 3600
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = aws_iam_role.host.arn }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "api" {
  name = "api-runtime"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # By exact name, as the API asks for them (apps/api/src/secrets/load-secrets.ts).
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameters"
        Resource = [for name in var.api_parameter_names : "${local.parameter_arn_prefix}/${name}"]
      },
      # Envelope encryption with the data-domain keys: the app asks KMS for data keys, never
      # sees the master keys (EN-04). No key administration.
      {
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"] # only these two (EN-04.2)
        Resource = var.kms_key_arns
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${var.uploads_bucket_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = var.uploads_bucket_arn
      },
      # Security alerts from the API (SO-08.3) to the on-call topic (D5).
      {
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = var.alert_topic_arn
      },
    ]
  })
}

resource "aws_iam_instance_profile" "host" {
  name = "${var.name}-host"
  role = aws_iam_role.host.name
}

resource "aws_instance" "host" {
  ami                    = data.aws_ssm_parameter.al2023_arm.value
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.host.name
  user_data              = file("${path.module}/user-data.sh")

  metadata_options {
    http_tokens = "required" # IMDSv2 only
    # 1: a container (one network hop further) cannot get a metadata token, so it can never use
    # the host role. The API container uses the API role's credentials (api-credentials.sh).
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_gb
    encrypted             = true # EN-02
    delete_on_termination = true
  }

  tags = { Name = var.name, Snapshot = "daily" } # picked up by the snapshots module

  lifecycle {
    ignore_changes = [ami] # new AMIs do not replace the host; rebuild deliberately
  }
}

resource "aws_eip" "host" {
  instance = aws_instance.host.id
  domain   = "vpc"
  tags     = { Name = var.name }
}
