# Nightly EBS snapshots of instances tagged Snapshot = "daily" (EN-10, partly: same region only).
# Snapshots of encrypted volumes are encrypted with the same key.

variable "name" {
  description = "Name prefix from the naming module, for example heach-dev."
  type        = string
}

variable "retain_days" {
  description = "Number of daily snapshots kept."
  type        = number
  default     = 7
}

resource "aws_iam_role" "dlm" {
  name = "${var.name}-snapshots"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "dlm.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "daily" {
  description        = "${var.name} nightly snapshots"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["INSTANCE"]
    target_tags    = { Snapshot = "daily" }

    schedule {
      name      = "nightly"
      copy_tags = true
      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["20:30"] # UTC = 02:00 IST, lowest traffic
      }
      retain_rule {
        count = var.retain_days
      }
    }
  }
}
