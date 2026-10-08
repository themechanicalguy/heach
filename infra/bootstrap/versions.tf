terraform {
  required_version = "~> 1.13.0"

  # Local state on purpose: this stack creates the bucket that the remote backend needs.

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.68.0"
    }
  }
}
