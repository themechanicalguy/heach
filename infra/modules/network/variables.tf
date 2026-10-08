variable "name" {
  description = "Name prefix from the naming module, for example heach-dev."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC range; the public subnet is its first /24."
  type        = string
}

variable "admin_allowed_cidrs" {
  description = "IPv4 ranges allowed to reach the admin panel (SE-04). Empty = admin closed to everyone."
  type        = list(string)
}
