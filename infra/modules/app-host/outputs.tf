output "instance_id" {
  value = aws_instance.host.id
}

output "public_ip" {
  value = aws_eip.host.public_ip
}

output "api_role_arn" {
  description = "Role the host assumes for the API container's credentials."
  value       = aws_iam_role.api.arn
}
