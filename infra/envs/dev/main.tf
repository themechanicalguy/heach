# Dev: one host running the apps, PostgreSQL and Redis in Docker (ADR 0005). Synthetic data only.

provider "aws" {
  region = var.region
  default_tags {
    tags = module.naming.tags
  }
}

module "naming" {
  source      = "../../modules/naming"
  environment = "dev"
  region      = var.region
}

locals {
  parameter_path = "/${module.naming.project}/dev"
}

module "network" {
  source              = "../../modules/network"
  name                = module.naming.prefix
  vpc_cidr            = "10.20.0.0/16"
  admin_allowed_cidrs = var.admin_allowed_cidrs
}

module "registry" {
  source       = "../../modules/registry"
  project      = module.naming.project
  force_delete = true # dev only: lets `tofu destroy` remove repositories with images
}

module "host" {
  source              = "../../modules/app-host"
  name                = module.naming.prefix
  instance_type       = var.instance_type
  root_volume_gb      = var.root_volume_gb
  subnet_id           = module.network.subnet_id
  security_group_id   = module.network.host_security_group_id
  ecr_repository_arns = module.registry.repository_arns
  parameter_path      = local.parameter_path
}
