# 0010. Step 2: one-Region backups, Parameter Store secrets, WAF at the pilot

- **Status:** Accepted
- **Date:** 2026-10-18
- **Requirements:** EN-01, EN-10, EN-12, SO-08, LM-03, LM-05; Step 2 spec decisions D1 to D3

## Context

The project runs in one AWS Region (ap-south-1) on Free plan credits
([ADR 0008](0008-lean-single-host-on-credits.md), [ADR 0009](0009-aws-credits-and-restricted-pilot.md)).
EN-10 originally asked for a copy of backups in a second Region, EN-12 for a secrets manager with
rotation, and SO-08 for a WAF. Neither a second Region nor paid services fit those limits. The
Step 2 spec (`docs/archive/step-specs/step-02-secure-foundation.md`) records the owner's decisions D1 to D3.

## Decision

1. **Backups (D1).** A nightly `pg_dump` is encrypted with its own KMS key (`backup` domain) and
   stored in a private, versioned ap-south-1 bucket. A weekly script copies the latest encrypted
   dump to the owner's computer, outside the AWS account. EN-10 is reworded accordingly. No
   cross-Region replication.
2. **Secrets (D2).** SSM Parameter Store SecureString (standard tier, free), read by the API at
   start-up, with a written rotation procedure run once in dev. Revisit Secrets Manager at the
   pilot.
3. **WAF (D3).** Deferred to the pilot. Until then: Caddy and API rate limits, DTO validation that
   rejects unknown fields, and an alert on repeated authorisation failures.
4. **TLS inside the host.** The API connects to PostgreSQL and Redis over TLS (EN-01.1). This
   supersedes the EN-01 row of ADR 0009 that allowed plaintext between containers.
5. **Observability containers stay off the dev host.** Jaeger, the OpenTelemetry Collector and
   GlitchTip run in local Docker Compose and CI only; the `t4g.small` dev host (2 GB) cannot fit
   them. On the host, traces and front-end errors go to structured logs. Revisit when the host is
   resized or at the pilot.

## Options considered

- Cross-Region snapshot copy: not allowed in a one-Region project.
- Secrets Manager: about US$0.40 per secret per month; Parameter Store is free and enough for dev.
- AWS WAF now: billed per ACL, rule and request; no public users before the pilot.
- Resize the host to `t4g.medium` for observability: about US$12 per month of credits.

## Consequences

- A Region-wide outage loses at most a week of data beyond the off-account copy; acceptable for
  synthetic dev data, revisited before the pilot.
- The off-account copy depends on the owner running the weekly script.
- LM-03 and LM-05 are proven locally; the dev host lacks a dashboard until it is resized.
