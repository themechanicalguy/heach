# 0005. Start with one AWS dev host in Mumbai, managed with OpenTofu

- **Status:** Accepted; not applied, deferred by [0007](0007-defer-cloud-track-b.md)
- **Date:** 2026-10-07
- **Requirements:** PR-06, EN-01, EN-02, EN-12, SE-04, SO-06, SO-07

## Context

Step 1 asks for empty apps deployed through a pipeline. The budget is free tier only, there is no
AWS account yet, no domain, and no real patient data. Data must stay in India.

## Decision

- **AWS, Mumbai (`ap-south-1`).** Hyderabad (`ap-south-2`) reserved for backups later.
- **OpenTofu** (MPL-2.0) for infrastructure as code; state in an encrypted, versioned S3 bucket
  with S3-native locking.
- **Dev only:** one `t4g.small` instance running Caddy, web, admin, API, PostgreSQL and Redis in
  Docker Compose. No load balancer, no NAT gateway. Access through Session Manager only.
- **TLS with Caddy's internal CA** until a domain exists.
- **GitHub Actions deploys over OIDC** after CI passes on `main`, sending the bundle through SSM.
  The workflow is inert until `AWS_DEPLOY_ROLE_ARN` is set.
- CI runs the exact deploy bundle on every pull request (job **Deploy bundle**), so deployments
  are tested without AWS.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One EC2 host with Compose (chosen) | Cheapest; mirrors local setup | Single point of failure; self-run databases |
| ECS Fargate + ALB + RDS | Managed, scalable | ~US$50+/month before any use |
| App Runner | Simple | Not suited to self-run Postgres/Redis; costs per service |
| Terraform | Most familiar | Business Source Licence, not open source |

## Consequences

- About US$16–18 a month after credits; `tofu destroy` stops all charges.
- Before real patient data (Stage A pilot): managed PostgreSQL and Redis, encrypted backups to
  Hyderabad, KMS keys per data domain, a domain with public certificates, WAF, staging and
  production in separate accounts. Each gets its own ADR.
