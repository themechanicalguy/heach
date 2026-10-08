output "host_ip" {
  description = "Public IP of the dev host."
  value       = module.host.public_ip
}

output "urls" {
  description = "Self-signed TLS until a domain exists; browsers will warn."
  value = {
    web   = "https://${module.host.public_ip}"
    api   = "https://${module.host.public_ip}:9443/healthz"
    admin = "https://${module.host.public_ip}:8443 (only from admin_allowed_cidrs)"
  }
}

output "instance_id" {
  description = "For Session Manager: aws ssm start-session --target <id>"
  value       = module.host.instance_id
}

output "ecr_repositories" {
  value = module.registry.repository_urls
}
