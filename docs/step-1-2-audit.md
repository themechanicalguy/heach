# Step 1 and Step 2 audit

Independent audit of guideline [Step 1](mvp-v1-implementation-guideline.md#step-1-repository-and-app-initialization)
and [Step 2](mvp-v1-implementation-guideline.md#step-2-secure-foundation-and-quality-gates) against
their specifications, the requirements, the code, the tests, CI, the deployment and the dated
acceptance evidence, with a verdict on starting Step 3. Items still to be checked later are in the
[follow-up register](follow-up-register.md); this page states the findings and does not keep a
second list.

- **Date:** 25 October 2026, 08:47 to 09:20 UTC (14:17 to 14:50 IST), by Claude Code.
- **Baseline:** `main` at `338943c` (#83), the latest commit on GitHub at the start of the audit,
  read in the clean clone `~/work/heach`. The owner's Desktop checkout (`feat/step2-quality-gates`
  at `6e175a4`, iCloud-damaged, with uncommitted doc drafts and two untracked reviews) was left
  untouched; only its untracked 18 October review was read.
- **Scope:** the 10 Step 1 build items and 6 exit criteria (4 in the guideline, 2 from the
  playbook); the 15 Step 2 build items and 5 exit criteria; all 74 acceptance criteria of the
  [Step 2 spec](specs/step-02-secure-foundation.md) with its decisions D1 to D6; the 48 criteria and
  the success criteria of feature specs 001 to 007; ADRs 0004 and 0008 to 0012; the
  [acceptance matrix](step-2-acceptance-matrix.md), [Step 2 log](step-2-progress.md),
  [implementation status](implementation-status.md), [specs index](specs/README.md),
  [Step 1 review](step-1-review.md), backlog and reviews.
- **Rules followed:** read-only against GitHub, AWS and the dev host; synthetic data only; no
  infrastructure change, deploy, restore run on the host, external contact or human approval.

## Verdict

**Step 2 is not complete. Step 3 is ready to begin with documented carry-forward items**, on the
conditions in [Step 3 readiness](#step-3-readiness).

Of the 74 Step 2 acceptance criteria, 73 are met as written. The exception, found by this audit,
is **LM-02.1**: the shared logger masks mobile numbers only in top-level strings and redacts personal
keys one level deep, so a synthetic number nested two levels down, or inside a nested string, was
written in clear (probe below). No current call site logs nested personal data, so nothing has
leaked. It is a small fix, but it needs a spec (FU-27) and must land before Step 3 logs mobile
numbers. Everything else in Steps 1 and 2 is built and tested, and the dev host runs the current
`main`.

The rest of what keeps Step 2 open is three human actions and one scheduled observation:

- the lawyer review;
- the native Odia review;
- a real-phone demo, a guideline rule nobody had tracked;
- the four weekly restore checks, 1 to 22 November 2026.

None of these can be done by an engineer. Step 1 still has four gaps:

- no partner application has been submitted;
- branch protection is off;
- the automatic rollback has never once succeeded;
- the 30-minute fresh-clone start has never been timed.

## Status values

| Status | Meaning in this audit |
| --- | --- |
| Implemented and verified | Built, with a passing automated test or a dated manual record that proves the criterion as written |
| Implemented, evidence missing | Built, but the proof the criterion asks for is missing, partial or never succeeded |
| Partial | Some of the criterion is built or met; the gap is stated |
| Not implemented | Nothing built or recorded |
| Accepted deferral | Not met by decision, accepted in writing (ADR or step spec) with an end condition |
| External review pending | Waits on a person outside engineering (lawyer, native reviewer) |
| Scheduled observation pending | Built and deployed; the proof is runs that can only happen on future dates |

## What was checked on 25 October 2026

Evidence keys used in the tables: **CI** passed in CI on `main` `338943c`
([run 40174092975](https://github.com/themechanicalguy/heach/actions/runs/40174092975), all 7 jobs);
**U** unit tests re-run locally; **I** API integration tests re-run locally; **S** script tests
re-run locally; **E2E** Playwright, in CI only (E2E smoke and Deploy bundle jobs); **Live**
re-checked against the dev host or AWS during this audit; **Dated** a manual record made earlier,
not repeated.

| Check | Result |
| --- | --- |
| Pull requests | #53 to #83 merged; every one shows all checks green except #75 (docs, merged 24 October 12:08 UTC with Checks and Deploy bundle failing on newly published body-parser and multer advisories; fixed by #74 at 12:37) and #70 ("Spec linked" failed, then passed on re-run before the merge); #64 and #67 also list superseded status runs as cancelled. No PR open |
| CI on `main` | Green for every push from #74 onwards. Red for `36e82ac` (#72) and `525e9cf` (#75) on 24 October: the dependency audit and Trivy found the two new highs, and Deploy dev was **skipped** both times, so the gates did block |
| Deploy dev | [Run 40174691876](https://github.com/themechanicalguy/heach/actions/runs/40174691876) green for `338943c`: build, image scan gate, rollback target `952f35067ca1` recorded, SSM deploy, smoke test. 72 runs since 17 October: 31 green, 21 failed, 19 skipped, 1 cancelled |
| Rollback | The "Roll back to the previous tag" step ran 11 times (17 and 18 October) and **failed every time** (expired ECR tags, preflight, rotation outage); it has not been needed since. Never proven to work |
| Credit watch | Scheduled runs green every day, 18 to 25 October (cron 03:30 UTC; GitHub started them 4 h 40 min to 5 h 40 min late). Latest: $117.37 of $120 left, plan ACTIVE, ends 2027-04-17 (173 days), level ok |
| Branch protection | `main`: HTTP 404 "Branch not protected", no rulesets; repository public. Last 30 commits on `main` verified (GitHub-signed squash merges); only the 3 to 7 October bootstrap commits bypassed a PR |
| Partner issues | #19 to #25 open, no comment, assignee or milestone since 17 October |
| Local check (Node 24.22.1, pnpm 12.8.1) | `turbo run lint typecheck test build --force`: 37 of 37 tasks, uncached. Unit: 213 passed (api 93, ui 55, web 26, crypto 15, i18n 13, logger 5, flags 3, types 2, admin 1). `lint:scripts` clean; `test:scripts` 58 of 58 |
| API integration (isolated local stack `heach-spec003`, PostgreSQL 18 and Redis over TLS, synthetic data) | 144 of 144, 19 files, with `COMPOSE_PROJECT_NAME=heach-spec003`. The first run without it failed 9 of 16 restore-check tests: the test drives PostgreSQL through the default compose project while the job uses the `.env` ports (FU-17). That run also created and dropped scratch databases in the owner's Desktop stack; the one it left (`heach_restorecheck_1792918679`, created by this run at 08:57:59 UTC) was dropped, and that stack is back to its four databases |
| Criterion traceability | 122 criterion IDs (74 step, 48 feature). Every one has a test whose title names it, a CI step named for it, or a dated manual record. Titles that name the ID but do not start with it: EN-01.2, EN-09.2, SE-05.7, EN-05.8; `coverage-of-components.test.ts` (TS-02.1) does not name its ID |
| Dev host, public (Live) | `scripts/smoke-test.sh 15.252.65.98` passed; `/api/readyz` postgres ok, redis ok. TLS 1.1 refused (`alert protocol version`), 1.2 (ECDHE-ECDSA-AES128-GCM-SHA256) and 1.3 (TLS_AES_128_GCM_SHA256) negotiated; issuer Caddy Local Authority. `/or` carries nonce CSP with `strict-dynamic`, HSTS `max-age=31536000`, `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`, `no-store`. Port 80 answers 301 to HTTPS. Public `POST /api/v1/auth/test-login` 404; anonymous `GET /api/v1/sample/notes` 401 |
| Dev host, inside (Live, one read-only SSM command) | `DEPLOYED_TAG` `338943c87d0a`. Restore-check timer enabled and active, never fired (`LastTriggerUSec` empty), next Sun 1 Nov 2026 00:00 UTC; its service exited 0 at 03:45:03 UTC (the T017 hand run). Backup timer last ran Sat 24 Oct 21:00 UTC (exit 0), next 25 Oct 21:00 UTC. API-credentials timer ran 08:42 UTC (exit 0). `restore-check.sh` and the timer have the same SHA-256 as `main`. Six containers up and healthy |
| AWS (Live, read-only) | `tofu plan` for `infra/envs/dev`: no changes. SNS topic: 1 confirmed, 0 pending. Backups bucket: nightly dumps 18 to 24 October, SSE-KMS with `alias/heach-dev-backup`, all four public-access blocks, old versions expire after 35 days. Five KMS keys, yearly rotation on, none multi-Region. Instance `t4g.small` requires IMDS tokens, hop limit 1. Scheduler: credit reminders 2027-03-18 and 2027-04-10, 09:00 `Asia/Kolkata`. Budgets `heach-free-credits` 120 and `heach-monthly` 20 |
| Off-account copy (Live) | Newest `2026-10-24T1609Z.dump.enc`, checksum OK |
| Odia sheet | All 34 keys of `or.json` are on the [review sheet](reviews/odia-review-step-2.md) |
| Logger masking probe (synthetic numbers, built `@heach/logger`) | Masked: a number in a top-level string, a `phone` key at the top and one level down. **Written in clear:** `{ req: { query: { phone } } }` and a number inside a nested string (`{ req: { detail: 'call …' } }`). App call sites today log flat objects with run IDs, counts and error names only |

**Not repeated, and why:** `pnpm dev:up` on a fresh machine (would start Docker services; the
owner asked to be asked first); Playwright and Lighthouse locally (they ran green in CI on
`338943c`); Semgrep, Trivy and gitleaks locally (green in CI); `tofu plan` for `infra/github-oidc`
(its variables file is not in this clone); IAM policy simulation, the loopback test sign-in and a
restore check on the host (each was recorded on 24 or 25 October, and a host restore run would add
an audit entry to the live log); LM-03.1 and LM-05.1 local stacks; inbox receipt of any alert
(only the owner can see the inbox).

## Step 1

Step 1 was built before ADR 0007 and has no spec; its items come from the guideline and the
playbook.

### Build items

| # | Item | Status | Source and tests | Evidence | Gap and impact on Step 3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Branch protection on `main`: PRs only, one review, passing checks, signed commits | Accepted deferral (premise outdated) | `scripts/hooks/pre-push.mjs` blocks pushes to `main` (override `HEACH_ALLOW_MAIN_PUSH=1`); ADR 0004 | Live: not protected, no rulesets; GitHub signs every squash merge (last 30 verified) | ADR 0004 assumed a private repository; the repository is public, so protection is free and possible. Nothing enforces green checks: #75 merged red. Owner decision FU-10. Does not block Step 3 |
| 2 | pnpm workspaces, Turborepo, Node LTS pinned, strict TypeScript | Implemented and verified | `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc` 24, `engines` `>=24 <25`, `packages/config/tsconfig/base.json` `strict` | U, CI | None |
| 3 | App shells `web`, `admin`, `api` | Implemented and verified | `apps/*` | CI; Live smoke | Admin through port forwarding may not answer on `localhost:8443` (gap 13, FU-18) |
| 4 | Shared packages | Implemented and verified | `packages/{ui,i18n,config,types,crypto,logger,flags}` | U, CI | The status page row said `crypto` was "an interface only"; it has been implemented since Step 2 (corrected in this change) |
| 5 | Local services with one command | Implemented, evidence missing | `pnpm dev:up`, `docker-compose.yml`, [local development](local-development.md) | CI starts all three apps from a clean checkout (E2E smoke) | Never timed on a fresh machine (exit criterion below) |
| 6 | Commit hooks and conventional commits | Implemented and verified | `scripts/hooks/{pre-commit,commit-msg,pre-push,secrets}.mjs`, `.githooks`, `core.hooksPath` | EN-12.3 fixture in CI | Hooks protect only clones that install them; CI is the real gate |
| 7 | CI with caching; PR template with the definition of done | Implemented and verified | `.github/workflows/ci.yml` (7 jobs), `status-check.yml` (status page and Spec linked), `.github/pull_request_template.md` | CI on every PR #53 to #83 | None |
| 8 | Cloud in an India Region with IaC: dev, staging, production | Implemented and verified (dev); Accepted deferral (staging, production) | `infra/` OpenTofu, `ap-south-1` pinned; ADRs 0005, 0006, 0008, 0009 | Live: `tofu plan` dev no changes | Staging and production folders exist but are not provisioned (ADR 0009) |
| 9 | Auto-deploy to dev and staging; preview per PR | Implemented and verified (deploy to dev); Implemented, evidence missing (rollback); Accepted deferral (staging, previews) | `.github/workflows/deploy-dev.yml`: OIDC, scan gate, rollback target check, SSM deploy, smoke, rollback | Live: run 40174691876 | Rollback has never succeeded in 11 attempts; a broken deploy today needs a manual redeploy. Drill FU-12 |
| 10 | README, contributing guide, ADR template, `docs/` | Implemented and verified | `README.md`, `CONTRIBUTING.md`, `docs/adr/0000-template.md` | Read | None |

### Exit criteria

| Criterion | Status | Evidence | Gap and impact on Step 3 |
| --- | --- | --- | --- |
| A new developer clones, runs one command and sees all three apps within 30 minutes | Implemented, evidence missing | `pnpm dev:up`; CI E2E smoke from a clean checkout | Never timed on a fresh machine; not re-run today (Docker). Low impact |
| A merged PR reaches staging without manual steps (replaced by dev, ADR 0009) | Implemented and verified | Live: `338943c` deployed by Deploy dev after CI, no manual step | Staging replaced by dev (Accepted deferral) |
| `main` protected; the pipeline blocks a failing build | Partial | Deploy blocked by red CI (24 October, skipped twice). Merge not blocked (#75 merged red) | FU-10 |
| Third-party applications submitted and tracked | Partial | Tracked as #19 to #25; none submitted, no activity since 17 October | Step 3's exit needs the identity partner's sandbox (#21) and real OTP SMS needs DLT (#20); lead times are weeks. FU-09 |
| Credit-expiry alerts active and tested (playbook) | Implemented, evidence missing | Scheduled runs 18 to 25 October green; simulated levels 17 October (issue #29); burn-rate path fixed; AWS reminders and budgets exist; topic delivery to the inbox proven by the Step 2 alerts (24 and 25 October) | No Credit watch email has been confirmed received; one address only; personal calendar reminders unconfirmed. The status page row was stale (still said the subscription state was unknown): corrected. FU-11 |
| ADR lists every requirement relaxed for the pilot (playbook) | Implemented and verified | [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md) | ADR 0009 allows plaintext between containers (EN-01 row); Step 2 is stricter (data TLS everywhere), which is allowed |

## Step 2

### Guideline build items

| # | Item | Status | Where proven | Gap and impact on Step 3 |
| --- | --- | --- | --- | --- |
| 1 | KMS keys per environment and domain; envelope encryption, field-level encryption, key versioning, blind indexes | Implemented and verified (dev); Accepted deferral (other environments) | EN-03 to EN-06, EN-09 below; spec 005 | Only dev exists (ADR 0009). Step 3's identity domain is the first new user of its key: S-4 first-use race (FU-13) |
| 2 | Class tags on the schema; CI fails a field without a class | Implemented and verified | DC-01.1, DC-01.2 | None |
| 3 | PostgreSQL with migrations, encrypted connections, least-privilege roles, encrypted backups plus an off-account copy | Implemented and verified; Scheduled observation pending (recurring restore) | EN-01.1, EN-10.1 to EN-10.4; spec 006 | FU-01 to FU-05 |
| 4 | Tamper-evident audit service and helper | Implemented and verified | SE-05.1 to SE-05.4; spec 003 | P-2 global lock and S-3 hash input (FU-13); audit retention is PR-05 (Step 3 onwards) |
| 5 | Token and session handling, role and object guards, authorisation harness | Implemented and verified | SE-02, SE-07; specs 001, 004, 007 | Test identity only; real sign-in is Step 3 (AC-01) |
| 6 | Secrets manager; static analysis, dependency, container and secret scanning in CI | Implemented and verified; Accepted deferral (Secrets Manager, D2) | EN-12, SO-03; spec 007 | Trivy uses `--ignore-unfixed` (FU-24) |
| 7 | Headers, input validation, rate limiting, WAF | Implemented and verified; Accepted deferral (WAF, D3) | SO-05, SO-08; specs 002, 007 | Shared counters before a second process (FU-25); SE-08 throttling is Step 3 |
| 8 | Logger with masking, correlation IDs, tracing, error tracking, dashboards, one alert to on-call | Partial (masking depth); Implemented and verified (the rest); Accepted deferral (error tracking and dashboards local only, ADR 0010) | LM-01 to LM-05, LM-07 | Masking misses nested values (LM-02.1, review S-6, FU-27); must be fixed before Step 3 logs mobile numbers |
| 9 | Locale routing, ICU catalogues, hard-coded string lint, missing-key check, Odia fonts | Implemented and verified; External review pending (native Odia review) | I18N criteria | FU-07 |
| 10 | Tokens, grid, base components, bottom navigation, states, Storybook with accessibility checks | Implemented and verified | UX criteria | A-1 toast live region (FU-13) before Step 3 forms reuse `Toast` |
| 11 | Vitest, Testing Library, integration tests on a real database, Playwright on three viewports, axe, visual snapshots, coverage threshold | Implemented and verified | TS criteria | Changed-line coverage excludes Next route files (only Playwright runs them) |
| 12 | Lighthouse CI and bundle budgets that fail the build | Implemented and verified | PF-02.1, PF-03.1 | Field measurement on a real phone is the pilot (PF-01) |
| 13 | PWA manifest, shell-only service worker, offline banner, no sensitive cache | Implemented and verified | PF-07.1 | Offline bookings are Step 5 |
| 14 | Interfaces and test doubles for SMS, payment, video, identity | Implemented and verified | TS-06.1 | Real adapters arrive with each integration (Steps 3 and 5) |
| 15 | Feature flags; threat-model template | Implemented and verified | FF-01.1, SO-01.1 | None |

### Exit criteria

| Exit criterion | Status | Evidence | Gap and impact on Step 3 |
| --- | --- | --- | --- |
| A sample note entered in Odia on a phone is field-encrypted, readable only by its owner, with an audit entry | Implemented and verified (emulated phone) | EN-13.1, EN-03.1, SE-02.3, I18N-04.1, SE-05.1; `e2e/notes-flow.spec.ts` on the 360 px mobile project behind Caddy in the Deploy bundle job (CI) | Proven in Chromium device emulation, not on a real phone. The guideline's step-end demo on a real mid-range Android phone is not recorded for Step 1 or Step 2 (FU-08) |
| A test proves the note is ciphertext in the database and absent from logs | Implemented and verified | `test/sample-notes.int-spec.ts` (I, CI); Deploy bundle SQL and log checks (CI) | None |
| A PR with a hard-coded string, a missing translation, an accessibility violation, an oversized bundle or a leaked secret is blocked | Implemented and verified (CI fails); not enforced at merge | I18N-02.1, I18N-07.1, UX-01.2, TS-02.1, PF-02.1, EN-12.3 fixtures | CI fails such a PR, but without branch protection nothing stops its merge (FU-10) |
| Traces show one correlation ID from browser to database | Implemented and verified | LM-01.1 (`e2e/notes-flow.spec.ts` E2E; `test/tracing.int-spec.ts` I) | Trace viewer local only (ADR 0010) |
| The lawyer's first review of consent wording and the Aadhaar route is in hand | External review pending | [Review pack](reviews/lawyer-review-step-2.md) ready; not reviewed | FU-06. Step 3's identity and consent slices need its answers |

### Step 2 spec acceptance criteria

All automated criteria below passed in CI on `338943c`; the U, I and S keys show what was also
re-run locally today.

#### Encryption, classification, database, secrets

| ID | Criterion | Status | Source and tests | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| EN-01.1 | API to PostgreSQL and Redis requires TLS; plaintext refused | Implemented and verified | `test/data-tls.int-spec.ts`, `src/config/env.validate.spec.ts`; Deploy bundle plaintext check | CI, I, U | None |
| EN-01.2 | HSTS at least one year on pages and API | Implemented and verified | `test/security.int-spec.ts` | CI, I; Live header | None |
| EN-01.3 | Dev host TLS 1.2 or higher, 1.3 offered | Implemented and verified | Manual | Dated 18 October; Live today (1.1 refused, 1.2 and 1.3 negotiated) | Internal CA until the pilot (FU-20) |
| EN-02.1 | Every disk, bucket, snapshot and backup has KMS encryption | Implemented and verified | `scripts/check-infra-security.mjs` and `.test.mjs` | CI, S; Live backup objects SSE-KMS | None |
| EN-03.1 | Restricted field stored as ciphertext only | Implemented and verified | `test/sample-notes.int-spec.ts`, `notes.repository.spec.ts`, `packages/crypto/src/envelope.test.ts` | CI, I, U | None |
| EN-03.2 | Altered auth tag raises an error, returns nothing | Implemented and verified | `envelope.test.ts` (also truncated tag; `authTagLength` fixed, `envelope.ts:52`) | CI, U | None |
| EN-04.1 | KMS `GenerateDataKey` data key, AES-256-GCM, only the wrapped key stored | Implemented and verified | `envelope.test.ts`, `src/crypto/kms-key-provider.spec.ts` | CI, U | None |
| EN-04.2 | Master key stays in KMS; the API role may only `GenerateDataKey` and `Decrypt` its own keys | Implemented and verified | `check-infra-security.mjs` (CI); since spec 007 the data keys belong to the API role | Dated 18 and 24 October (IAM simulation); Live: `tofu plan` no changes | None |
| EN-05.1 | Rotated data key: old values decrypt, new ones use version 2 | Implemented and verified | `envelope.test.ts` | CI, U | None |
| EN-05.2 | Yearly KMS rotation on every master key | Implemented and verified | `check-infra-security.mjs` | CI; Live: rotation on for all five keys | None |
| EN-05.3 | Documented re-encryption job for one domain | Implemented and verified | `test/crypto.int-spec.ts`, [key-rotation runbook](runbooks/key-rotation.md); spec 005 | CI, I; dated host run 24 October (no `--rotate`) | No rotation schedule (FU-26) |
| EN-06.1 | `health` ciphertext does not decrypt with the `identity` key | Implemented and verified | `envelope.test.ts`, `kms-key-provider.spec.ts` | CI, U | Dev keys only |
| EN-09.1 | Searchable field has an HMAC-SHA-256 blind index per domain | Implemented and verified | `blind-index.test.ts`, `test/crypto.int-spec.ts` | CI, U, I | First real searchable fields are Step 3 |
| EN-09.2 | Lookup uses the blind index only | Implemented and verified | `test/crypto.int-spec.ts` (fixture table) | CI, I | As above |
| EN-13.1 | Note body is ciphertext in the database, absent from logs and from another user's response | Implemented and verified | `test/sample-notes.int-spec.ts`, `e2e/notes-flow.spec.ts` | CI, I, E2E | None |
| DC-01.1 | Field without a class fails the build | Implemented and verified | `test/classification.int-spec.ts`; CI `db:check-classes` | CI, I | None |
| DC-01.2 | Restricted field not stored through `@heach/crypto` fails the build | Implemented and verified | `test/classification.int-spec.ts` | CI, I | None |
| EN-10.1 | Migrations run forward from empty in CI | Implemented and verified | CI integration job bootstraps and migrates an empty database; `test/db-roles.int-spec.ts` | CI, I | None |
| EN-10.2 | API and migrator roles separate; neither changes the audit schema | Implemented and verified | `test/db-roles.int-spec.ts` | CI, I | None |
| EN-10.3 | Nightly backup with its own key in a private ap-south-1 bucket; weekly copy outside the account | Implemented and verified | `deploy/dev/backup.sh`, `heach-backup.timer`, `scripts/backup-pull.sh` | Dated 18 and 24 October; Live: dumps 18 to 24 October, SSE-KMS, private; newest off-account copy 24 October, checksum OK | Weekly pull is manual (FU-16); the copy cannot decrypt Restricted fields without the AWS account (ADR 0012 R1, FU-23) |
| EN-10.4 | A backup restores to an empty database and the note decrypts | Implemented and verified | [Restore records](runbooks/backup-restore.md#restore-records) | Dated 18 and 24 October; host hand run of spec 006 on 25 October | Recurring proof: spec 006 below |
| EN-12.1 | Secrets read from Parameter Store at start-up; none in image, Compose or build | Implemented and verified | `src/secrets/load-secrets.spec.ts`; Trivy in CI | CI, U; dated 18 October | Parameter Store by decision (FU-21) |
| EN-12.2 | Rotation procedure written and run once in dev | Implemented and verified | [Secret-rotation runbook](runbooks/secret-rotation.md); `scripts/deploy-script.test.mjs` | Dated 18 October (with an outage and its recovery) | None |
| EN-12.3 | A commit with a secret is blocked by the hook and by CI | Implemented and verified | `scripts/hooks/secrets.mjs`; CI gitleaks; `scripts/security/scanner-fixtures.sh` (CI step "Every scanner blocks its fixture") | CI | Proven by a CI step, not a test title |

#### Authorisation, sessions, audit

| ID | Criterion | Status | Source and tests | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| SE-02.1 | Every route declares roles; an undeclared route fails | Implemented and verified | `src/auth/route-roles.spec.ts`; `auth.guard.ts` refuses undeclared routes (403) | CI, U; code read | None |
| SE-02.2 | Harness calls every endpoint as every role and anonymous against the matrix | Implemented and verified | `test/authz-matrix.int-spec.ts` (25 cases) | CI, I | Step 3 adds roles: the harness must grow with them |
| SE-02.3 | B reading A's note gets 404, and the denial is audited | Implemented and verified | `notes.repository.spec.ts`, `test/sample-notes.int-spec.ts`, `e2e/notes-flow.spec.ts` | CI, U, I, E2E | None |
| SE-07.1 | Access tokens at most 15 minutes; rotating refresh cookie `Secure`, `HttpOnly`, `SameSite=Strict` | Implemented and verified | `test/auth.int-spec.ts` | CI, I | None |
| SE-07.2 | Replayed refresh token revokes every session | Implemented and verified | `test/auth.int-spec.ts` | CI, I | None |
| SE-07.3 | Logout of all devices stops every refresh token | Implemented and verified | `test/auth.int-spec.ts`, `session.service.spec.ts`, `test/session-rotation.int-spec.ts` | CI, U, I | None |
| SE-07.4 | Test identity adapter refused outside `test` and `dev` | Implemented and verified | `src/auth/test-identity.adapter.spec.ts`; spec 007 adds the gate | CI, U; Live public test sign-in 404 | Scaffolding removed in Step 3 (FU-15) |
| SE-09.1 | Responses with Restricted data are `no-store` | Implemented and verified | `test/sample-notes.int-spec.ts` | CI, I | SMS and push text rules are Step 5 |
| SE-05.1 | Every Restricted read and write goes through the audit helper | Implemented and verified | `notes.repository.spec.ts`; spec 003 | CI, U | Admin actions are Step 3 |
| SE-05.2 | Entry fields and previous hash; no Restricted values | Implemented and verified | `src/audit/audit.service.spec.ts`, `test/audit-chain.int-spec.ts`, `test/sample-notes.int-spec.ts` | CI, U, I | S-3 hash input delimiter (FU-13) |
| SE-05.3 | Verifier reports the first broken link | Implemented and verified | `test/audit-chain.int-spec.ts` | CI, I; dated host check 25 October (chain intact, 35 entries) | `verify_chain()` is a full scan (P-2 note) |
| SE-05.4 | Audit table in its own schema; the app role may only append | Implemented and verified | `test/db-roles.int-spec.ts` | CI, I | None |

#### Middleware, scanning, logging, monitoring

| ID | Criterion | Status | Source and tests | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| SO-01.1 | Threat model section required in specs | Implemented and verified | `docs/specs/0000-template.md`, `scripts/check-specs.mjs`, `check-specs.test.mjs` | CI, S | Structure only, not content (constitution) |
| SO-03.1 | Static analysis, dependency, image and secret scans on every PR; a high finding fails | Implemented and verified | CI Semgrep, `pnpm audit`, Trivy, gitleaks; `scanner-fixtures.sh` | CI; real catches: GCM tag (Semgrep), Caddy CVEs (Trivy), body-parser and multer on 24 October (audit and Trivy) | `--ignore-unfixed` lets unfixed highs through (FU-24) |
| SO-05.1 | CSP without `unsafe-inline` scripts, HSTS, `X-Frame-Options`, `Referrer-Policy`, `nosniff` | Implemented and verified | `test/security.int-spec.ts`, `e2e/home.spec.ts`, `src/security/csp.test.ts`, `proxy.ts` | CI, I, U, E2E; Live headers | None |
| SO-05.2 | Unknown fields rejected with 400, no echo | Implemented and verified | `test/sample-notes.int-spec.ts` | CI, I | None |
| SO-08.1 | Over the limit per IP or user returns 429 | Implemented and verified | `test/security.int-spec.ts`; specs 002, 007 | CI, I | Per process (FU-25) |
| SO-08.2 | Caddy and API limits on; SQL injection sample gets 400 | Implemented and verified | `test/sample-notes.int-spec.ts`; Deploy bundle Caddy flood | CI, I | WAF at the pilot (FU-21) |
| SO-08.3 | Ten authorisation failures in five minutes raise an alert | Implemented and verified | `test/security.int-spec.ts` | CI, I; dated 24 October: published 1, delivered 1; received (owner, 25 October) | None |
| LM-01.1 | One correlation ID browser to API to database to logs | Implemented and verified | `e2e/notes-flow.spec.ts`, `test/tracing.int-spec.ts` | CI, I, E2E | Queue workers are Step 5 |
| LM-02.1 | Name, mobile number or Restricted field in a log call is masked | Partial | `packages/logger/src/index.ts` (`maskStrings` maps top-level values only, `:55`; redact paths `key` and `*.key`, `:64`); `packages/logger/src/index.test.ts` (5 tests, none nested) | CI, U; probe today: two-level key and nested string written in clear | Not met for nested input (review S-6). No current call site nests personal data. Fix through a spec with a three-level test (FU-27); Step 3 must not log mobile numbers or identity data before it |
| LM-02.2 | ESLint fails on `console.*` in app code | Implemented and verified | `apps/api/src/lint-rules.spec.ts`, `apps/web/src/lint-rules.test.ts` | CI, U | None |
| LM-03.1 | Front-end error recorded with source map, release, role, no identity | Implemented and verified (local); Accepted deferral (host) | `e2e/error-tracking.spec.ts`, `scripts/upload-source-maps.mjs` | Dated 18 October against local GlitchTip | No tracker on the dev host (ADR 0010, FU-22) |
| LM-04.1 | Web vitals per route and device class | Implemented and verified | `test/rum.int-spec.ts` | CI, I; dated 18 October on the dev host (device emulation) | Network type not recorded (not in the criterion) |
| LM-05.1 | Request rate, error rate, p50/p95/p99 on one dashboard; OpenTelemetry traces | Implemented and verified (local); Accepted deferral (host) | `deploy/observability/grafana`, `scripts/observability-dashboard.test.mjs` | Dated 18 October, local | ADR 0010 (FU-22) |
| LM-07.1 | Error rate over 5% for five minutes sends one alert to the topic | Implemented and verified | `src/observability/error-rate.monitor.spec.ts` | CI, U; dated 24 October: published 1, delivered 1; received (owner, 25 October) | One email address is the on-call route |

#### Internationalisation, design system, testing and performance, flags

| ID | Criterion | Status | Source and tests | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| I18N-01.1 | `/or`, `/en`, `/hi`; a new locale is a file and a config entry | Implemented and verified | `apps/web/e2e/home.spec.ts`, `src/i18n/messages.test.ts`, `packages/i18n/README.md` | CI, E2E, U | None |
| I18N-02.1 | Hard-coded JSX string or prop fails lint | Implemented and verified | `apps/web/src/lint-rules.test.ts` | CI, U | None |
| I18N-02.2 | ICU plurals | Implemented and verified | `packages/i18n/src/icu.test.ts`, `translator.test.ts` | CI, U | None |
| I18N-03.1 | ₹1,23,456.50 and dates per locale | Implemented and verified | `packages/i18n/src/format.test.ts` | CI, U | None |
| I18N-04.1 | Odia note survives save and read | Implemented and verified | `test/sample-notes.int-spec.ts`, `e2e/notes-flow.spec.ts` | CI, I, E2E | None |
| I18N-06.1 | Odia and Devanagari fonts subset; 140% text without overflow | Implemented and verified | `e2e/shell.spec.ts` | CI, E2E | None |
| I18N-07.1 | Missing key in any locale fails CI | Implemented and verified | `packages/i18n/src/catalogues.test.ts` | CI, U | Native review (FU-07) |
| UX-01.1 | Button, input, OTP field, card, sheet, table, toast, bottom navigation with stories | Implemented and verified | `packages/ui/src/*`, CI Storybook build | CI, U | None |
| UX-01.2 | Every story passes axe | Implemented and verified | `packages/ui/src/stories.test.tsx` and per-component tests | CI, U | axe cannot catch A-1 (announcement timing) |
| UX-02.1 | Layout tokens 360 to 599, 600 to 1023, 1024 and up | Implemented and verified | `packages/ui/src/tokens.test.ts` | CI, U | None |
| UX-03.1 | Bottom navigation in the thumb zone at 360 px | Implemented and verified | `e2e/shell.spec.ts` | CI, E2E | None |
| UX-04.1 | Loading, empty, error, offline state components | Implemented and verified | `States.tsx`, `States.test.tsx` | CI, U | None |
| UX-05.1 | OTP field `inputmode`, `autocomplete`, keeps input on error | Implemented and verified | `OtpField.test.tsx` | CI, U | Used for real in Step 3 |
| TS-01.1 | Under 80% changed-line coverage fails CI | Implemented and verified | `scripts/check-changed-coverage.mjs` and its test | CI, S | Next route files excluded |
| TS-02.1 | Every `@heach/ui` component has an axe test | Implemented and verified | `coverage-of-components.test.ts` | CI, U | Title does not name the ID |
| TS-03.1 | API integration tests on a real PostgreSQL in CI | Implemented and verified | CI job "API integration tests"; every endpoint covered (`test/rum.int-spec.ts` added 25 October) | CI (144 of 144), I (144 of 144) | Local dependency on `COMPOSE_PROJECT_NAME` (FU-17) |
| TS-05.1 | Playwright smoke on mobile, tablet, desktop on every PR | Implemented and verified | `playwright.config.ts`; CI E2E smoke | CI (9.3 minutes on `338943c`) | Chromium only; the full journey suite is later (TS-04) |
| TS-06.1 | Adapter interfaces and doubles; app imports interfaces only | Implemented and verified | `apps/api/src/adapters/*.port.ts`, `fakes.ts`, `fakes.spec.ts`, `lint-rules.spec.ts` | CI, U | Real adapters in Steps 3 and 5 |
| TS-07.1 | Visual snapshots of the shell in three locales | Implemented and verified | `e2e/shell.spec.ts` | CI, E2E | Baselines change after the Odia review (FU-07) |
| PF-02.1 | Over 170 KB gzipped initial JS fails CI | Implemented and verified | `e2e/bundle-budget.spec.ts`, `src/bundle-budget.test.ts` | CI, E2E, U | None |
| PF-03.1 | Lighthouse mobile under 90 fails CI | Implemented and verified | CI Lighthouse step | CI (9 runs on `338943c`) | Lab score, not field (PF-01) |
| PF-05.1 | Routes split; AVIF or WebP | Implemented and verified | `e2e/bundle-budget.spec.ts`, `src/next-config.test.ts` | CI, E2E, U | None |
| PF-07.1 | PWA installs, offline shell with banner, no API response cached | Implemented and verified | `e2e/pwa.spec.ts` | CI, E2E | None |
| FF-01.1 | Flags default off when unset; set per environment | Implemented and verified | `packages/flags/src/index.test.ts`, `test/sample-notes.int-spec.ts` | CI, U, I | None |

### Decisions and ADRs

| Item | Status | Evidence | Gap |
| --- | --- | --- | --- |
| D1 Backups in ap-south-1 plus an off-account copy | Implemented and verified | EN-10.3, EN-10.4; Live | Restricted fields need the AWS account (ADR 0012, FU-23) |
| D2 Parameter Store with rotation | Accepted deferral | EN-12.1, EN-12.2 | Revisit at the pilot (FU-21) |
| D3 WAF at the pilot | Accepted deferral | Rate limits and validation built | FU-21 |
| D4 Free, open-source, self-hosted dependencies | Implemented and verified | `@sentry/cli` rejected (FSL), replaced by `scripts/upload-source-maps.mjs` | None |
| D5 Alerts to `heach-credit-reminders` | Implemented and verified | Live: 1 confirmed, 0 pending; two synthetic alerts received (owner, 25 October) | One address |
| D6 Lawyer review is a Step 2 exit criterion | External review pending | Pack ready | FU-06 |
| ADR 0010 | Accepted and applied | Backups, Parameter Store, WAF deferral, local observability | Pilot revisits |
| ADR 0011 | Accepted | Specs 001 to 007 follow it; `check-specs` and Spec linked in CI | PA-1 to PA-4 undecided (FU-19) |
| ADR 0012 | Accepted 25 October 2026 | R2 reminder and R3 passphrase test recorded by the owner | R1 escrow before the pilot (FU-23) |

## Corrective feature specs 001 to 007

All 48 criteria have tests (traceability above) that passed in CI on `338943c` and in today's
local unit and integration runs.

| Spec | Criteria | Status | Code and tests | Deploy and live evidence | Success criteria | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| [001](../specs/001-session-refresh-reliability/spec.md) Session-refresh reliability | SE-07.5 to SE-07.13 | Implemented and verified; G4 accepted 25 October | #56; `apps/web/src/lib/api.test.ts`, `session.test.tsx`, `test/auth.int-spec.ts`, `e2e/session-refresh.spec.ts` | In every deploy since 21 October; client behaviour, not host-specific | SC-001 50 of 50 (dated 21 October); SC-002, SC-003 by tests | Web Locks missing before iOS 15.4; Chromium only |
| [002](../specs/002-rate-limit-bypass/spec.md) Rate-limit bypass | SO-08.4 to SO-08.11 | Implemented and verified; G4 accepted 25 October | #64; `user-throttler.guard.spec.ts`, `test/rate-limit.int-spec.ts` (21), `scripts/rate-limit-check.sh` | Deployed `7c8c1c9`, 22 October; behaviour proven in CI (Deploy bundle) | SC-001 to SC-003 by tests | In-memory counters (FU-25) |
| [003](../specs/003-transactional-audit-writes/spec.md) Transactional audit writes | SE-05.5 to SE-05.10 | Implemented and verified; G4 accepted 25 October | #67; `transaction.spec.ts`, `test/audit-transaction.int-spec.ts` | Deployed `1d74b17`, 22 October | SC-001 to SC-003 by repeated integration tests | Step 3 repositories must reuse `withTransaction` |
| [004](../specs/004-transactional-session-rotation/spec.md) Transactional session rotation | SE-07.14 to SE-07.20 | Implemented and verified; G4 accepted 25 October | #69; `session.service.spec.ts`, `auth.controller.spec.ts`, `test/session-rotation.int-spec.ts` | Deployed `468c7f1`, 23 October | SC-001, SC-002 by 50-repeat tests; SC-003 latency recorded in its tasks | A lost refresh response still signs out (no grace window, owner decision) |
| [005](../specs/005-bounded-reencryption/spec.md) Bounded re-encryption | EN-05.4 to EN-05.9 | Implemented and verified; G4 accepted 25 October | #70; `reencrypt.spec.ts`, `test/reencrypt.int-spec.ts` | Deployed `491f5a0`; dated host run 24 October without `--rotate` (exit 0, nothing to move) | SC-001 to SC-003 by tests | No rotation has run on dev (FU-26) |
| [006](../specs/006-recurring-restore-check/spec.md) Recurring restore check | EN-10.5 to EN-10.10 | Scheduled observation pending (criteria implemented and verified) | #80; `src/jobs/restore-check.spec.ts` (9), `test/restore-check.int-spec.ts` (16, I with the matching compose project), `scripts/restore-check.test.mjs`, `deploy-script.test.mjs` | Deployed `a2cbf6f`, now `338943c`; Live: timer enabled, never fired, next 1 November; files match `main`. Dated hand run (T017) 25 October passed in 6 s; synthetic failure alert received by the owner | SC-002 and SC-004 met (tests; 6 s on the host); SC-003 met by the test of three killed runs (the spec's "10 runs" is not counted literally); **SC-001 open**: four consecutive scheduled weekly runs | FU-01 to FU-05. A run that never starts sends no alert: each Sunday needs a person to check |
| [007](../specs/007-security-review-fixes/spec.md) Security review fixes | SO-08.12, SE-07.21 to SE-07.23, EN-12.4, SO-03.2 | Implemented and verified; G4 accepted 25 October | #74; unit, integration and Deploy bundle checks | Owner applied infra 24 October; deployed `8b0387f`; dated live checks 24 and 25 October; Live today: hop limit 1, public test sign-in 404, `tofu plan` no changes | SC-001 to SC-004 by tests and CI (full `pnpm audit` clean on `338943c`) | None open |

All seven specs show every task ticked; their spec files say Approved and the
[specs index](specs/README.md) carries Done (G4) for all but 006, which is consistent with the spec
workflow. The owner's G4 acceptances are recorded in the index and the matrix, written by Claude
Code from the owner's messages; the GitHub record cannot show who acted (FU-14).

## Findings beyond the existing records

1. **Rollback has never worked.** Step 1 status and review describe a rollback to the previous
   tag; all 11 executions failed and none has succeeded (FU-12).
2. **A red PR was merged.** #75 (docs) merged with two failing checks while `main` was red from new
   advisories. Harmless in effect (docs only; #74 fixed the cause within 30 minutes), but against
   constitution VII. Nothing technical prevents it (FU-10).
3. **Owner and agent share one GitHub account.** Approvals and merges cannot be attributed (FU-14).
4. **The guideline's step-end real-phone demo is tracked nowhere** and has no record for Step 1 or
   Step 2 (FU-08).
5. **Partner applications have not moved** since they were filed as issues on 17 October (FU-09);
   the Step 1 exit row said "submitting them is the account holder's task" without a date.
6. **Seven findings of the 18 October review are still in the code and in no tracker** (S-3, S-4,
   S-5, S-6, C-3, A-1, P-2; documentation gap 15; FU-13). S-6 means LM-02.1 is not met for nested
   input, which the matrix had as Met: proven with synthetic values today (FU-27).
7. **Local integration tests can hit the wrong stack** when `COMPOSE_PROJECT_NAME` is unset
   (FU-17). The spec 006 evidence was gathered with it set; the local development guide does not
   mention it.
8. **Stale statements corrected in this change:** the Step 1 credit-alert exit row (subscription
   "contradictory", receipt "never confirmed"), the Step 1 package row (`crypto` "interface only"),
   the EN-07 row ("Step 2 onward", though uploads are Step 3 work under PO-04 and were out of Step 2
   by design), and the rollback note on Step 1 item 9.
9. **Classification of later-step gaps is otherwise correct.** The matrix's "Requirement counts
   and later steps" table assigns each Partial requirement's remaining gap to the right step or the
   pilot, and EN-10 and I18N-07 are correctly marked as Step 2 gaps. It misses one: LM-02 (nested
   masking) is counted Done but belongs to Step 2 as a gap (corrected: Partial, FU-27). The module
   counts on the status page added up before this change (EN 3+9+1, SE 1+4+4, SO 2+5+3, PF 4+2+1,
   I18N 5+1+1, TS 4+3+2, LM 1+6+2, UX 5+0+3, PR 0+2+5) and matched the Partial table; LM is now
   0+7+2.

## Step 3 readiness

**Verdict: ready with documented carry-forward items.**

The foundation Step 3 builds on is in place and verified: field encryption with per-domain keys
and blind indexes, transactional audited writes, sessions with rotation and replay handling,
deny-by-default route guards with the authorisation harness, rate limits counted by address and
user, adapters with test doubles for SMS and identity, the OTP field component, the i18n pipeline,
the security gates, and backups with a deployed recurring check.

Conditions and carry-forward items:

1. **Step 3 code waits for its spec** (constitution I): a Step 3 charter
   (`docs/specs/step-03-*.md`) and feature specs, approved and merged, with the inputs listed in
   FU-15. Drafting the charter can start now.
2. **Step 2 stays open in parallel.** The guideline runs steps in order and the lawyer review is a
   Step 2 exit criterion. Starting Step 3 code before FU-01 to FU-08 and FU-27 close is an exception to that
   gate, which the owner accepts in writing (constitution VIII), naming the open items and that
   they close by their own triggers. Without that, Step 3 is limited to specification.
3. **Identity verification slices (KY) and consent capture (PR-01)** wait for the lawyer's advice on
   the Aadhaar route and consent wording (FU-06) and a chosen partner (FU-09). Sign-in, roles,
   linked patients, the onboarding framework and the admin shell do not.
4. **Before Step 3 handles mobile numbers or identity data:** fix log masking depth (LM-02.1,
   S-6; FU-27), which is also a Step 2 closure item, and triage the other 18 October findings
   (FU-13); keep data synthetic (SO-07).
5. **Step 3 must build, not inherit:** encrypted, virus-scanned uploads (PO-04, EN-07), SE-08
   throttling, admin MFA (AD-01, SE-04), and the removal of the Step 2 sample scaffolding (FU-15).
6. **Operational:** prove the rollback (FU-12); decide branch protection (FU-10) and approval
   provenance (FU-14) before Step 3 merges start; submit the partner applications now, because
   their lead time decides when Step 3 can exit (FU-09).

The only Step 2 engineering gap (LM-02.1 nested masking) is small and has no live exposure today;
it is fixed before, not after, Step 3 introduces personal data. The
verdict would be "not ready" only if Step 3 code started without an approved Step 3 spec, or
before the owner accepts in writing that it runs alongside the open Step 2 items.
