# Budgets for the Paid plan (playbook part B6). Written in B4, applied only after the upgrade:
# while the Free plan credits pay, a budget that includes credits sees $0 and never fires.
# The gross-usage budget (usage before credits) already lives in infra/github-oidc.

provider "aws" {
  region = "ap-south-1" # Mumbai, pinned: never from a variable or default (PR-06)
  default_tags {
    tags = merge(module.naming.tags, { Stack = "paid-plan-budgets" })
  }
}

data "aws_region" "current" {}

module "naming" {
  source      = "../modules/naming"
  environment = "shared"
  region      = data.aws_region.current.region
}

# The instances a budget action may stop: every running HEACH host in this account.
data "aws_instances" "hosts" {
  instance_tags = { Project = module.naming.project }
}

# Net cost (credits applied), so it shows what reaches the card once credits are gone.
resource "aws_budgets_budget" "monthly" {
  name         = "${module.naming.project}-paid-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_cap_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.alert_emails
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.alert_emails
  }
}

# Budget action: at 100 percent of the cap, stop the hosts through Systems Manager.
resource "aws_iam_role" "budget_action" {
  name = "${module.naming.project}-budget-action"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "budgets.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "budget_action" {
  role       = aws_iam_role.budget_action.name
  policy_arn = "arn:aws:iam::aws:policy/AWSBudgetsActions_RolePolicyForResourceAdministrationWithSSM"
}

resource "aws_budgets_budget_action" "stop_hosts" {
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "RUN_SSM_DOCUMENTS"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budget_action.arn

  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = 100
  }

  definition {
    ssm_action_definition {
      action_sub_type = "STOP_EC2_INSTANCES"
      region          = data.aws_region.current.region
      instance_ids    = data.aws_instances.hosts.ids
    }
  }

  dynamic "subscriber" {
    for_each = var.alert_emails
    content {
      address           = subscriber.value
      subscription_type = "EMAIL"
    }
  }
}
