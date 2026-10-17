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
  description = "Monthly usage budget before credits; the forecast alert fires when usage is expected to exceed it."
  type        = number
  default     = 20
}

variable "alert_thresholds_usd" {
  description = "Monthly usage alerts before credits, in US dollars (the lean dev host uses about 18.50)."
  type        = list(number)
  default     = [10, 20, 30]
}

variable "credit_pool_usd" {
  description = "Free plan credits shown on the Billing Credits page. Raise to 200 if AWS grants more."
  type        = number
  default     = 100
}

variable "credits_start_date" {
  description = "First day credits were used (YYYY-MM-DD); usage from this date counts against the pool."
  type        = string
  default     = "2026-10-01"
}

variable "credits_expiry_date" {
  description = "Date the Free plan credits expire and the account closes unless upgraded (Billing console)."
  type        = string
  default     = "2027-04-17"
}

variable "expiry_reminder_days" {
  description = "Email reminders this many days before credits_expiry_date."
  type        = list(number)
  default     = [30, 7]
}
