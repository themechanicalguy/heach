output "github_deploy_role_arn" {
  description = "Set as the GitHub repository variable AWS_DEPLOY_ROLE_ARN to enable deploys."
  value       = aws_iam_role.github_deploy.arn
}

output "credit_watch_role_arn" {
  description = "Set as the GitHub repository variable AWS_CREDIT_WATCH_ROLE_ARN."
  value       = aws_iam_role.credit_watch.arn
}

output "credit_alert_topic_arn" {
  description = "Set as the GitHub repository variable CREDIT_ALERT_TOPIC_ARN."
  value       = aws_sns_topic.credit_reminders.arn
}
