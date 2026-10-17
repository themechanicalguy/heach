# Step 1 review

Audit of the repository and the AWS setup against Step 1 of the
[implementation guideline](mvp-v1-implementation-guideline.md) and
[ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md), on 17 October 2026 (playbook "Step 1
exit check").

## Build items

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Repository with branch protection on `main` | ❌ Fail (accepted) | GitHub returns HTTP 403 on the private Free repository; process plus pre-push hook instead ([ADR 0004](adr/0004-github-free-no-branch-protection.md)); commands in [environments](environments.md#branch-protection-on-main) |
| 2 | Monorepo, pnpm + Turborepo, Node LTS, TypeScript strict | ✅ Pass | `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `packages/config/tsconfig` |
| 3 | App shells web, admin, api | ✅ Pass | `apps/*`; live: `https://15.252.65.98/api/healthz` |
| 4 | Shared packages | ✅ Pass | `packages/{ui,i18n,config,types,crypto,logger}` (`crypto` is an interface only) |
| 5 | Local services, one command | ✅ Pass | `pnpm dev:up` ([local development](local-development.md)) |
| 6 | Commit hooks, conventional commits | ✅ Pass | `scripts/hooks/` (gitleaks, Prettier, lint on staged files) |
| 7 | CI with caching; PR template with definition of done | ✅ Pass | `.github/workflows/ci.yml` (7 jobs), `.github/pull_request_template.md` |
| 8 | Cloud in an India region with IaC | 🟡 Pass for dev | `infra/` (OpenTofu), Mumbai only, region pinned; dev applied; staging and production replaced by dev only and a later pilot (ADR 0009) |
| 9 | Deploy on merge; previews | 🟡 Pass for dev | `.github/workflows/deploy-dev.yml`: OIDC, scan gate, SSM deploy, smoke test, rollback. No staging or previews (ADR 0009) |
| 10 | README, contributing guide, ADR template, `docs/` | ✅ Pass | `README.md`, `CONTRIBUTING.md`, `docs/adr/0000-template.md` |

## Exit criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Clone, one command, three apps within 30 minutes | ✅ Pass | `pnpm dev:up`; CI E2E smoke from a clean checkout. Not timed on a fresh machine |
| Merged PR reaches dev without manual steps (replaces staging) | ✅ Pass | Merge of PR #30 deployed `5f5c956ff9a2` with no manual step: scan gate, SSM deploy, smoke test passed ([run](https://github.com/themechanicalguy/heach/actions/runs/39063937336)) |
| `main` protected; pipeline blocks a failing build | ❌ Fail (accepted) | CI blocks a failing build by process only; GitHub Free cannot protect branches (item 1, ADR 0004) |
| Third-party applications submitted and tracked | 🟡 Partial | Tracked as issues #19–#25; not yet submitted |
| Credit-expiry alerts active and tested | 🟡 Partial | Credit watch live; simulated Watch, Plan, Act and Emergency updated issue #29. Every alert path (four levels, plan not ACTIVE, burn rate, failed check) verified locally with stubbed `gh` and `aws`. Pending: SNS confirmation, email receipt, three scheduled runs (18–20 October) |
| ADR lists every relaxed requirement | ✅ Pass | [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md) |

## Open actions (owner: account holder)

Verified 18 October 2026: items 1 and 2 are done (fresh plans for `infra/github-oidc` and
`infra/envs/dev` show no changes; variables set; issue #29 shows Watch, Plan, Act and Emergency).

1. ✅ Apply the github-oidc and dev plans.
2. ✅ Set the GitHub variables and run the simulations. Pending: three scheduled daily runs in a row.
3. Confirm the SNS subscription email (still PendingConfirmation on 18 October), then re-run one
   simulation and check the email arrives (not in spam). Only one address is subscribed; the
   second needs `infra/github-oidc` to take a list of addresses and an approved apply.
7. ✅ Burn-rate warning now raises an alert on its own (before, only a level rise or a plan status
   other than ACTIVE did). Fixed in `scripts/credit-alert.sh`.
8. Credit watch must run on its own on 18, 19 and 20 October (09:00 IST); manual runs do not count.
4. Calendar reminders 60, 30, 15 and 7 days before 17 April 2027; submit the partner applications.
5. ✅ Green Deploy dev on `main` (`5f5c956`, 18 October). The first run failed because dev was asleep during the sleep test.
6. ✅ `scripts/dev-sleep` / `scripts/dev-wake` tested 18 October; smoke test passed after wake.

## Risks and shortcuts Step 2 must fix first

| Risk | Requirement | Fix in Step 2 |
| --- | --- | --- |
| `@heach/crypto` is an interface; no field-level or envelope encryption yet, though the KMS keys exist | EN-03 to EN-06 | Implement envelope encryption with the per-domain keys before any Restricted field |
| Logs stay on the host; no correlation IDs end to end, no alerting | LM-01, LM-07, LM-09 | Shared logger with correlation IDs, error tracking, one alert |
| Secrets in Parameter Store without rotation | EN-12 | Rotation procedure, or Secrets Manager when budget allows |
| No authorisation layer or audit log yet | SE-02, SE-05, SE-07 | Auth skeleton and the authorisation test harness |
| Certificate from Caddy's internal CA | EN-01 | Let's Encrypt IP certificate (pilot P2) or a domain |
| Backups only as same-region snapshots; no restore test | EN-10 | Encrypted copy outside the account and one restore test |
| No SAST or container scanning in CI beyond ECR basic scan | SO-03 | Static analysis and image scanning in CI |
| Branch protection not enforced | SO-03 | GitHub Pro, or a public repository |

## Cost and credits

| | |
| --- | --- |
| Monthly cloud cost (estimate, dev, ADR 0008) | about US$18.50 (EC2 $8.18, Elastic IP $3.65, disk $1.82, KMS keys $4, snapshots ~$0.50, ECR and S3 under $0.50) |
| `scripts/credit-status` | FREE plan, ACTIVE, $120 of $120 left (100%), ends 2027-04-17 (181 days), level ok; Cost Explorer has no data yet |
| Upgrade to the Paid plan by | the **Act** level: 10% of credits left or **2 April 2027** (15 days before the end), whichever comes first |
