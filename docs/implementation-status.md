# Implementation status

- **Last updated:** 25 October 2026: owner approved spec 006 (recurring restore check) as drafted; ADR 0012 accepted (R1 accept for dev with an escrow spec before the pilot, R2 manual weekly pull with a reminder, R3 password-manager passphrase test, owner action pending); owner confirmed both synthetic alerts (LM-07.1, SO-08.3) arrived in the inbox. Module counts unchanged. Earlier, 24 October 2026 (evening): spec 007 is merged (#74), its infrastructure applied by the owner and deployed to dev (Deploy dev run 40095340473, attempt 2, `8b0387f`), and verified live: `tofu plan` no changes; the API IAM role reads exactly its four parameters, the admin and migrator passwords are denied, containers cannot reach instance metadata (hop limit 1); public test sign-in 404, loopback entry 200 ([live verification](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24)). SNS email subscription confirmed in AWS; two labelled synthetic alerts (LM-07.1, SO-08.3) published and reported delivered by SNS; inbox receipt awaits the owner. Backup and restore re-proven after the role split; off-account copy refreshed and verified. ADR 0012 (off-account recovery, weekly copy, passphrase) proposed; draft spec 006 amended for the new roles. Module counts unchanged: nothing moved to Done, because each change still awaits owner acceptance or keeps a stated gap. Earlier, 24 October 2026: [security review of 24 October](reviews/2026-10-24-security-review.md) fixed on the owner's instruction in [spec 007](../specs/007-security-review-fixes/spec.md) (Approved 24 October, not merged or deployed): address limit on every request plus per-user limit (SO-08.12); test sign-in only through a loopback-only entry with a key (SE-07.23); device sign-out revokes the whole session family and a signed-out family's token is a plain 401 (SE-07.21, SE-07.22); API IAM role reads exactly its four parameters and containers cannot use the host role (EN-12.4, infra apply pending); full dependency audit in CI and clean (SO-03.2). Earlier on 24 October 2026: reconciled Step 2 corrective status: specs 003 to 005 merged (#67, #69, #70), CI green and deployed to dev (Deploy dev for `491f5a0`, smoke test passed); re-verified locally on `491f5a0` with fresh, uncached runs (`pnpm check` 37 of 37; API integration 107 of 107 on PostgreSQL and Redis). Done for each still awaits the owner's review of the evidence (gate G4). SNS subscription and email receipt still unconfirmed in the repository. Recurring restore check drafted as spec 006 (#72, Draft, awaiting owner approval). 24 October 2026: Storybook 10.6.1 to 10.6.2 and Vite 8.3.2 to 8.3.4 for a critical and two high dev-dependency advisories (SO-03.1); four `@lhci/cli` transitive highs remain without a fix (SO-03 row). 23 October 2026: spec 005 [bounded re-encryption](../specs/005-bounded-reencryption/spec.md) implemented (EN-05.4 to EN-05.9): one keyset pass, only versions below the target, true counts and a non-zero exit on failure, and a per-row audit entry as the system job in the row's transaction. 23 October 2026: spec 004 [transactional session rotation](../specs/004-transactional-session-rotation/spec.md) implemented (SE-07.14 to SE-07.20): each refresh runs in one transaction under the user's row lock, a concurrent replay also revokes the winner's session and access token, sign-out of all devices takes the same lock, and the refresh cookie is cleared only on 401. 22 October 2026: Next.js 16.3.8 to 16.4.1 for GHSA-2464-fhr4-w9xw (critical, image optimisation RCE with SVG) and GHSA-p3m5-59mp-jv5r (high, Server Actions DoS), which failed the dependency audit (SO-03.1); SO-03 status unchanged. 22 October 2026: spec 003 [transactional audit writes](../specs/003-transactional-audit-writes/spec.md) implemented (SE-05.5 to SE-05.10): `withTransaction` helper, a note and its audit entry commit together, reads audited only after decryption, failed reads audited as `.read.failed` / `.list.failed`. 22 October 2026: owner approved specs 003, 004 and 005 as drafted (implementation order 003, then 004 and 005). 22 October 2026: [Step 2 assessment](step-2-assessment-2026-10-22.md) re-verified `main` 7c8c1c9, CI and Deploy dev (green, smoke test passed) and found Step 2 not complete; specs [004 session rotation](../specs/004-transactional-session-rotation/spec.md) (SE-07.14 to SE-07.20) and [005 bounded re-encryption](../specs/005-bounded-reencryption/spec.md) (EN-05.4 to EN-05.9) drafted for owner approval; stale claims fixed (EN-04 infra applied, credit-watch scheduled runs met, SNS records contradictory and delivery unconfirmed, off-account copy cannot decrypt Restricted fields without the AWS account, no recurring restore check). 22 October 2026: spec 002 [rate-limit bypass](../specs/002-rate-limit-bypass/spec.md) implemented (PR #64; SO-08.4 to SO-08.11, review S-1): fake, expired, revoked and malformed bearer tokens are counted by client address and a live session by user; SO-08 stays Partial (per-process counters, WAF at the pilot). 22 October 2026: admin and edge-proxy Caddy rebuilt with Go 1.26.10, clearing HIGH CVE-2026-111943 (crypto/x509) that failed the container scan on `main` (SO-03.1); SO-03 status unchanged. 22 October 2026: reconciled stale claims: EN-06 and TS-03 counted Partial as their rows say, SO-03 Partial, TS-01 Done (its CI coverage gate exists), EN-06 and TS-03 rows updated, branch protection now available (public repository) but not enabled. 22 October 2026: spec 003 [transactional audit writes](../specs/003-transactional-audit-writes/spec.md) drafted for owner approval (SE-05.5 to SE-05.10, review S-2); SE-05 row added to the Partial table with its gaps. 21 October 2026: spec 002 [rate-limit bypass](../specs/002-rate-limit-bypass/spec.md) drafted for owner approval (SO-08.4 to SO-08.11, review S-1); SO-08 moved to Partial with the confirmed bypass stated. Earlier the same day: spec 001 [session-refresh reliability](../specs/001-session-refresh-reliability/spec.md) approved by the owner (#54) and implemented in the web client (#56, CI green) (SE-07.5 to SE-07.13, review C-1); see the SE-07 row. ADR 0011 accepted and constitution ratified (PR #53). Step 2 unchanged since 18 October: remaining SNS subscription confirmation, lawyer and Odia reviews ([log](step-2-progress.md))
- **Current step:** Step 2 of the [implementation guideline](mvp-v1-implementation-guideline.md): not complete. Corrective specs 001 to 005 and 007 implemented and deployed (007 also live-verified); Done needs the owner's review of their evidence. Exit pending: lawyer review (D6, an exit criterion) and native Odia review (I18N-07), both being arranged by the owner; spec 006 implementation and four weekly runs; ADR 0012 R3 test (owner) ([exit criteria](step-2-progress.md#exit-criteria-guideline-step-2-checked-24-october-2026), [owner actions](step-2-progress.md#owner-actions))

This page separates what is built from what is only specified. The
[requirements](mvp-v1-requirements.md) say _what_ to build and the
[guideline](mvp-v1-implementation-guideline.md) says _in what order_; neither tracks progress. Step specs in [`docs/specs/`](specs/README.md) define when an item is
Done: every acceptance criterion passes.
Update this page in the same pull request that changes a status; the pull request template
checks for it (rule in [`CLAUDE.md`](../CLAUDE.md#working-rules)).

| Status | Meaning |
| --- | --- |
| ✅ Done | Built, tested in CI, meets the requirement as written |
| 🟡 Partial | Some of it is built; the gap is stated |
| ⬜ Not started | Specified only |

## Step 1: Repository and app initialization

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Repository with branch protection on `main` | 🟡 Partial | Not enabled. The repository is now public (checked 22 October 2026), so GitHub Free allows protection: the API answered `Branch not protected` (HTTP 404, no longer 403). The premise of [ADR 0004](adr/0004-github-free-no-branch-protection.md) (stay private) no longer holds and the switch to public is not recorded in an ADR; settings proposed for the owner in [environments](environments.md#branch-protection-on-main). Until then: PR-only process and the pre-push hook. Commits on `main` are signed by GitHub's squash merge (last 20 verified) |
| 2 | Monorepo, pnpm + Turborepo, Node LTS, TypeScript strict | ✅ Done | [ADR 0001](adr/0001-monorepo-and-stack.md) |
| 3 | App shells `web`, `admin`, `api` | ✅ Done | API has `/healthz`, `/readyz`, OpenAPI |
| 4 | Shared packages `ui`, `i18n`, `config`, `types`, `crypto`, `logger` | ✅ Done | Scaffolds; `crypto` is an interface only (Step 2) |
| 5 | Local services with one command | ✅ Done | `pnpm dev:up` ([local development](local-development.md), [ADR 0002](adr/0002-local-services.md)) |
| 6 | Commit hooks and conventional commits | ✅ Done | [ADR 0003](adr/0003-quality-gates-without-new-dependencies.md) |
| 7 | CI pipeline with caching; PR template with definition of done | ✅ Done | `.github/workflows/ci.yml`, `.github/pull_request_template.md` |
| 8 | Cloud in an India region with IaC: dev, staging, production | 🟡 Partial | Dev stack applied (one lean host, ADR 0008): ports 80/443 only, admin via Session Manager, 4 KMS keys, uploads bucket, nightly snapshots. Region pinned to `ap-south-1`. No managed databases, load balancer or separate accounts ([cloud setup](cloud-setup.md), ADRs [0005](adr/0005-aws-dev-environment.md), [0006](adr/0006-infra-layout-and-state.md)). Staging and production folders exist but are not provisioned |
| 9 | Auto-deploy to dev and staging; preview deploy per PR | 🟡 Partial | Deploy to dev on merge: OIDC, image scan gate, SSM deploy, smoke test, rollback to the previous tag. No staging, no previews (replaced by dev only, ADR 0009). Re-runs of the same commit skip the build because ECR tags are immutable. First green Deploy dev on `main`: `5f5c956`, 18 October (scan gate passed, smoke test passed). Gap: it logged "Previous tag: none", so rollback had no target on that run |
| 10 | README, contributing guide, ADR template, `docs/` | ✅ Done | |

### Step 1 exit criteria

Walked through on 17 October 2026, with the changes in [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md).

| Criterion | Status | Evidence |
| --- | --- | --- |
| New developer runs all three apps locally within 30 minutes | ✅ Done | `pnpm dev:up` ([local development](local-development.md)); CI's E2E smoke job starts all three from a clean checkout. Not yet timed on a fresh machine |
| Merged PR reaches staging without manual steps | 🔁 Replaced by dev only, see ADR 0009 | Deploy dev runs after CI on `main`: first deploy of `52272c8990c8` answered on `https://15.252.65.98/api/readyz` (PostgreSQL and Redis ok). Scan gate, smoke test and rollback added in B3 (PR #17). Merge of PR #30 deployed `5f5c956ff9a2` with scan, deploy and smoke test passing ([run](https://github.com/themechanicalguy/heach/actions/runs/39063937336)) |
| `main` protected; pipeline blocks a failing build | 🟡 Partial | CI fails on a failing build (9 checks on every PR). Branch protection is available since the repository became public (22 October: HTTP 404 `Branch not protected`) but not enabled; owner decision pending ([environments](environments.md#branch-protection-on-main)) |
| Third-party applications submitted and tracked | 🟡 Partial | Tracked: issues #19 to #25 (label `partner-onboarding`). Submitting them is the account holder's task |
| Credit-expiry alerts active and tested, including simulated levels (playbook) | 🟡 Partial | github-oidc applied (18 October plan: no changes); GitHub variables set; real run reports ok, $120 of $120; simulated Watch, Plan, Act and Emergency each updated issue #29. All alert paths (levels, plan not ACTIVE, burn rate, failed check) verified locally with stubbed `gh`/`aws`; burn rate now alerts on its own. Labelled test alert published 18 October ([run](https://github.com/themechanicalguy/heach/actions/runs/39065434862)). Scheduled runs green 18 to 22 October (checked 22 October). Subscription state contradictory in the records (confirmed at 01:38 IST, PendingConfirmation at 16:18 IST on 18 October) and not re-checked (AWS session expired); email receipt never confirmed. Pending: subscription check and email receipt (owner), second address. `dev-sleep`/`dev-wake` tested 18 October: host stopped and `/api/healthz` stopped answering; after wake the smoke test passed |
| ADR lists every requirement relaxed for the pilot (playbook) | ✅ Done | [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md) |

## Development process

| Item | Status | Notes |
| --- | --- | --- |
| Spec-driven development with feature specs ([ADR 0011](adr/0011-spec-kit-feature-specs.md)) | 🟡 Partial | Built: Spec Kit 1.2.0 with the Claude Code skills, [constitution](../.specify/memory/constitution.md) derived from agreed rules, HEACH spec, plan and tasks templates, [workflow](spec-workflow.md), [specs index](specs/README.md), CI checks `check-specs` (sections, threat models, known and unique criterion IDs, index) and `check-pr-spec` (Spec linked job), PR template lines. ADR 0011 accepted and constitution ratified by the merge of PR #53 (20 October). First feature, [001 session-refresh reliability](../specs/001-session-refresh-reliability/spec.md), approved and taken through implement and converge. Missing: decisions on proposed amendments PA-1 to PA-4 and the `spec-exempt` label. The checks prove structure only, not content or approval |

## Requirements by module

Every module not listed under "Partial" below is ⬜ Not started.

| Module | IDs | Done | Partial | Not started | Planned in step |
| --- | --- | --- | --- | --- | --- |
| DC Data classification | DC-01 (Step 2 spec) | 1 | 0 | 0 | 2 |
| EN Encryption | 13 | 3 | 9 | 1 | 2 |
| SE Access control and audit | 9 | 1 | 4 | 4 | 2, 3, 6 |
| PR Privacy and consent | 7 | 0 | 2 | 5 | 3 |
| SO Secure development and operations | 10 | 2 | 5 | 3 | 2, 6, 10 |
| PF Performance | 7 | 4 | 2 | 1 | 2 |
| A11Y Accessibility | 7 | 0 | 0 | 7 | not mapped (see gaps) |
| I18N Multi-language | 7 | 5 | 1 | 1 | 2 |
| TS Testing | 9 | 3 | 4 | 2 | 2 |
| LM Logging and monitoring | 9 | 1 | 6 | 2 | 2 |
| UX User experience | 8 | 5 | 0 | 3 | 2 |
| AC, PO, KY, AD-01 to 03, 11, 12 | 6 + 7 + 9 + 5 | 0 | 0 | all | 3 |
| SL, AV, SD, AD-04 | 9 + 4 + 5 + 1 | 0 | 0 | all | 4 |
| BK, PY, NT, AD-05, AD-07 | 9 + 7 + 3 + 2 | 0 | 0 | all | 5 |
| OC, HS, RF, AD-06 | 7 + 6 + 3 + 1 | 0 | 0 | all | 6 |
| IC, LB, AD-13 | 10 + 11 + 1 | 0 | 0 | all | 7 |
| MV, AD-15 | 16 + 1 | 0 | 0 | all | 8 |
| PK, RR, AD-08 to 10, 14, 16, 17 | 8 + 8 + 6 | 0 | 0 | all | 9 |

No functional requirement (journeys J1 to J9) is implemented yet.

Counts after Step 2 (18 October 2026, reconciled with the Partial table on 22 October), strict: Done only where the requirement is met as
written today, not just its Step 2 part.
- **EN:** Done 03, 09, 13. Partial 01, 02, 04, 05, 06, 07, 10, 11, 12. Not started 08.
- **SE:** Done 02. Partial 04, 05, 07, 09.
- **SO:** Done 01, 05. Partial 03, 06, 07, 08, 10.
- **PF:** Done 02, 03, 05, 06. Partial 01, 07 (shell only, no queued actions).
- **I18N:** Done 01, 02, 03, 04, 06. Partial 07 (native review). Not started 05.
- **TS:** Done 01, 02, 07. Partial 03, 05, 06, 09.
- **LM:** Done 02. Partial 01, 03, 04, 05, 07, 09.
- **UX:** Done 01 to 05. Not started 06 to 08.

## Step 2: Secure foundation and quality gates

[Spec](specs/step-02-secure-foundation.md). Evidence per acceptance criterion is in the
[Step 2 log](step-2-progress.md).

| Part | Status | Notes |
| --- | --- | --- |
| Engineering (code, tests, CI gates, ADR 0010, runbooks) | 🟡 Partial | PRs #34 to #45 merged with CI green; the Odia note flow runs end to end in CI behind Caddy: encrypted, owner only, audited, absent from logs. Corrective defects found since (review of 18 October, spec 001 analysis), confirmed in code on 22 October: note and audit not atomic and reads audited before decryption (fixed by spec 003), session rotation not atomic, replay winner survives, cookie cleared on 5xx (fixed by spec 004), re-encryption job unbounded, miscounted and unaudited (fixed by spec 005). Every corrective defect from the [assessment](step-2-assessment-2026-10-22.md) is now fixed with tests (specs 001 to 005, PRs #56, #64, #67, #69 and #70); CI green on `main` and deployed to dev; re-verified locally on 24 October (fresh, uncached: `pnpm check` 37 of 37 tasks; API integration 107 of 107 on PostgreSQL and Redis, every SE-05.5 to SE-05.10, SE-07.14 to SE-07.20 and EN-05.4 to EN-05.9 test passing). Done on owner review of the evidence (gate G4) |
| Infra apply and live dev checks | ✅ Done (deployed); 🟡 operational acceptance pending | 18 Oct: dev and bootstrap applied. Verified live then: EN-01.3 TLS, EN-04.2 KMS, EN-12.1 secret loading, EN-12.2 rotation (with recovery), EN-10.3 backup storage and off-account copy, EN-10.4 isolated restore and decryption, and LM-04.1 vitals. Latest Deploy dev green on 23 October for `491f5a0` (specs 003 to 005; [run 39915546133](https://github.com/themechanicalguy/heach/actions/runs/39915546133): deploy, rollback target recorded, smoke test of `/healthz` and `/api/readyz`). The smoke test does not exercise the corrective behaviour; that is proven by CI and local tests, not on the host. Deploy dev for `3c2d8af` (#71, dev dependencies only) was also green on 24 October ([run 40018826831](https://github.com/themechanicalguy/heach/actions/runs/40018826831)). SO-08.3 and LM-07.1 alerts were published to SNS; delivery never confirmed. The owner reported on 22 October (in a Claude Code session, not recorded in the repository) re-creating and confirming the email subscription and sending a synthetic test; its receipt is unconfirmed. **24 October:** subscription confirmed in AWS (1 confirmed, 0 pending). Spec 007 deployed (`8b0387f`) and verified live ([record](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24)). Labelled synthetic LM-07.1 and SO-08.3 alerts published 16:05 and 16:06 UTC, SNS delivered 1 and 1, failed 0; inbox receipt confirmed by the owner 25 October. Backup and restore re-proven on the host after the role split; off-account copy pulled again (24 October). No recurring restore check yet (spec 006 approved 25 October) |
| Owner decisions on dependencies | ✅ Done | Approved 18 October and built: `caddy-ratelimit` (SO-08.2, CI floods the deploy bundle), Prometheus and Grafana local only (LM-05.1 record), source maps to GlitchTip (LM-03.1 record). `@sentry/cli` not used: its maintained versions are FSL-1.1-MIT, not open source (D4); `scripts/upload-source-maps.mjs` uses GlitchTip's API instead |
| Native Odia review (I18N-07) | ⬜ Owner | [Review sheet](reviews/odia-review-step-2.md) ready (34 keys, questions); reviewer not yet engaged |
| Lawyer review (D6) | ⬜ Owner | Step 2 exit criterion. [Review pack](reviews/lawyer-review-step-2.md) ready: Aadhaar route, DPDP questions, draft consent wording; lawyer not yet engaged |

### Partial requirements

| ID | What exists | What is missing |
| --- | --- | --- |
| EN-01 | TLS on 443 through Caddy's internal CA, HSTS header, port 80 redirects to HTTPS. PostgreSQL and Redis accept TLS only (private CA, `deploy/dev/make-certs.sh`); plaintext refused locally, in CI and on the dev host bundle | Publicly trusted certificate (internal CA on the dev host; EN-01.3 recorded: TLS 1.2 and 1.3 only) |
| EN-02 | Encrypted EBS disk and snapshots, state bucket, uploads bucket (SSE-KMS), ECR images | Encrypted log store; queues and search do not exist yet |
| EN-04 | Customer managed KMS keys in Mumbai; only `GenerateDataKey` and `Decrypt` (EN-04.2 verified live 18 October). Since spec 007 (applied 24 October) the data-domain keys belong to the API role and the host role keeps only the backup key; simulated live 24 October (Decrypt allowed, Encrypt denied). `@heach/crypto` envelope encryption, API KMS adapter, `app.data_key` table | Staging and production keys (no such environments yet) |
| EN-05 | Data keys versioned per domain; old versions decrypt (EN-05.1); KMS keys rotate yearly (EN-05.2); re-encryption job and runbook (EN-05.3). [Spec 005](../specs/005-bounded-reencryption/spec.md): one keyset pass, only versions below the target, true counts, exit 1 on failure, per-row audit as `system` / `job:reencrypt` (EN-05.4 to EN-05.9: `reencrypt.spec.ts`, `test/reencrypt.int-spec.ts`; [evidence](../specs/005-bounded-reencryption/tasks.md#evidence)) | No rotation schedule for data keys yet; the bounded job is deployed and ran once on the dev host on 24 October without `--rotate` (exit 0, nothing to move); a rotation on dev has not been run (owner's call) |
| EN-06 | One KMS key per data domain (health, identity, payments, documents) in dev, rotated yearly (`enable_key_rotation`, 365 days); the API wraps each domain's data keys with that domain's key (`KmsKeyProvider`, alias prefix; EN-06.1 unit test, EN-04.2 verified live) | Only the dev environment exists, so there are no separate staging or production keys yet |
| EN-07 | Private, versioned uploads bucket, SSE-KMS (documents key), public access blocked, TLS only | Per-object keys, virus scanning, signed URLs (Step 2 onward) |
| EN-10 | Nightly EBS snapshots kept 7 days, encrypted. Migrations run forward from empty in CI; separate migrator, API and audit-owner roles. Backup KMS key, private backups bucket and nightly dump timer live on dev; off-account encrypted copy on the owner's Mac; local and dev-host restore records (EN-10.3, EN-10.4) | No recurring restore check yet (one-off records, 18 and 24 October; spec 006 approved 25 October). Off-account copy pulled by hand (18 and 24 October); weekly reminder is an owner action ([ADR 0012](adr/0012-off-account-recovery-of-restricted-fields.md) R2, accepted). Restricted fields in the off-account copy are wrapped by the dev KMS keys, so they cannot be decrypted if the AWS account is lost: accepted for dev (R1), escrow wrap before the pilot (backlog 6a). Passphrase recovery from a password-manager copy not yet tested (R3, owner). Second-Region or managed backups revisited at the pilot (D1); SO-10 drill in Step 10 |
| EN-12 | gitleaks in hooks and CI; generated passwords in SSM Parameter Store; CI deploys over OIDC without keys; the API reads its secrets by name from Parameter Store at start-up (only the ones it needs); rotation runbook. [Spec 007](../specs/007-security-review-fixes/spec.md) (EN-12.4): the API has its own IAM role granting exactly its four parameter ARNs; the host role (bootstrap, migrations, backups) is out of a container's reach (metadata hop limit 1); bootstrap and migration passwords go only to their one-off containers (`load-secrets.spec.ts`, `scripts/check-infra-security.test.mjs`, `scripts/deploy-script.test.mjs`) | Rotation run once in dev (EN-12.2, recorded); Secrets Manager revisited at the pilot (D2). EN-12.4 applied and deployed 24 October and verified live (IAM simulation, in-container checks; [record](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24)); Done on owner review |
| SE-07 | Step 2: 15-minute access tokens, rotating single-use refresh cookie, replay revokes all sessions, logout from all devices (SE-07.1 to SE-07.4). [Spec 001](../specs/001-session-refresh-reliability/spec.md): the web client shares one refresh per tab, serialises refreshes across tabs (Web Locks), signs other tabs out (BroadcastChannel), keeps the session on network errors and makes logout final (SE-07.5 to SE-07.13; unit tests `apps/web/src/lib/api.test.ts`, `session.test.tsx`; integration `apps/api/test/auth.int-spec.ts`; E2E `apps/web/e2e/session-refresh.spec.ts` in the deploy-bundle job). Verified locally on 21 October: unit 26/26, integration 71/71, E2E 12/12 on three viewports, SC-001 50/50 ([evidence](../specs/001-session-refresh-reliability/tasks.md#evidence-2026-10-21-local-github-actions-did-not-start-account-billing)); CI green on #56 (all 9 checks, including the session E2E in the deploy-bundle job). [Spec 004](../specs/004-transactional-session-rotation/spec.md): rotation in one transaction under the user's row lock; a concurrent replay revokes the winner too; sign-out of all devices takes the same lock; the cookie is cleared only on 401 (SE-07.14 to SE-07.20; `session.service.spec.ts`, `auth.controller.spec.ts`, `test/session-rotation.int-spec.ts`; [evidence](../specs/004-transactional-session-rotation/tasks.md#evidence)) | OTP re-verification for sensitive actions (Step 3). A refresh response lost after the server committed still signs every device out (strict replay detection; grace window not adopted). Cross-tab coordination tested in Chromium only; browsers without Web Locks (iOS before 15.4) can still race two tabs. [Spec 007](../specs/007-security-review-fixes/spec.md) (Approved 24 October, not deployed): device sign-out revokes the whole session family, a signed-out family's token is a plain 401, and test sign-in on the dev host needs the loopback entry's key (SE-07.21 to SE-07.23; `session-rotation.int-spec.ts`, `test-login.int-spec.ts`, `test-login.gate.spec.ts`) |
| SE-04 | Admin has no public port; reached only through Session Manager port forwarding (IAM sign-in with MFA) | In-app MFA, short sessions, export controls (no admin login exists yet) |
| SE-05 | Hash-chained audit log in its own schema; the API role may only call `audit.append`; verifier reports the first broken link; every sample-note read, write and denial and every role denial is audited, without Restricted values (SE-05.1 to SE-05.4, Step 2 tests). [Spec 003](../specs/003-transactional-audit-writes/spec.md): shared `withTransaction` helper (`apps/api/src/data-stores/transaction.ts`); a note and its entry commit together; reads are audited only after decryption, and failures as `.read.failed` / `.list.failed` (SE-05.5 to SE-05.10: `transaction.spec.ts`, `notes.repository.spec.ts`, `test/audit-transaction.int-spec.ts`; [evidence](../specs/003-transactional-audit-writes/tasks.md#evidence)) | No retention schedule for the audit log yet (PR-05, not started). No admin actions exist to audit |
| PR-06 | `naming` module rejects regions outside India; everything in `ap-south-1` | Data processing agreements with third parties |
| PR-07 | Logger redacts personal keys | No analytics or monitoring tools yet |
| SO-03 | Secret scan, `pnpm audit` (high blocks), ECR scan on push; Semgrep CE and Trivy in CI on every PR, each scanner proven by a fixture. The patched Caddy build pins its Go toolchain (`GOTOOLCHAIN` in `apps/admin/Dockerfile`), bumped when Trivy reports a fixed Go CVE. 24 October 2026: the full audit (dev dependencies included) reported GHSA-f2ph-cmg5-wxc8 (critical) and GHSA-px85-f4q5-jh77 (high) in Storybook 10.6.1 and GHSA-587h-7wmj-h5pm (high) in Vite 8.3.2; bumped to Storybook 10.6.2 and Vite 8.3.4. The CI gate audits production dependencies only (`--prod`), which stayed clean | Dynamic scan and penetration test (SO-04, before pilot). [Spec 007](../specs/007-security-review-fixes/spec.md) (SO-03.2): CI now audits all dependencies (high blocks); pnpm overrides pin patched multer (production, GHSA-q7qp-rjg7-q26m), Lighthouse 13 under `@lhci/cli` (drops the unfixed `extract-zip`), tmp, uuid and basic-ftp; body-parser, undici and zod refreshed; `pnpm audit` and `pnpm audit --prod` report no known vulnerabilities on 24 October. The Trivy image scan still uses `--ignore-unfixed` (unchanged) |
| SO-06 | Access only through SSM Session Manager, no SSH | Bastion or zero-trust proxy for production, quarterly review |
| SO-07 | Synthetic-data rule in docs and CLAUDE.md | Enforcement once real data exists |
| SO-08 | API rate limit per route: every request is counted by client address whatever its credentials, and a live session by its user as well ([spec 007](../specs/007-security-review-fixes/spec.md) SO-08.12, Approved; amends spec 002, which counted a live session by user only), so neither fake nor valid tokens create allowances; `Retry-After` and the generic error body on 429; `RATE_LIMIT_WINDOW_SECONDS` (SO-08.1, SO-08.4 to SO-08.11, [spec 002](../specs/002-rate-limit-bypass/spec.md): unit `user-throttler.guard.spec.ts`, integration `rate-limit.int-spec.ts` on real PostgreSQL and Redis, deploy-bundle check `scripts/rate-limit-check.sh` through Caddy in CI). Caddy edge limit 300 a minute per IP (SO-08.2), authorisation-failure alert (SO-08.3), input validation | Counters are in memory, per API process and per route; a second API process needs shared counters first (review P-1, [backlog](backlog.md) item 8). Checked 22 October: one API container, one Node process, so not needed yet. Sign-up, OTP and device throttling (SE-08) arrive with Step 3. WAF at the pilot (D3) |
| I18N-01 | Locales `or`, `en`, `hi` defined; Odia default | Locale-prefixed routing, adding a language without code change |
| I18N-02 | ESLint fails on hard-coded JSX strings and text props; ICU catalogues for or, en, hi with plurals; locale routes `/or`, `/en`, `/hi`; bundled Odia and Devanagari fonts | Native Odia review of the text (I18N-07) |
| TS-03 | API integration tests against real PostgreSQL and Redis in CI (TS-03.1): 120 tests in 17 files on `main` (24 October 2026), covering health, readiness, auth (test login, refresh, rotation, device sign-out, test sign-in gate), sample notes and their audit transactions, the authorisation matrix, rate limits, re-encryption, data TLS, roles and the audit chain | `POST /v1/rum` has no API integration test |
| TS-05 | E2E smoke for web and admin on every PR (Chromium) | Nightly full suite; mobile and tablet projects |
| LM-02 | `@heach/logger` masks personal and Restricted keys and mobile numbers in values (whole trace, span and UUID hex IDs kept intact); ESLint fails on `console.*`; correlation and trace IDs on every API line; OpenTelemetry traces to Jaeger locally; Grafana dashboard and GlitchTip in the local `observability` profile | Nothing central on the dev host (ADR 0010) |
| UX-01 | App shell with header, language switch, offline banner and bottom navigation on `/or`, `/en`, `/hi`. `@heach/ui`: tokens with three breakpoints, Button, TextField, OtpField, Card, Sheet, Table, Toast, BottomNav, loading/empty/error/offline states; Storybook built in CI; axe on every component and story | Tailwind not yet used (plain CSS on tokens); colour contrast checked only in the browser |

## Documentation gaps found in review

Found while building this page. Open items need a decision before the source docs change; under
[ADR 0007](adr/0007-spec-driven-development.md) each is settled in the spec of the step it
affects at the latest (for example item 6 in the Step 2 spec).

1. **37 requirement IDs are not assigned to any guideline step:** all of A11Y-01 to 07; EN-01, 02,
   07, 10, 13; SE-01, 03, 04; PR-02, 03, 05, 06, 07; SO-02, 04, 06, 07, 09, 10; TS-08, 09;
   LM-08, 09; UX-06, 07, 08; AC-05; BK-06; LB-09; RR-07. Some are covered implicitly by step
   text (for example backups in Step 2, pen tests in Step 6) but not by ID, so they can be missed.
2. **Data classification (DC) has no requirement IDs**, unlike every other module, so it cannot
   be referenced the way CLAUDE.md asks. The draft [Step 2 spec](specs/step-02-secure-foundation.md) proposes DC-01.
3. ✅ _Resolved: the requirements now point to the guideline as the only plan._ **Two delivery plans disagree.** The requirements' "Delivery plan" has 8 phases (0 to 7) and a
   "Sprint 0" list; the guideline has 10 steps. Lengths and grouping differ (for example the
   requirements put IC, LB and MV in one phase; the guideline splits them into Steps 7 and 8).
   The requirements should point to the guideline instead of keeping their own plan.
4. ✅ _Resolved._ **"Sprint 0 foundation" list is mis-numbered** (`1, 1, 1, 2, …`) in the requirements.
5. ✅ _Resolved._ **Branch protection and signed commits** (guideline Step 1 item 1 and exit criterion) conflict
   with [ADR 0004](adr/0004-github-free-no-branch-protection.md). The guideline should note the
   accepted deviation.
6. **Backups to a second India region** (EN-10, guideline Step 2 item 3, SO-10 drill in Step 10)
   assume cross-region copies to Hyderabad. If the AWS project is limited to a single Region,
   this is not possible; confirm the project's allowed Regions before Step 2 and record the
   outcome in an ADR. Resolved by decision D1 in the [Step 2 spec](specs/step-02-secure-foundation.md); EN-10 reworded.
7. **AD-04 lists four catalogue types**, but guideline Step 4 says the catalogue covers all six
   services (adds dental and skin treatments, lab tests). AD-04 should match.
8. ✅ _Resolved._ **Product name:** the requirements say the application "has no name yet" and keep it as an
   open question; the repo and CLAUDE.md call it HEACH.
9. ✅ _Resolved._ **Repository row of the stack table** in the requirements lists three packages; the
   monorepo has six (`types`, `crypto`, `logger` missing).
10. **Open questions have no owner or due step.** Several block specific steps (load targets block
    TS-08 and Step 4 load tests; the Aadhaar route blocks Step 3; Hindi at launch affects I18N).
11. **Third-party applications** (payment gateway, SMS DLT, Aadhaar partner, video) must start in
    Step 1, but their status is not tracked anywhere in the repo.
12. ✅ _Resolved 18 October: module approved and added to D4._ **SO-08.2 asks for a Caddy rate limit, but stock Caddy has none.** It needs the third-party
   `caddy-ratelimit` module and a custom Caddy build, which is not in the Step 2 dependency list
   (D4). The API rate limit (SO-08.1) is on. Owner decision: add the module to D4, or reword SO-08.2.
13. **The admin entry may not answer through port forwarding as documented.** Found 24 October
   while adding the test sign-in entry (spec 007): `https://localhost:8443` sends the name
   `localhost`, but the admin site in `deploy/dev/Caddyfile` is addressed only by the host's IP,
   so Caddy has no matching site (an empty response, or a TLS error when no `localhost`
   certificate exists). Reproduced against a local Caddy, not on the dev host. The new 9443 entry
   lists `localhost` too; the admin site was left unchanged (outside the security review's scope).
   Owner decision: add `https://localhost:8443` to the admin site, or document another way in.
   Reproduced on the dev host on 24 October 2026: `https://localhost:8443` answers an empty 200,
   the public host name on 8443 serves the admin page. The same applies to `https://127.0.0.1` and
   `https://127.0.0.1:9443` on the host (no site for that name; CI sets `PUBLIC_HOST=127.0.0.1`, so
   CI does not see it).
14. **Coverage reports are committed** (`packages/crypto/coverage-unit/`, 16 files): any local
   coverage run rewrites them. They should be untracked and ignored.
15. **The 18 October codebase review is not in the repository** (the backlog cites
   `docs/reviews/2026-10-18-codebase-review.md`, which exists only as an untracked file in the
   owner's working copy), and its findings C-3 (note save without error handling or in-flight
   guard), P-2 (global advisory lock on every audited request) and A-1 (toast live region inserted
   with its message) are not in the backlog. Owner decision: commit the review and add the three
   findings, or record them as accepted.
