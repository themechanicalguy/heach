variable "project" {
  description = "Repository namespace, for example heach (repositories are heach/<app>)."
  type        = string
}

variable "apps" {
  description = "One repository per app."
  type        = list(string)
  default     = ["web", "admin", "api"]
}

variable "force_delete" {
  description = "Let destroy remove repositories that still hold images. Dev only."
  type        = bool
  default     = false
}

variable "keep_images" {
  description = "Images kept per repository; older ones are deleted automatically."
  type        = number
  default     = 5
}
