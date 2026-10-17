output "host_ip" {
  description = "Public IP of the dev host."
  value       = module.host.public_ip
}

output "urls" {
  description = "Self-signed TLS until a domain exists; browsers will warn."
  value = {
    web   = "https://${module.host.public_ip}"
    api   = "https://${module.host.public_ip}/api/healthz"
    admin = "Session Manager port forwarding to localhost:8443 (see docs/cloud-setup.md)"
  }
}

output "instance_id" {
  description = "For Session Manager: aws ssm start-session --target <id>"
  value       = module.host.instance_id
}

output "ecr_repositories" {
  value = module.registry.repository_urls
}

output "uploads_bucket" {
  value = module.uploads.name
}

output "kms_key_aliases" {
  description = "Data-domain key aliases (EN-06)."
  value       = [for domain in keys(module.keys.key_arns) : "alias/${module.naming.prefix}-${domain}"]
}
