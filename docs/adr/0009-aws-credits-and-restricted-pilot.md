# 0009. Run on AWS Free plan credits, upgrade at the Act level, and pilot on an IP address

- **Status:** Accepted
- **Date:** 2026-10-17
- **Requirements:** PR-06, EN-01, EN-07, EN-10, EN-12, SE-04, SO-04, SO-06, SO-07, SO-08, LM-01,
  LM-07, LM-08, LM-09; guideline Step 1 build item 9 and exit criteria

## Context

The project has no hosting budget beyond AWS credits: US$120 granted so far on the Free plan
(US$100 at sign-up, US$20 earned; up to US$200 possible). The Free plan ends when the credits run
out or on 17 April 2027, and the account then closes. The credits must cover development and a
later restricted pilot. There is no domain yet. Playbook: `docs/step-1-claude-code-playbook.md`.

## Decision

1. **Credits only.** Cloud use stays small during development; most work runs locally with Docker
   Compose.
2. **Stay on the Free plan until it ends, upgrade no later than the Act level** (10% of credits
   or 15 days left). Alerts: AWS's own emails, the daily credit-watch workflow, two budgets on
   usage before credits, expiry reminders (`docs/credit-expiry-plan.md`). Budgets on net cost and
   a stop-the-hosts budget action are applied the day of the upgrade (`infra/paid-plan-budgets`,
   playbook B6). Upgrade date: _not yet_.
3. **Lean single instance** per environment, as in [ADR 0008](0008-lean-single-host-on-credits.md):
   one `t4g.small` with Docker Compose, encrypted disk, nightly snapshots, one Elastic IP, ports
   80 and 443 only, Session Manager instead of SSH, KMS keys per data domain.
4. **Dev only; no staging, no preview deployments.** A merge to `main` deploys to dev. The
   Step 1 exit criterion "a merged pull request reaches staging" is replaced by "reaches dev".
5. **Pilot on the Elastic IP, without a domain** (playbook Track P), with a Let's Encrypt
   IP-address certificate renewed automatically. Before the pilot, dev is destroyed or stopped so
   credits are not spent twice. Partners must accept IP callback URLs, or a domain is bought.

## Requirements relaxed for the pilot

| ID | Relaxation | Reason |
| --- | --- | --- |
| LM-08 | Single host in one zone; no failover; the 99.5% target is not promised | Managed multi-zone services cost about US$80–100 a month |
| EN-10 | Encrypted snapshots in Mumbai plus an encrypted copy outside the account; no copy to Hyderabad; restore tested once before the pilot, not quarterly | Cross-region copies and a second environment cost credits |
| SO-08 | No WAF; AWS Shield Standard only; no anomaly alerts | WAF is billed per rule and request |
| EN-12 | SSM Parameter Store instead of a secrets manager with rotation | Parameter Store standard tier is free |
| EN-01 | TLS from Caddy's internal CA on dev; Let's Encrypt IP certificate on the pilot; no TLS between containers on one host (PostgreSQL, Redis) | No domain; traffic never leaves the host's Docker network |
| SO-06 | Session Manager with IAM user MFA; no separate bastion; access reviews by hand | Session Manager is free and needs no open port |
| SE-04 | Admin panel has no public port; IP allow-listing replaced by IAM sign-in with MFA and port forwarding | Narrower exposure at no cost |
| LM-01, LM-07, LM-09 | Logs stay on the host; no central store, on-call alerting or separate audit store yet | CloudWatch Logs and alerting add cost; revisit in Step 2 |
| SO-04 | No staging to run dynamic scans against before release | Dev only |
| SO-07 | Kept: dev and pilot never share a host or data; pilot starts empty | Not relaxed |

Kept without change: encryption at rest, field-level encryption with per-domain keys, private
storage, least-privilege identities, no secrets in code, no personal data in logs, consent and
privacy notices. Only synthetic data until the penetration test and legal sign-off (guideline
Step 6); playbook part P5 is the gate.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Free plan, lean host, dev only, IP pilot (chosen) | Fits the credits; no surprise bills | The relaxations above; account closes if the upgrade is missed |
| Upgrade now, managed services, staging | Meets the requirements | About US$165–190 a month for dev and staging |
| Local only until funding | No cost | No deploy pipeline or pilot |

## Consequences

- The upgrade is a dated obligation; the credit-watch alerts and calendar reminders exist for it.
- Each relaxation above is revisited before real patient data; the full design gets its own ADR.
- GitHub branch protection stays unavailable on the private Free repository
  ([ADR 0004](0004-github-free-no-branch-protection.md)); commands are in `docs/environments.md`.
