terraform {
  required_version = "~> 1.13.0"

  # Partial configuration: bucket comes from backend.hcl (see infra/backend.hcl.example).
  # use_lockfile = S3-native state locking, no DynamoDB table needed.
  backend "s3" {
    key          = "shared/paid-plan-budgets/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.68.0"
    }
  }
}
