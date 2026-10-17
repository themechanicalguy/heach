variable "instance_type" {
  description = "ARM (Graviton) instance for the dev host; 2 GB RAM runs the apps, PostgreSQL and Redis."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_gb" {
  description = "Encrypted root volume size."
  type        = number
  default     = 20
}
