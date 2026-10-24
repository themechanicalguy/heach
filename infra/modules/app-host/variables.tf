variable "name" {
  description = "Name prefix from the naming module, for example heach-dev."
  type        = string
}

variable "instance_type" {
  description = "ARM (Graviton) instance type."
  type        = string
}

variable "root_volume_gb" {
  description = "Encrypted root volume size."
  type        = number
}

variable "subnet_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "ecr_repository_arns" {
  description = "Repositories the host may pull from."
  type        = list(string)
}

variable "parameter_path" {
  description = "SSM parameter path the host may read, for example /heach/dev."
  type        = string
}

variable "kms_key_arns" {
  description = "Data-domain keys the API may use for envelope encryption."
  type        = list(string)
}

variable "backup_kms_key_arn" {
  description = "Key the host encrypts nightly database dumps with."
  type        = string
}

variable "api_parameter_names" {
  description = "Names under parameter_path the API role may read; never the admin or migrator password."
  type        = list(string)
  validation {
    condition     = length(setintersection(var.api_parameter_names, ["POSTGRES_PASSWORD", "DB_MIGRATOR_PASSWORD"])) == 0
    error_message = "The API role must not read the database administrator or migrator password."
  }
}

variable "uploads_bucket_arn" {
  description = "Bucket for uploaded files."
  type        = string
}

variable "alert_topic_arn" {
  description = "SNS topic the API publishes security alerts to (Step 2 decision D5)."
  type        = string
}

variable "backups_bucket_arn" {
  description = "Bucket for nightly database dumps; the host may write and read, never delete."
  type        = string
}
