# Generated credentials for the dev host's own PostgreSQL and Redis, stored as SSM SecureString
# parameters (free tier; encrypted with the AWS-managed key). The host reads them at deploy time.
# They also live in the OpenTofu state, which is why the state bucket is private and encrypted.

resource "random_password" "postgres" {
  length  = 32
  special = false
}

resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "postgres_password" {
  name  = "${local.parameter_path}/POSTGRES_PASSWORD"
  type  = "SecureString"
  value = random_password.postgres.result
}

resource "aws_ssm_parameter" "redis_password" {
  name  = "${local.parameter_path}/REDIS_PASSWORD"
  type  = "SecureString"
  value = random_password.redis.result
}
