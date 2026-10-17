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

variable "admin_allowed_cidrs" {
  description = "IPv4 ranges allowed to reach the admin panel (SE-04). Empty = admin closed to everyone."
  type        = list(string)
  default     = []
}
