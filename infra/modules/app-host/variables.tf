variable "name" {
  description = "Name prefix from the naming module, for example heach-dev."
  type        = string
}

variable "instance_type" {
  description = "ARM (Graviton) instance type."
  type        = string
}

variable "root_volume_gb" {
  description = "Encrypted root volume size."
  type        = number
}

variable "subnet_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "ecr_repository_arns" {
  description = "Repositories the host may pull from."
  type        = list(string)
}

variable "parameter_path" {
  description = "SSM parameter path the host may read, for example /heach/dev."
  type        = string
}
