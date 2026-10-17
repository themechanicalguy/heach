# 0008. Run on one lean EC2 host, paid from AWS credits, until the paid plan

- **Status:** Accepted (merged in PR #14; see also [0009](0009-aws-credits-and-restricted-pilot.md))
- **Date:** 2026-10-17
- **Requirements:** EN-01, EN-04, EN-06, EN-07, EN-10, EN-12, SE-04, SO-06, SO-07, SO-08, LM-01,
  LM-07, LM-08, LM-09

## Context

The AWS account is on the Free plan: US$100 of credits (possibly up to US$200), expiring
17 April 2027. The credits must pay for development and later a restricted pilot reached by IP
address. Step 1 Track B (B2) asked for managed PostgreSQL and Redis, a load balancer, Secrets
Manager and one account per environment: about US$80 a month for dev and US$100 for staging
(estimates), which the credits cannot carry. Cost matters more than availability for now.

## Decision

One EC2 instance per environment (`t4g.small`, Mumbai) in a public subnet, no NAT gateway and no
load balancer, running Docker Compose: Caddy, web, admin, API, PostgreSQL, Redis.

- Security group: only 80 (redirect) and 443 from the internet. The API is served under `/api`.
  The admin panel listens on the host's loopback only and is reached through Session Manager
  port forwarding. No SSH; administration through Session Manager.
- Encrypted EBS volume; nightly snapshots kept 7 days (Data Lifecycle Manager); one Elastic IP.
- Uploads bucket: private, versioned, SSE-KMS with the documents key, public access blocked,
  TLS only.
- Four customer managed KMS keys per environment (health, identity, payments, documents), yearly
  rotation (EN-04 to EN-06).
- Secrets in SSM Parameter Store SecureString (standard tier, free); never in code or outputs.
- One instance role: pull HEACH images, read its own parameters, use the four keys for data keys
  only, read and write the uploads bucket.
- TLS from Caddy's internal CA on the IP address until a domain exists.

## Estimated cost (Mumbai, on demand, 730 hours; estimates from the AWS Price List API, October 2026)

| Item | Before | After |
| --- | --- | --- |
| EC2 `t4g.small` ($0.0112/hour) | $8.18 | $8.18 |
| EBS gp3 20 GB ($0.0912/GB-month) | $1.82 | $1.82 |
| Public IPv4 / Elastic IP ($0.005/hour) | $3.65 | $3.65 |
| KMS keys, 4 × $1 | — | $4.00 |
| EBS snapshots, 7 daily, incremental (~8–12 GB at $0.05) | — | ~$0.50 |
| ECR images (~3 GB at $0.10) | ~$0.30 | ~$0.30 |
| S3 state and uploads | <$0.05 | <$0.10 |
| Parameter Store, DLM, data transfer (<100 GB) | $0 | $0 |
| **Total per environment** | **~$14** | **~$18.50** |

B2 as specified would have cost about $80 (dev) and $100 (staging) a month.

## Requirements weakened (to revisit before real patient data)

| ID | Gap |
| --- | --- |
| EN-01 | Certificate from Caddy's internal CA, not publicly trusted; PostgreSQL and Redis traffic stays inside the Docker network without TLS |
| EN-07 | No virus scanning of uploads yet |
| EN-10 | Snapshots stay in Mumbai with the volume's key; no copy to Hyderabad; no restore test |
| EN-12 | Parameter Store, not a secrets manager with rotation |
| SO-06 | Session Manager with IAM user MFA; no separate bastion or access review yet |
| SO-07 | Dev and the pilot must not share a host or account; two hosts double the cost |
| SO-08 | No WAF; only AWS Shield Standard; no anomaly alerts |
| LM-01, LM-07, LM-09 | Logs stay on the host (Docker); no central log store, alerting or separate audit store |
| LM-08 | Single host, single zone: no failover; 99.5% availability not guaranteed |
| SE-04 | IP allow-listing replaced by IAM sign-in with MFA plus Session Manager; admin MFA in the app is Step 2 |

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Lean single host (chosen) | ~$18.50 a month; fits the credits | The gaps above |
| B2 managed design | Meets the requirements | ~$80–100 a month per environment |
| Local only, no cloud | $0 | No shared environment; no pilot |

## Consequences

- At ~$18.50 a month, one environment uses about $111 over the six months the credits last, so
  US$100 does not quite cover dev and a pilot together. Before the pilot: run only one host (dev
  stays local and the AWS host becomes the pilot), or get the further US$100 of credits, or move
  to the paid plan.
- On the Free plan the account closes when the credits run out or at six months
  (17 April 2027), whichever comes first. Hosting the pilot after that needs the Paid plan, with
  budget alerts and a budget action set first (playbook part B4).
- Backups: the playbook's pilot design also keeps an encrypted copy outside the account; not built
  yet (follow-up with B4 or P1).
- Moving to managed databases, a load balancer and separate accounts is a new ADR that
  supersedes this one.
