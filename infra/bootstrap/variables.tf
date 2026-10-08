variable "region" {
  description = "Region of the state bucket. All data stays in India regions (PR-06)."
  type        = string
  default     = "ap-south-1" # Mumbai
}

variable "state_version_retention_days" {
  description = "Days a replaced state version is kept for recovery."
  type        = number
  default     = 90
}
