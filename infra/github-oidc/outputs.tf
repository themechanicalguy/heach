output "github_deploy_role_arn" {
  description = "Set as the GitHub repository variable AWS_DEPLOY_ROLE_ARN to enable deploys."
  value       = aws_iam_role.github_deploy.arn
}
