# Cost alerts. Budgets count credits as a discount by default, so while the Free plan credits
# last a normal budget sees $0 and never fires. Both budgets below exclude credits: they track
# real usage, which is what the credits are paying for.

locals {
  usage_before_credits = {
    include_credit = false
    include_refund = false
  }
}

# Burn rate: usage per month, before credits.
resource "aws_budgets_budget" "monthly" {
  name         = "${module.naming.project}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = local.usage_before_credits.include_credit
    include_refund = local.usage_before_credits.include_refund
  }

  dynamic "notification" {
    for_each = var.alert_thresholds_usd
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "ABSOLUTE_VALUE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_email]
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}

# Credit pool: total usage since the credits started, against the pool. One annual period
# covers the six-month Free plan.
resource "aws_budgets_budget" "credits" {
  name              = "${module.naming.project}-free-credits"
  budget_type       = "COST"
  limit_amount      = tostring(var.credit_pool_usd)
  limit_unit        = "USD"
  time_unit         = "ANNUALLY"
  time_period_start = "${var.credits_start_date}_00:00"

  cost_types {
    include_credit = local.usage_before_credits.include_credit
    include_refund = local.usage_before_credits.include_refund
  }

  dynamic "notification" {
    for_each = [50, 80, 90]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_email]
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}

# --- Expiry reminders: budgets cannot alert on a date, so one-time schedules publish to email.

resource "aws_sns_topic" "credit_reminders" {
  name              = "${module.naming.project}-credit-reminders"
  kms_master_key_id = "alias/aws/sns" # EN-02
}

resource "aws_sns_topic_subscription" "credit_reminders" {
  topic_arn = aws_sns_topic.credit_reminders.arn
  protocol  = "email"
  endpoint  = var.budget_email # AWS sends a confirmation email; the link must be clicked once
}

resource "aws_iam_role" "credit_reminders" {
  name = "${module.naming.project}-credit-reminders"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id } }
    }]
  })
}

resource "aws_iam_role_policy" "credit_reminders" {
  name = "publish-reminder"
  role = aws_iam_role.credit_reminders.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "sns:Publish", Resource = aws_sns_topic.credit_reminders.arn }]
  })
}

resource "aws_scheduler_schedule" "credit_expiry" {
  for_each                     = toset([for days in var.expiry_reminder_days : tostring(days)])
  name                         = "${module.naming.project}-credits-expire-in-${each.key}-days"
  schedule_expression          = "at(${formatdate("YYYY-MM-DD", timeadd("${var.credits_expiry_date}T00:00:00Z", "-${each.key * 24}h"))}T09:00:00)"
  schedule_expression_timezone = "Asia/Kolkata"
  action_after_completion      = "DELETE"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_sns_topic.credit_reminders.arn
    role_arn = aws_iam_role.credit_reminders.arn
    input = jsonencode(
      "HEACH: AWS Free plan credits expire on ${var.credits_expiry_date} (in ${each.key} days). The account closes then unless upgraded. Check Billing > Credits, set the paid-plan budget, then upgrade."
    )
  }
}
