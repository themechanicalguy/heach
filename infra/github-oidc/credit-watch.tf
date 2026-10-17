# Read-only role for the credit-watch workflow (playbook part B4): reads the Free plan state and
# Cost Explorer, and may publish only to the credit alerts topic. Separate from the deploy role.

resource "aws_iam_role" "credit_watch" {
  name = "${module.naming.project}-credit-watch"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "${var.github_oidc_subject_prefix}:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "credit_watch" {
  name = "read-credits-publish-alert"
  role = aws_iam_role.credit_watch.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Neither API supports resource-level permissions.
      { Effect = "Allow", Action = ["freetier:GetAccountPlanState", "ce:GetCostAndUsage"], Resource = "*" },
      { Effect = "Allow", Action = "sns:Publish", Resource = aws_sns_topic.credit_reminders.arn },
    ]
  })
}
