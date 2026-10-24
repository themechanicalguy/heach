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

# Step 2 (EN-10.2, EN-09, EN-12.1): passwords for the migrations and API database roles, and the
# root key for blind indexes. The API reads these at start-up; nothing else holds them.
resource "random_password" "db_app" {
  length  = 32
  special = false
}

resource "random_password" "db_migrator" {
  length  = 32
  special = false
}

resource "random_id" "blind_index_key" {
  byte_length = 32
}

resource "aws_ssm_parameter" "db_app_password" {
  name  = "${local.parameter_path}/DB_APP_PASSWORD"
  type  = "SecureString"
  value = random_password.db_app.result
}

resource "aws_ssm_parameter" "db_migrator_password" {
  name  = "${local.parameter_path}/DB_MIGRATOR_PASSWORD"
  type  = "SecureString"
  value = random_password.db_migrator.result
}

resource "aws_ssm_parameter" "blind_index_key" {
  name  = "${local.parameter_path}/BLIND_INDEX_KEY"
  type  = "SecureString"
  value = random_id.blind_index_key.hex
}

# Security review 2026-10-24, finding 2: the key the test sign-in requires on this host. Only the
# API (by name) and the loopback-only Caddy entry hold it; the public entry never sends it.
resource "random_id" "test_login_key" {
  byte_length = 32
}

resource "aws_ssm_parameter" "test_login_key" {
  name  = "${local.parameter_path}/TEST_LOGIN_KEY"
  type  = "SecureString"
  value = random_id.test_login_key.hex
}
