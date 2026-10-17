# Dev: one host running the apps, PostgreSQL and Redis in Docker, no NAT gateway and no load
# balancer (ADR 0005, ADR 0008). Synthetic data only.

provider "aws" {
  region = "ap-south-1" # Mumbai, pinned: never from a variable or default (PR-06)
  default_tags {
    tags = module.naming.tags
  }
}

data "aws_region" "current" {}

module "naming" {
  source      = "../../modules/naming"
  environment = "dev"
  region      = data.aws_region.current.region
}

locals {
  parameter_path = "/${module.naming.project}/dev"
}

data "aws_caller_identity" "current" {}

module "network" {
  source   = "../../modules/network"
  name     = module.naming.prefix
  vpc_cidr = "10.20.0.0/16"
}

module "keys" {
  source               = "../../modules/kms-keys"
  name                 = module.naming.prefix
  deletion_window_days = 7 # dev only: shortest recovery window
}

module "uploads" {
  source      = "../../modules/private-bucket"
  name        = "${module.naming.prefix}-uploads-${data.aws_caller_identity.current.account_id}"
  kms_key_arn = module.keys.key_arns["documents"]
}

module "snapshots" {
  source = "../../modules/snapshots"
  name   = module.naming.prefix
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
  kms_key_arns        = values(module.keys.key_arns)
  uploads_bucket_arn  = module.uploads.arn
  # Created by infra/github-oidc (D5: the existing heach-credit-reminders topic).
  alert_topic_arn = "arn:aws:sns:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:${module.naming.project}-credit-reminders"
}
