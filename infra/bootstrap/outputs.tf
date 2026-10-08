output "state_bucket" {
  description = "Set as bucket in each stack's backend.hcl."
  value       = aws_s3_bucket.state.bucket
}
