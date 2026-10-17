# Empty until the implementation guideline reaches staging. Before real patient data (Stage A),
# staging moves to its own AWS account and state bucket (ADR 0005, ADR 0006).

provider "aws" {
  region = "ap-south-1" # Mumbai, pinned: never from a variable or default (PR-06)
  default_tags {
    tags = module.naming.tags
  }
}

data "aws_region" "current" {}

module "naming" {
  source      = "../../modules/naming"
  environment = "staging"
  region      = data.aws_region.current.region
}
