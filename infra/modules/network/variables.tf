variable "name" {
  description = "Name prefix from the naming module, for example heach-dev."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC range; the public subnet is its first /24."
  type        = string
}
