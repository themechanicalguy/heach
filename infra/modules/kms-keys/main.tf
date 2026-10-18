# One customer managed key per data domain (EN-04, EN-06), yearly rotation (EN-05).
# The default key policy delegates to IAM, so access is granted by role policies only.

variable "name" {
  description = "Name prefix from the naming module, for example heach-dev."
  type        = string
}

variable "domains" {
  description = "Data domains from the requirements (EN-06), plus backup: its own key for database backups (EN-10, D1)."
  type        = list(string)
  default     = ["health", "identity", "payments", "documents", "backup"]
}

variable "deletion_window_days" {
  description = "Days a key stays recoverable after deletion is scheduled (7 to 30)."
  type        = number
  default     = 30
}

resource "aws_kms_key" "domain" {
  for_each                = toset(var.domains)
  description             = "${var.name} ${each.key} data"
  enable_key_rotation     = true
  rotation_period_in_days = 365
  deletion_window_in_days = var.deletion_window_days
  tags                    = { DataDomain = each.key }
}

resource "aws_kms_alias" "domain" {
  for_each      = aws_kms_key.domain
  name          = "alias/${var.name}-${each.key}"
  target_key_id = each.value.key_id
}

output "key_arns" {
  description = "Key ARN per data domain."
  value       = { for domain, key in aws_kms_key.domain : domain => key.arn }
}
