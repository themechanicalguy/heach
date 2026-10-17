variable "state_version_retention_days" {
  description = "Days a replaced state version is kept for recovery."
  type        = number
  default     = 90
}
