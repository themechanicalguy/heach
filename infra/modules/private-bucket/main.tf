# Private, versioned, KMS-encrypted bucket: public access blocked, TLS only, no ACLs (EN-02, EN-07).

variable "name" {
  description = "Globally unique bucket name."
  type        = string
}

variable "kms_key_arn" {
  description = "Customer managed key for SSE-KMS."
  type        = string
}

variable "noncurrent_version_days" {
  description = "Days a replaced or deleted object version is kept."
  type        = number
  default     = 30
}

variable "current_version_days" {
  description = "Days after which current objects expire; null keeps them until deleted."
  type        = number
  default     = null
}

resource "aws_s3_bucket" "this" {
  bucket = var.name
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true # fewer KMS requests, lower cost
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_days
    }
    dynamic "expiration" {
      for_each = var.current_version_days == null ? [] : [var.current_version_days]
      content {
        days = expiration.value
      }
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  bucket = aws_s3_bucket.this.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# EN-01: refuse any request that is not over TLS.
resource "aws_s3_bucket_policy" "tls_only" {
  bucket = aws_s3_bucket.this.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.this.arn, "${aws_s3_bucket.this.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

output "arn" {
  value = aws_s3_bucket.this.arn
}

output "name" {
  value = aws_s3_bucket.this.bucket
}
