# Account-wide CI access and cost guard, applied by a human after bootstrap:
#   - GitHub Actions OIDC provider and a deploy role (no long-lived AWS keys in GitHub)
#   - budgets and credit alerts (budgets.tf)

provider "aws" {
  region = "ap-south-1" # Mumbai, pinned: never from a variable or default (PR-06)
  default_tags {
    tags = merge(module.naming.tags, { Stack = "github-oidc" })
  }
}

data "aws_region" "current" {}

module "naming" {
  source      = "../modules/naming"
  environment = "shared"
  region      = data.aws_region.current.region
}

data "aws_caller_identity" "current" {}

# --- GitHub Actions deploy role (OIDC) ------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_deploy" {
  name = "${module.naming.project}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        # Only workflows on main of this repository can deploy. GitHub sends the immutable
        # subject (owner and repository IDs), so a renamed or re-created repository cannot.
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "${var.github_oidc_subject_prefix}:ref:refs/heads/main"
        }
      }
    }]
  })
}

# Least privilege: push images to HEACH repositories and run commands on HEACH-tagged hosts.
resource "aws_iam_role_policy" "github_deploy" {
  name = "deploy"
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = "ecr:GetAuthorizationToken", Resource = "*" },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage",
          "ecr:DescribeImages", "ecr:DescribeImageScanFindings", # scan gate in Deploy dev
        ]
        Resource = "arn:aws:ecr:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:repository/heach/*"
      },
      {
        Effect   = "Allow"
        Action   = "ssm:SendCommand"
        Resource = "arn:aws:ssm:${data.aws_region.current.region}::document/AWS-RunShellScript"
      },
      {
        Effect    = "Allow"
        Action    = "ssm:SendCommand"
        Resource  = "arn:aws:ec2:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:instance/*"
        Condition = { StringEquals = { "aws:ResourceTag/Project" = "heach" } }
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation", "ec2:DescribeInstances"]
        Resource = "*"
      },
    ]
  })
}
