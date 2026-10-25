# Step 2 progress and acceptance evidence

Working log for [the Step 2 spec](specs/step-02-secure-foundation.md). The criterion-by-criterion verdict is in the [acceptance matrix](step-2-acceptance-matrix.md). It records evidence for each
criterion and what is left, so work can resume after an interruption. Owner approvals for this
step (18 October 2026): merge green PRs; self-apply additive dev infra up to US$5 a month;
observability containers local only (ADR 0010); off-account backup copy to the owner's computer.

## PR plan

| # | Branch | Scope | Status |
| --- | --- | --- | --- |
| 1 | docs/adr-0010-step2-security-decisions | ADR 0010, this log | Merged #34 |
| 2 | feat/step2-crypto | `@heach/crypto` envelope encryption, blind indexes | Merged #35 |
| 3 | feat/step2-db-tls-migrations | Data TLS, roles, audit schema, migrations, KMS adapter, SSM secrets, DC check | Merged #36; dev deploy waits for infra apply |
| 4 | feat/step2-auth-audit-notes | Sessions, roles guard, audit helper, sample notes, headers, rate limits, alerts, flags, re-encryption | Merged #37 |
| 5 | feat/step2-observability | Logger context and masking, OpenTelemetry, Collector and Jaeger, error-rate alert, web-vitals endpoint | Merged #38 |
| 6 | feat/step2-web-i18n | ICU catalogues, locale routes, fonts, page CSP, hard-coded string lint as error | Merged #39 |
| 7 | feat/step2-ui-kit | Tokens, accessible components, Storybook, axe on every component and story | Merged #40 |
| 8 | feat/step2-web-shell | Shell, PWA, sample-note UI, RUM, error tracking, E2E projects, visual baselines, budgets, Lighthouse | Merged #41 |
| 9 | feat/step2-quality-gates | GCM tag-length fix (found by Semgrep), Semgrep and Trivy in CI with runtime fixtures per scanner, npm removed from runtime images, patched Caddy, changed-line coverage gate, adapter ports and doubles with lint boundary | Merged #42 |
| 10 | feat/step2-backups | Backup KMS key and bucket, nightly dump timer, off-account pull script, restore check, infra security check, state bucket to SSE-KMS, spec threat-model check | Merged #43; infra apply pending AWS sign-in |
| 11 | feat/step2-approved-additions | Caddy rate limit (SO-08.2), local Prometheus, Grafana and GlitchTip profile with the LM-05.1 dashboard, source-map upload script and LM-03.1 test, CSP fix for error reports | Merged #45 |
| 12 | fix/security-review-2026-10-24 | Spec 007: address plus user rate limits, loopback-only test sign-in with a key, device sign-out revokes the family, API IAM role and hop limit 1, full dependency audit | Merged #74; infra applied and deployed 24 October; live-verified 24 October |

## Evidence by criterion

Statuses: ⬜ not started, 🟡 in progress, ✅ proven, 🧑 owner action.

