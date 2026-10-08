# Empty until the implementation guideline reaches staging. Before real patient data (Stage A),
# staging moves to its own AWS account and state bucket (ADR 0005, ADR 0006).

provider "aws" {
  region = var.region
  default_tags {
    tags = module.naming.tags
  }
}

module "naming" {
  source      = "../../modules/naming"
  environment = "staging"
  region      = var.region
}
