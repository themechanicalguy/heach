terraform {
  required_version = ">= 1.10"

  # Partial configuration: bucket comes from backend.hcl (see backend.hcl.example).
  # use_lockfile = S3-native state locking, no DynamoDB table needed.
  backend "s3" {
    key          = "envs/dev/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "heach", Environment = "dev", ManagedBy = "opentofu" }
  }
}
