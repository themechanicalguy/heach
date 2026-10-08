variable "region" {
  description = "Primary AWS region. All data stays in India regions (PR-06)."
  type        = string
  default     = "ap-south-1" # Mumbai
}

variable "github_repository" {
  description = "owner/name of the GitHub repository allowed to deploy."
  type        = string
  default     = "themechanicalguy/heach"
}

variable "budget_email" {
  description = "Email address that receives budget alerts."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly budget; the forecast alert fires when spend is expected to exceed it."
  type        = number
  default     = 20
}

variable "alert_thresholds_usd" {
  description = "Actual-spend alerts, in US dollars."
  type        = list(number)
  default     = [1, 5, 20]
}
