# Empty until the implementation guideline reaches production. Before real patient data (Stage A),
# production moves to its own AWS account and state bucket (ADR 0005, ADR 0006).

provider "aws" {
  region = var.region
  default_tags {
    tags = module.naming.tags
  }
}

module "naming" {
  source      = "../../modules/naming"
  environment = "production"
  region      = var.region
}
