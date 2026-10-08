# 0007. Defer cloud initialisation (Step 1 Track B); run everything locally until it is done

- **Status:** Accepted
- **Date:** 2026-10-08
- **Requirements:** PR-06, EN-04, EN-12, LM-01; Step 1 build items 8 and 9

## Context

Track B of Step 1 (cloud accounts, dev and staging environments, deploy on merge) needs managed
services that do not fit the AWS Free plan: a load balancer, managed PostgreSQL and Redis, a
secrets manager and one account per environment cost roughly US$165–190 a month, against a
budget of about US$20. Separate accounts also need AWS Organizations, which the Free plan does
not offer. No real patient data exists yet, so nothing requires a cloud environment today.

## Decision

Defer Track B. Until it is done:

- Everything runs locally with Docker Compose and passes in CI. CI builds the web, admin and API
  images on every pull request without pushing them.
- Anything that will later use a cloud service (key management, secrets manager, object storage,
  tracing backend) sits behind an interface in `packages/*` or the API, with a local
  implementation marked **development only** that refuses to start when `NODE_ENV=production`.
- No code assumes a specific cloud provider: no provider SDKs in apps or packages, no
  provider-specific URLs, ARNs or service names outside `infra/` and `deploy/`.

The OpenTofu code from ADR 0005 and ADR 0006 stays in `infra/`, unapplied. The **Deploy dev**
workflow stays inert because `AWS_DEPLOY_ROLE_ARN` is not set.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Defer Track B, local only (chosen) | No cost; features are not blocked | No shared environment; staging exit criterion stays open |
| One EC2 host per environment on Free plan credits | ~US$16–27 a month | Credits end after 6 months; no managed data stores; one account |
| Full B2 design on the paid plan | Meets every requirement | ~US$165–190 a month before any user |

## Consequences

- Step 1 closes with exit criterion "a merged pull request reaches staging" open; preview
  deployments per pull request are also deferred.
- Step 2 builds the key, secret, storage and tracing interfaces with local implementations
  (for example a local key file for envelope encryption, `.env` for secrets, SeaweedFS for objects,
  console or Jaeger for traces). Cloud implementations are added in Track B behind the same
  interfaces.
- `infra/` may drift from the code; re-plan it before any apply.
- Revisit before the Stage A pilot, when a paying customer or funding allows the paid plan, or
  when a second developer needs a shared environment.
