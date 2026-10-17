variable "monthly_cap_usd" {
  description = "Monthly cap after the upgrade: the B2R lean estimate (about 18.50) plus 25 percent."
  type        = number
  default     = 23
}

variable "alert_emails" {
  description = "Addresses for budget alerts (up to 10)."
  type        = list(string)
}
