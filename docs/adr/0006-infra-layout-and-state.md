# 0006. Split infrastructure into modules and per-environment stacks with one state each

- **Status:** Accepted
- **Date:** 2026-10-08
- **Requirements:** PR-06, EN-01, EN-02, EN-12

## Context

ADR 0005 created one dev configuration and a bootstrap that mixed the state bucket with the
deploy role and budget. Staging and production will follow, and must not share code by copy or
share state with dev.

## Decision

- `infra/modules/*` for reusable pieces (`naming`, `network`, `registry`, `app-host`);
  `infra/envs/{dev,staging,production}` call them.
- `infra/bootstrap` creates only the state bucket; the deploy role and budget move to
  `infra/github-oidc`.
- One S3 bucket per account, one state key per stack and environment, S3 lock files for locking.
- Names `heach-<env>[-<component>]` and tags `Project`, `Environment`, `ManagedBy`, `Owner`, set by
  the `naming` module, which also rejects regions outside India.
- Exact provider versions and committed lock files; OpenTofu pinned to `~> 1.13.0`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One bucket, one key per environment (chosen) | One bootstrap; simple while there is one account | A user with bucket access can read every environment's state |
| One bucket per environment now | Separate access per environment | Little value while all environments share one account |
| Workspaces in one folder | Less code | Easy to apply to the wrong environment; no per-environment differences |
| Terragrunt | Less backend repetition | Another tool and dependency for a small setup |

## Consequences

- Adding an environment is a folder that calls the modules.
- Before real patient data, staging and production move to separate AWS accounts with their own
  state buckets; this ADR's single bucket then holds dev and shared stacks only.
- Provider upgrades touch every `versions.tf` and lock file.
