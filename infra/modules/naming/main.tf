# Naming and tagging convention for every HEACH stack: <project>-<environment>[-<component>].
# Validates the environment and keeps every stack in an India region (PR-06).

variable "project" {
  description = "Application slug used in every name and the Project tag."
  type        = string
  default     = "heach"
}

variable "environment" {
  description = "dev, staging or production; shared for account-wide stacks (bootstrap, github-oidc)."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production", "shared"], var.environment)
    error_message = "environment must be dev, staging, production or shared."
  }
}

variable "region" {
  description = "AWS region of the stack."
  type        = string
  validation {
    condition     = contains(["ap-south-1", "ap-south-2"], var.region)
    error_message = "All data stays in India: region must be ap-south-1 (Mumbai) or ap-south-2 (Hyderabad)."
  }
}

variable "owner" {
  description = "GitHub handle or team that owns the stack (matches CODEOWNERS)."
  type        = string
  default     = "themechanicalguy"
}

output "prefix" {
  description = "Prefix for resource names, for example heach-dev."
  value       = "${var.project}-${var.environment}"
}

output "tags" {
  description = "Standard tags; pass to the provider's default_tags."
  value = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "opentofu"
    Owner       = var.owner
  }
}

output "project" {
  description = "The application slug, for names that are not per environment."
  value       = var.project
}
