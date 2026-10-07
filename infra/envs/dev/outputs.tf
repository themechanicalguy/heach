output "host_ip" {
  description = "Public IP of the dev host."
  value       = aws_eip.host.public_ip
}

output "urls" {
  description = "Self-signed TLS until a domain exists; browsers will warn."
  value = {
    web   = "https://${aws_eip.host.public_ip}"
    api   = "https://${aws_eip.host.public_ip}:9443/healthz"
    admin = "https://${aws_eip.host.public_ip}:8443 (only from admin_allowed_cidrs)"
  }
}

output "instance_id" {
  description = "For Session Manager: aws ssm start-session --target <id>"
  value       = aws_instance.host.id
}

output "ecr_repositories" {
  value = { for name, repo in aws_ecr_repository.app : name => repo.repository_url }
}