| ID | Status | Evidence |
| --- | --- | --- |
| EN-01.1 | ✅ | `test/data-tls.int-spec.ts`; CI deploy-bundle step refuses plaintext |
| EN-01.3 | ✅ | Live on 2026-10-18 against the dev host (`openssl s_client`, OpenSSL 3.6.4): TLS 1.0 and 1.1 refused with `alert protocol version`; TLS 1.2 negotiates ECDHE-ECDSA-AES128-GCM-SHA256; the default negotiates TLSv1.3 (TLS_AES_128_GCM_SHA256) |
| EN-03.2, EN-04.1, EN-05.1, EN-06.1, EN-09.1 | ✅ | `packages/crypto/src/*.test.ts`, `kms-key-provider.spec.ts` |
| EN-10.1 | ✅ | CI runs bootstrap and migrations on an empty database; `db-roles.int-spec.ts` |
| EN-10.2, SE-05.4 | ✅ | `db-roles.int-spec.ts` |
| SE-05.2, SE-05.3 | ✅ (SQL) | `audit-chain.int-spec.ts`; API helper in PR 4 |
| DC-01.1, DC-01.2 | ✅ | `classification.int-spec.ts` fixture; CI `db:check-classes` |
| EN-12.1 | ✅ | `load-secrets.spec.ts`. Live on 2026-10-18 at tag `16d9b037834e`: with `SECRETS_SOURCE=ssm`, every secret variable in the API container is empty and the image environment has none, yet `/api/readyz` answers postgres ok and redis ok, so the secrets came from Parameter Store by name |
| EN-04.2 | ✅ | `scripts/check-infra-security.mjs` in CI. Live on 2026-10-18: the `heach-dev-host` policy allows only `kms:GenerateDataKey` and `kms:Decrypt` on the five `alias/heach-dev-*` keys. `iam simulate-principal-policy` gives implicit deny for Encrypt, ReEncryptFrom, CreateGrant, ScheduleKeyDeletion, PutKeyPolicy and for any other key. The keys are AWS_KMS origin, customer-managed, single-Region, with rotation on |
| EN-03.1, EN-13.1, I18N-04.1 | ✅ | `test/sample-notes.int-spec.ts` (ciphertext in DB, not in logs, not in another user's response; Odia round trip) |
| EN-05.3 | ✅ | `test/crypto.int-spec.ts`; [runbook](runbooks/key-rotation.md) |
| EN-09.2 | ✅ | `test/crypto.int-spec.ts` (fixture table; real searchable fields arrive in Step 3) |
| EN-12.2 | ✅ | Run once in dev on 2026-10-18 and recorded in the [runbook](runbooks/secret-rotation.md), including a short outage and its recovery; `deploy.sh` now restarts the API after bootstrap (`scripts/deploy-script.test.mjs`) |
| SE-02.1 | ✅ | `src/auth/route-roles.spec.ts`; the guard also refuses undeclared routes |
| SE-02.2 | ✅ | `test/authz-matrix.int-spec.ts` (25 cases) |
| SE-02.3, SE-05.1, SE-05.2 | ✅ | `notes.repository.spec.ts`, `sample-notes.int-spec.ts` |
| SE-07.1 to SE-07.3 | ✅ | `test/auth.int-spec.ts` |
| SE-07.4 | ✅ | `test-identity.adapter.spec.ts`; `AuthModule.register` throws at start-up |
| SE-09.1 | ✅ | `sample-notes.int-spec.ts` |
| SO-05.1, EN-01.2 | ✅ | `test/security.int-spec.ts` (helmet; Caddy also sets HSTS) |
| SO-05.2 | ✅ | `sample-notes.int-spec.ts` (generic 400, no echo) |
| SO-08.1 | ✅ | `test/security.int-spec.ts` (@nestjs/throttler, per token or IP) |
| SO-08.2 | ✅ | SQL injection sample → 400 (`security.int-spec.ts`). Caddy: `caddy-ratelimit` zone of 300 requests a minute per client IP on `/api/*`; the CI deploy-bundle job floods `/api/healthz` (which the API throttler skips) and requires 429s from Caddy while pages still answer 200. Local record 18 October: 20-event test zone gave 20 × 200 then 429 with `Retry-After: 60` |
| SO-08.3 | ✅ published, SNS delivered, received | `test/security.int-spec.ts`. Live on 2026-10-18 at 10:17:21 UTC: published only (subscription then PendingConfirmation). **24 October 2026:** subscription checked in AWS: one email subscription, `SubscriptionsConfirmed` 1, pending 0. At 16:06:22 UTC synthetic user `00000000-0000-4000-8000-000000000003` made 11 role-denied requests (403) over HTTPS through the public entry; the deployed API (`8b0387f`), now on the API role, published one alert ("HEACH: repeated authorisation failures", body names that synthetic user). CloudWatch for 16:06 UTC: `NumberOfMessagesPublished` 1, `NumberOfNotificationsDelivered` 1, `NumberOfNotificationsFailed` 0. Delivered means SNS handed it to the mail system. **Received:** the owner confirmed on 25 October 2026 (in a Claude Code session) that this alert arrived in the intended inbox |
| LM-01.1 | ✅ | Browser: every app API call carries an `x-correlation-id` (`apps/web/e2e/notes-flow.spec.ts`); API to DB to logs: `test/tracing.int-spec.ts` |
| LM-02.1 | 🟡 | `packages/logger/src/index.test.ts` covers top-level values and keys one level down. **25 October 2026 (audit):** a synthetic probe against the built logger wrote a mobile number in clear at `req.query.phone` and inside a nested string (review S-6); no current call site logs nested personal data. Open until a spec and fix land ([FU-27](follow-up-register.md#closes-step-2)) |
| LM-02.2 | ✅ | `apps/api/src/lint-rules.spec.ts` |
| LM-04.1 | ✅ | Local record, plus dev host on 2026-10-18: Pixel 7 and Desktop Chrome visited `/or`, `/en/notes` and `/hi/sign-in` on https://15.252.65.98. The API logged CLS, FCP, INP, LCP and TTFB for each of `/[locale]`, `/[locale]/notes` and `/[locale]/sign-in` × mobile and desktop. Lines carry only vital, value, route template, device class and a random request correlation ID |
| LM-05.1 | ✅ (local dashboard, ADR 0010) | Traces in OpenTelemetry and Jaeger. Grafana dashboard `HEACH API (LM-05.1)` (provisioned, `deploy/observability/grafana`) over Prometheus: request rate, 5xx share, p50/p95/p99. Record 18 October, local API: 37.6 requests/s, p50 2.5 ms, p95 4.8 ms, p99 5.0 ms; synthetic outage (PostgreSQL stopped, `/readyz` 503) showed 18 % 5xx share. `scripts/observability-dashboard.test.mjs` keeps the three panels. Local only (ADR 0010) |
| LM-07.1 | ✅ published, SNS delivered, received | `error-rate.monitor.spec.ts`. Live on 2026-10-18 at 10:17:51 UTC: the API's own `ErrorRateMonitor` and `SnsAlertPublisher` ran in a one-off API container on the host (host role, real topic) with the subject `[SYNTHETIC TEST LM-07.1]`. A 10 percent rate sent 1 alert; a second evaluation sent none. The request path into the monitor is covered by the spec, not live. One more message was published at 10:11 UTC, during the rotation outage, probably a genuine alert; nothing was delivered, so its content is unconfirmed. Delivery waits on the subscription. **24 October 2026, 16:05:22 UTC:** the same method in a one-off API container on the API role (`8b0387f`), subject `[SYNTHETIC TEST LM-07.1] HEACH: API error rate above 5 percent`, body prefixed "Synthetic test, no action needed": a 10 percent rate over 100 requests sent one alert, a second evaluation none. CloudWatch for 16:05 UTC: published 1, delivered 1, failed 0. **Received:** the owner confirmed on 25 October 2026 that this alert arrived in the intended inbox |
| I18N-01.1 | ✅ | `apps/web/e2e/home.spec.ts` (/or, /en, /hi; redirect); `packages/i18n/README.md` (new locale = file + two entries) |
| I18N-02.1 | ✅ | `apps/web/src/lint-rules.test.ts` (JSX text and `alt` fail at error level) |
| I18N-02.2 | ✅ | `packages/i18n/src/icu.test.ts`, `translator.test.ts` |
| I18N-03.1 | ✅ | `packages/i18n/src/format.test.ts` |
| I18N-07.1 | ✅ | `packages/i18n/src/catalogues.test.ts` (real catalogues and failing fixture) |
| SO-05.1 (pages) | ✅ | `apps/web/e2e/home.spec.ts`, `src/security/csp.test.ts` (nonce CSP from `proxy.ts`) |
| UX-01.1 | ✅ | Button, TextField, OtpField, Card, Sheet, Table, Toast, BottomNav (+ states) with stories; CI builds Storybook |
| UX-01.2 | ✅ | `packages/ui/src/stories.test.tsx`: every story rendered and checked with axe (contrast checked in browser by Lighthouse) |
| UX-02.1 | ✅ | `packages/ui/src/tokens.test.ts` |
| UX-04.1 | ✅ | `States.tsx` stories and `States.test.tsx` |
| UX-05.1 | ✅ | `OtpField.test.tsx` |
| TS-02.1 | ✅ | `coverage-of-components.test.ts` fails when a component lacks an axe test |
| EN-13.1 (end to end) | ✅ | `e2e/notes-flow.spec.ts` on mobile, tablet, desktop against web + API + PostgreSQL (local run: pass); CI deploy bundle on main: 24 passed, [run 39116519674](https://github.com/themechanicalguy/heach/actions/runs/39116519674). CI runs it against the deploy bundle behind Caddy and checks ciphertext, audit and logs in SQL |
| PF-07.1 | ✅ | `e2e/pwa.spec.ts`: manifest, service worker, offline shell with banner, no `/api` entry in any cache |
| TS-05.1 | ✅ | `playwright.config.ts`: mobile 360, tablet 768, desktop 1280 projects on every PR |
| TS-07.1 | ✅ | `e2e/shell.spec.ts` with Linux baselines for or, en, hi on each project |
| UX-03.1 | ✅ | `e2e/shell.spec.ts`: nav bottom edge equals viewport bottom at 360 px, plus baseline |
| I18N-06.1 | ✅ | `e2e/shell.spec.ts`: self-hosted, unicode-range subset faces cover Odia and Devanagari; 140 percent text has no overflow |
| PF-02.1 | ✅ | `e2e/bundle-budget.spec.ts` (largest entry about 143 KB gzipped of 170 KB), fixture `src/bundle-budget.test.ts` |
| PF-03.1 | ✅ local | Lighthouse CI mobile: or 97 to 98, en 99, hi 99 (local, 3 runs each); CI step asserts at least 90 |
| PF-05.1 | ✅ | `e2e/bundle-budget.spec.ts` (route-specific chunks), `src/next-config.test.ts` (AVIF, WebP) |
| LM-03.1 | ✅ (local GlitchTip, ADR 0010) | `e2e/error-tracking.spec.ts` against local GlitchTip 6.2.6, release `lm03-ddde2d6-1792296475`: a labelled synthetic error thrown in `OfflineStatus` arrived with frames mapped to `apps/web/src/components/OfflineStatus.tsx:21`, tags `release` and `role=anonymous`, `user`, cookies, headers and query empty. Maps uploaded by `scripts/upload-source-maps.mjs` and deleted; CI checks the web image has no `.map`. Found and fixed: the page CSP blocked reports to the GlitchTip origin. [Runbook](runbooks/error-tracking.md) |
| SO-03.1 | ✅ | CI: Semgrep CE (registry packs plus `security/semgrep/heach.yml`), `pnpm audit` high, Trivy on web/admin/api images, gitleaks; `scripts/security/scanner-fixtures.sh` proves each blocks a planted high finding (local run: all four block) |
| EN-12.3 | ✅ | Pre-commit gitleaks hook (existing) and CI; fixture: generated token blocked by gitleaks |
| SO-03.1 finding | ✅ | The container scan found critical and high CVEs in Caddy 2.10.2 (admin image and the internet-facing edge proxy). Caddy 2.11.6 is now rebuilt from source with patched Go and x/net in `apps/admin/Dockerfile`; the edge proxy runs that image. Trivy: clean |
| EN-03.2 (hardened) | ✅ | Semgrep found GCM decryption without a fixed tag length; fixed, `envelope.test.ts` rejects a truncated tag |
| TS-01.1 | ✅ | `scripts/check-changed-coverage.mjs` in CI (unit plus API integration lcov); fixture test fails at 50 percent. Next route files are excluded because only Playwright runs them |
| TS-03.1 | ✅ | CI job "API integration tests" on real PostgreSQL and Redis over TLS, bootstrap and migrations from an empty database (`.github/workflows/ci.yml`). On `main` (CI [run 40112285216](https://github.com/themechanicalguy/heach/actions/runs/40112285216), 24 October 2026): 17 files, 120 of 120 passed. Recorded late: the row was missing from this log until 24 October. **25 October 2026:** `test/rum.int-spec.ts` (8 cases) covers `POST /v1/rum`, the one endpoint without an integration test; every API endpoint now has one |
| TS-06.1 | ✅ | `apps/api/src/adapters/*.port.ts` and `fakes.ts`; lint boundary proven in `lint-rules.spec.ts` |
| EN-02.1 | ✅ code | `scripts/check-infra-security.mjs` in CI with fixtures; it found the state bucket on SSE-S3, now SSE-KMS in code (bootstrap apply is an owner action) |
| EN-05.2 | ✅ | Same check: every `aws_kms_key` has yearly rotation |
| EN-04.2 | ✅ | `scripts/check-infra-security.mjs` in CI. Live on 2026-10-18: the `heach-dev-host` policy allows only `kms:GenerateDataKey` and `kms:Decrypt` on the five `alias/heach-dev-*` keys. `iam simulate-principal-policy` gives implicit deny for Encrypt, ReEncryptFrom, CreateGrant, ScheduleKeyDeletion, PutKeyPolicy and for any other key. The keys are AWS_KMS origin, customer-managed, single-Region, with rotation on |
| EN-10.3 | ✅ | Live on 2026-10-18. `pg/2026-10-18T1018Z.dump` and `…1019Z.dump` are in private bucket `heach-dev-backups-667291759252` (ap-south-1, all four public-access blocks on), SSE-KMS with the backup key `alias/heach-dev-backup`. The host timer fires at 21:00 UTC (02:30 IST). The off-account copy is in `~/HEACH-backups` on the owner's Mac: AES-256 with a Keychain passphrase, mode 600, SHA-256 verified. Decrypted without AWS, it is byte-identical to the S3 object. **24 October 2026:** nightly dumps present for every night 18 to 23 October; a dump run at 16:09 UTC under the host role as narrowed by spec 007 wrote `pg/2026-10-24T1609Z.dump` (SSE-KMS, backup key); `scripts/backup-pull.sh` copied it off-account, `shasum -c` OK, decrypted copy identical to the S3 object (SHA-256 prefix `9813ed2e5d478b57`). Gaps: Restricted fields need the dev KMS keys and the weekly pull is manual ([ADR 0012](adr/0012-off-account-recovery-of-restricted-fields.md), proposed) |
| EN-10.4 | ✅ | Local record and dev-host record in the [runbook](runbooks/backup-restore.md). On 2026-10-18 `…1019Z.dump` was restored into a new database `heach_restore_1792318811` on the host: 1 synthetic note, stored as AES-256-GCM ciphertext. A separate API container decrypted it through KMS for its owner. The database was then dropped; the active `heach` database was never written. **Re-proven 24 October 2026 after spec 007** ([record](runbooks/backup-restore.md#restore-records)): `pg/2026-10-24T1609Z.dump` restored into `heach_restore_1792858593`, audit chain intact, 2 of 2 bodies ciphertext, a one-off API container on the API role decrypted the synthetic owner's note; live counts unchanged, throwaway database dropped. Recurring check: spec 006 (below) |
| SO-01.1 | ✅ | `docs/specs/0000-template.md` has the section; `scripts/check-specs.mjs` in CI fails a step spec without threats (fixtures in `check-specs.test.mjs`) |
| FF-01.1 | ✅ | `feature-flags.spec.ts`, flag-off test in `sample-notes.int-spec.ts` |
| EN-10.5 to EN-10.10 (spec 006) | ✅ CI, deployed, first host run passed; 🟡 SC-001 four weekly runs pending | Approved 25 October (amended the same day with the owner's approval). Merged #80, deployed `a2cbf6f` 25 October; host run by hand passed and a synthetic failure alert was published, delivered and received (owner, 25 October) ([records](runbooks/backup-restore.md#weekly-restore-check-records-sc-001)). Tests: `restore-check.spec.ts` (9), `test/restore-check.int-spec.ts` (16, real dump and restore through the host script), `scripts/restore-check.test.mjs` and the deploy timer test ([evidence](../specs/006-recurring-restore-check/tasks.md#evidence)). Re-checked on the host 25 October 2026 07:31 UTC, on `952f350`: the timer is enabled and active with `Persistent=yes`, next run Sunday 1 November 00:00 UTC; the host's restore files match `main` byte for byte; no `heach_restorecheck_*` database is left; the live audit log holds exactly one `backup.restore_check` entry and its chain is intact. Open: four consecutive scheduled Sunday runs, 1, 8, 15 and 22 November 2026, each recorded in the [runbook](runbooks/backup-restore.md#weekly-restore-check-records-sc-001), then the owner's G4 review |
| SE-05.5 to SE-05.10 (spec 003) | ✅ Done: owner accepted (G4) 25 October 2026 | Merged #67. `transaction.spec.ts`, `notes.repository.spec.ts`, `test/audit-transaction.int-spec.ts`; fresh local run 24 October on `491f5a0`: all passing ([evidence](../specs/003-transactional-audit-writes/tasks.md#evidence)) |
| SE-07.14 to SE-07.20 (spec 004) | ✅ Done: owner accepted (G4) 25 October 2026 | Merged #69. `session.service.spec.ts`, `auth.controller.spec.ts`, `test/session-rotation.int-spec.ts`; session E2E (`session-refresh.spec.ts`) on three viewports in the CI deploy-bundle job on `491f5a0` (30 passed); fresh local integration run 24 October: all passing ([evidence](../specs/004-transactional-session-rotation/tasks.md#evidence)) |
| EN-05.4 to EN-05.9 (spec 005) | ✅ Done: owner accepted (G4) 25 October 2026 | Merged #70. `reencrypt.spec.ts`, `test/reencrypt.int-spec.ts`; fresh local run 24 October: all passing ([evidence](../specs/005-bounded-reencryption/tasks.md#evidence)). Run once on the dev host 24 October without `--rotate`: exit 0, nothing to re-encrypt (all values on version 1); a rotation on dev is the owner's call ([record](runbooks/key-rotation.md#record)) |
| SO-08.12, SE-07.21 to SE-07.23, EN-12.4, SO-03.2 (spec 007) | ✅ Done: owner accepted (G4) 25 October 2026; live re-verified on `a2cbf6f` 25 October | Merged #74 (`8b0387f`), CI green including the deploy-bundle checks (public test sign-in 404, loopback 200). Owner applied the infra 24 October (4 added, 2 changed in place, $0); Deploy dev attempt 2 green. Live on 24 October: `tofu plan` no changes; API role reads exactly its four parameters, admin and migrator passwords denied, IMDS unreachable from containers (hop limit 1); public test sign-in 404 from the internet and on the host, loopback entry 200 ([live verification](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24)) |

## Exit criteria (guideline Step 2), checked 25 October 2026

| Exit criterion | Evidence | State |
| --- | --- | --- |
| A sample note travels end to end: Odia on a phone, field-encrypted, owner only, audited | EN-13.1 (end to end), EN-03.1, SE-02.3, I18N-04.1 above; deploy-bundle E2E on three viewports | Met (code, CI) |
| A test proves the note is ciphertext in the database and absent from logs | `sample-notes.int-spec.ts`, deploy-bundle SQL and log checks | Met (code, CI) |
| A PR with a hard-coded string, missing translation, accessibility violation, oversized bundle or leaked secret is blocked | I18N-02.1, I18N-07.1, TS-02.1 and UX-01.2, PF-02.1, EN-12.3 fixtures | Met (CI) |
| Traces show one correlation ID from browser to database | LM-01.1 | Met (code, CI; local Jaeger, ADR 0010) |
| The lawyer's first review of consent wording and the Aadhaar route is in hand | [Review pack](reviews/lawyer-review-step-2.md) ready; not sent | **Not met: owner (D6)** |

The Step 2 spec also requires the native Odia review (I18N-07, not met: owner) and spec 006's four
weekly runs (SC-001, 1 to 22 November 2026). Alert inbox receipt, ADR 0012 and G4 for specs 001 to
005 and 007 were closed by the owner on 25 October 2026. The [audit](step-1-2-audit.md) of
25 October 2026 added two items: LM-02.1 is Partial (nested masking) and the guideline's step-end
demo on a real phone is not recorded; the first exit row above is proven in device emulation only.
Step 2 is **not complete**; the [acceptance matrix](step-2-acceptance-matrix.md#closing-step-2)
lists what closes it.

## Deploy and rollback record

- 18 October 2026, [Deploy dev run 39097648102](https://github.com/themechanicalguy/heach/actions/runs/39097648102) for `e1da8b2`: stopped at the host preflight ("Parameter /heach/dev/DB_APP_PASSWORD is missing … Nothing changed"), because the dev apply was not yet done. The rollback then ran and stopped at the same preflight. Defect: a preflight failure changes nothing, so rolling back is pointless and hides the cause. Fixed in `deploy-dev.yml`: the rollback is skipped only when the host reports "Nothing changed"; the run still fails. Dev kept serving its previous version.
- 18 October 2026: main CI [run 39099363168](https://github.com/themechanicalguy/heach/actions/runs/39099363168) failed LM-01.1 because the mobile mask rewrote a trace ID that contained ten digits in a row. Fixed in #48: whole hex trace, span and UUID IDs are kept, everything else is still masked, and a regression test was added. That red CI skipped Deploy dev [run 39099959504](https://github.com/themechanicalguy/heach/actions/runs/39099959504).
- 18 October 2026: `infra/envs/dev` applied (15 added, 1 changed: SSM parameters, backup key and bucket, host policy) and `infra/bootstrap` applied (state bucket to SSE-KMS).
- 18 October 2026, [Deploy dev run 39112202449](https://github.com/themechanicalguy/heach/actions/runs/39112202449) for `65cb9d0`: image build and scan gate passed and the preflight passed now that the parameters exist. Then Redis failed: "Failed to load certificate: /certs/server.crt: Permission denied". The host's `certs/` directory is root-only (700), and the Redis wrapper copied only the key. CI passed because its certificate directory was world-readable. The rollback then failed because `heach/admin:fa191982f4ad` had expired from ECR. The web, API and admin apps kept serving `fa191982f4ad`; only Redis was down. Fixes:
  - Redis now copies its certificate and CA as well, the same way the PostgreSQL wrapper does.
  - CI makes its certificate directory root-only, the same as the host. Locally the old wrapper failed with the host's error and the new one answered `PONG` over TLS.
  - Deploy dev uses the previous tag as a rollback target only if all three images still exist in the registry, and warns otherwise.
- 18 October 2026, [Deploy dev run 39114431672](https://github.com/themechanicalguy/heach/actions/runs/39114431672): the rollback guard worked ("heach/web:fa191982f4ad is no longer in the registry; no rollback target"). Redis was still crash-looping on the old wrapper when the deploy checked it, and came up healthy on its next restart. [Run 39115637234](https://github.com/themechanicalguy/heach/actions/runs/39115637234): bootstrap failed with `AccessDeniedException … ssm:GetParametersByPath on parameter/heach/dev`. The host policy grants `parameter/heach/dev/*`, but a by-path read is authorised on the path itself. Fixed in code: the loader asks `GetParameters` for the wanted names only and fails start-up if any is missing. That is also least privilege per process. The policy needed no change. Follow-up (owner, permission change): drop the now-unused `ssm:GetParametersByPath` from the host policy.

- 18 October 2026, rotation: see the [secret-rotation runbook](runbooks/secret-rotation.md) record; fixed in #51.
- 18 October 2026: Deploy dev [run 39117175524](https://github.com/themechanicalguy/heach/actions/runs/39117175524) for `16d9b03` is green: image build, scan gate, deploy and smoke test passed, no rollback. After #51, the next deploy also recreates the API.

- 24 October 2026, [Deploy dev run 40095340473](https://github.com/themechanicalguy/heach/actions/runs/40095340473) for `8b0387f` (#74, spec 007), attempt 1 at 12:53 UTC: stopped at the preflight, "Parameter /heach/dev/TEST_LOGIN_KEY is missing: apply infra/envs/dev first. Nothing changed."; no rollback, the previous version kept serving (the designed rollout). The owner applied `infra/envs/dev` at 15:25 UTC (API role and policy, test sign-in key and parameter; host policy and metadata hop limit changed in place). Attempt 2 at 15:26 UTC: green, deploy and smoke test passed. Live checks afterwards are in the [security review](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24).
- 24 October 2026: CI on `main` red for `36e82ac` (#72) and `525e9cf` (#75, merged with both checks failing): the dependency audit and Trivy caught newly published highs in body-parser and multer. Deploy dev was skipped both times; #74 (`8b0387f`, 12:37 UTC) fixed them. Recorded by the audit of 25 October.
- 17 and 18 October 2026, rollback: the "Roll back to the previous tag" step ran 11 times and failed every time (expired ECR tags, preflight stops, the rotation outage). It has not run since, and has never succeeded ([FU-12](follow-up-register.md#step-1-items-still-open)).
- 22 and 23 October 2026: Deploy dev green for spec 003 `1d74b17` ([run 39838278055](https://github.com/themechanicalguy/heach/actions/runs/39838278055)), spec 004 `468c7f1` ([run 39910289211](https://github.com/themechanicalguy/heach/actions/runs/39910289211)) and spec 005 `491f5a0` ([run 39915546133](https://github.com/themechanicalguy/heach/actions/runs/39915546133)): deploy and smoke test of `/healthz` and `/api/readyz` passed, no rollback. The smoke test checks health only, not the corrective behaviour.

## Owner actions

Status on 25 October 2026. Nobody outside the project has been contacted by Claude Code. From the
audit of 25 October 2026 on, open actions are tracked with owners, dates and closure conditions in
the [follow-up register](follow-up-register.md); the list below is kept as the history of this log.

- ~~Confirm alert email receipt~~: done 25 October 2026, both synthetic alerts (LM-07.1, SO-08.3)
  arrived. The credit alerts' receipt was not asked and stays unrecorded.
- ~~Review the evidence for specs 001 to 005 and 007~~ (gate G4): accepted 25 October 2026.
- ~~Drop `ssm:GetParametersByPath` from the host policy~~ (18 October follow-up): gone from
  `infra/`; `tofu plan` showed no changes on 24 October.
- **Spec 006 SC-001**: after each of Sundays 1, 8, 15 and 22 November 2026, record the run
  ([how](runbooks/backup-restore.md#scheduled-runs-where-the-evidence-is-and-how-to-read-it)); keep
  the host awake from Saturday 21:00 to Sunday 01:00 UTC; then the G4 review of spec 006.
- ~~Decide ADR 0012~~: accepted 25 October 2026; R2 reminder added and R3 passed the same day.
- ~~Approve spec 006~~: approved 25 October 2026 as drafted.
- Optional: a re-encryption with `--rotate` on dev (creates `health` key version 2;
  [runbook](runbooks/key-rotation.md)); and documentation gap 13 (admin on `localhost:8443`).
- Lawyer review (D6), Step 2 exit criterion: send [the review pack](reviews/lawyer-review-step-2.md)
  (cover note included) to a lawyer you choose.
- Native Odia speaker review of new keys (I18N-07): [review sheet](reviews/odia-review-step-2.md)
  with all 34 keys, a cover note, the feedback needed back and how it is applied.
