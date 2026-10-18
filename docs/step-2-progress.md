# Step 2 progress and acceptance evidence

Working log for [the Step 2 spec](specs/step-02-secure-foundation.md). It records evidence for each
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
| 9 | feat/step2-quality-gates | GCM tag-length fix (found by Semgrep), Semgrep and Trivy in CI with runtime fixtures per scanner, npm removed from runtime images, changed-line coverage gate, adapter ports and doubles with lint boundary | #42 |
| 10 | (not started) | Backup KMS key and bucket, nightly pg_dump, off-account copy script, Terraform checks EN-02.1/EN-05.2/EN-04.2, restore record EN-10.4, infra apply | Not started |

## Evidence by criterion

Statuses: ⬜ not started, 🟡 in progress, ✅ proven, 🧑 owner action.

| ID | Status | Evidence |
| --- | --- | --- |
| EN-01.1 | ✅ | `test/data-tls.int-spec.ts`; CI deploy-bundle step refuses plaintext |
| EN-03.2, EN-04.1, EN-05.1, EN-06.1, EN-09.1 | ✅ | `packages/crypto/src/*.test.ts`, `kms-key-provider.spec.ts` |
| EN-10.1 | ✅ | CI runs bootstrap and migrations on an empty database; `db-roles.int-spec.ts` |
| EN-10.2, SE-05.4 | ✅ | `db-roles.int-spec.ts` |
| SE-05.2, SE-05.3 | ✅ (SQL) | `audit-chain.int-spec.ts`; API helper in PR 4 |
| DC-01.1, DC-01.2 | ✅ | `classification.int-spec.ts` fixture; CI `db:check-classes` |
| EN-12.1 | 🟡 | `load-secrets.spec.ts`; live run after infra apply |
| EN-04.2 | 🟡 | Policy narrowed in code; `tofu plan` pending AWS sign-in |
| EN-03.1, EN-13.1, I18N-04.1 | ✅ | `test/sample-notes.int-spec.ts` (ciphertext in DB, not in logs, not in another user's response; Odia round trip) |
| EN-05.3 | ✅ | `test/crypto.int-spec.ts`; [runbook](runbooks/key-rotation.md) |
| EN-09.2 | ✅ | `test/crypto.int-spec.ts` (fixture table; real searchable fields arrive in Step 3) |
| EN-12.2 | 🧑 | [Runbook](runbooks/secret-rotation.md) written; run in dev after infra apply |
| SE-02.1 | ✅ | `src/auth/route-roles.spec.ts`; the guard also refuses undeclared routes |
| SE-02.2 | ✅ | `test/authz-matrix.int-spec.ts` (25 cases) |
| SE-02.3, SE-05.1, SE-05.2 | ✅ | `notes.repository.spec.ts`, `sample-notes.int-spec.ts` |
| SE-07.1 to SE-07.3 | ✅ | `test/auth.int-spec.ts` |
| SE-07.4 | ✅ | `test-identity.adapter.spec.ts`; `AuthModule.register` throws at start-up |
| SE-09.1 | ✅ | `sample-notes.int-spec.ts` |
| SO-05.1, EN-01.2 | ✅ | `test/security.int-spec.ts` (helmet; Caddy also sets HSTS) |
| SO-05.2 | ✅ | `sample-notes.int-spec.ts` (generic 400, no echo) |
| SO-08.1 | ✅ | `test/security.int-spec.ts` (@nestjs/throttler, per token or IP) |
| SO-08.2 | 🟡 | SQL injection sample → 400 proven; Caddy rate limit needs a plugin outside D4 (owner decision) |
| SO-08.3 | 🟡 | `test/security.int-spec.ts` with the alert double; live SNS test after infra apply |
| LM-01.1 | ✅ | Browser: every app API call carries an `x-correlation-id` (`apps/web/e2e/notes-flow.spec.ts`); API to DB to logs: `test/tracing.int-spec.ts` |
| LM-02.1 | ✅ | `packages/logger/src/index.test.ts` |
| LM-02.2 | ✅ | `apps/api/src/lint-rules.spec.ts` |
| LM-04.1 | 🟡 | `WebVitals.tsx` sends LCP, INP, CLS, FCP, TTFB per route template and device class to `POST /v1/rum`, which logs them. Manual record on the dev host pending its next deploy |
| LM-05.1 | 🟡 | Traces in OpenTelemetry and Jaeger; request metrics on the Collector's Prometheus endpoint. One dashboard for rate, errors and p50/p95/p99 needs Prometheus and Grafana, outside D4: owner decision |
| LM-07.1 | 🟡 | `error-rate.monitor.spec.ts` (in-process 5-minute window, SNS publisher); live test alert after infra apply |
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
| EN-13.1 (end to end) | ✅ local, CI pending | `e2e/notes-flow.spec.ts` on mobile, tablet, desktop against web + API + PostgreSQL (local run: pass). CI runs it against the deploy bundle behind Caddy and checks ciphertext, audit and logs in SQL |
| PF-07.1 | ✅ | `e2e/pwa.spec.ts`: manifest, service worker, offline shell with banner, no `/api` entry in any cache |
| TS-05.1 | ✅ | `playwright.config.ts`: mobile 360, tablet 768, desktop 1280 projects on every PR |
| TS-07.1 | ✅ | `e2e/shell.spec.ts` with Linux baselines for or, en, hi on each project |
| UX-03.1 | ✅ | `e2e/shell.spec.ts`: nav bottom edge equals viewport bottom at 360 px, plus baseline |
| I18N-06.1 | ✅ | `e2e/shell.spec.ts`: self-hosted, unicode-range subset faces cover Odia and Devanagari; 140 percent text has no overflow |
| PF-02.1 | ✅ | `e2e/bundle-budget.spec.ts` (largest entry about 143 KB gzipped of 170 KB), fixture `src/bundle-budget.test.ts` |
| PF-03.1 | ✅ local | Lighthouse CI mobile: or 97 to 98, en 99, hi 99 (local, 3 runs each); CI step asserts at least 90 |
| PF-05.1 | ✅ | `e2e/bundle-budget.spec.ts` (route-specific chunks), `src/next-config.test.ts` (AVIF, WebP) |
| LM-03.1 | 🟡 | Sentry browser SDK to GlitchTip, release and role tags, no identity (`ErrorTracking.tsx`). Manual record and source maps pending: uploading source maps needs `@sentry/cli`, outside D4 (owner decision) |
| SO-03.1 | ✅ | CI: Semgrep CE (registry packs plus `security/semgrep/heach.yml`), `pnpm audit` high, Trivy on web/admin/api images, gitleaks; `scripts/security/scanner-fixtures.sh` proves each blocks a planted high finding (local run: all four block) |
| EN-12.3 | ✅ | Pre-commit gitleaks hook (existing) and CI; fixture: generated token blocked by gitleaks |
| SO-03.1 finding | ✅ | The container scan found critical and high CVEs in Caddy 2.10.2 (admin image and the internet-facing edge proxy). Caddy 2.11.6 is now rebuilt from source with patched Go and x/net in `apps/admin/Dockerfile`; the edge proxy runs that image. Trivy: clean |
| EN-03.2 (hardened) | ✅ | Semgrep found GCM decryption without a fixed tag length; fixed, `envelope.test.ts` rejects a truncated tag |
| TS-01.1 | ✅ | `scripts/check-changed-coverage.mjs` in CI (unit plus API integration lcov); fixture test fails at 50 percent. Next route files are excluded because only Playwright runs them |
| TS-06.1 | ✅ | `apps/api/src/adapters/*.port.ts` and `fakes.ts`; lint boundary proven in `lint-rules.spec.ts` |
| FF-01.1 | ✅ | `feature-flags.spec.ts`, flag-off test in `sample-notes.int-spec.ts` |

## Owner actions

- LM-03.1 source maps: approve `@sentry/cli` (BSD-3, CI only) to upload source maps to GlitchTip, or accept stack traces without them.

- LM-05.1 dashboard: approve Prometheus and Grafana (Apache-2.0 / AGPL-3.0, local only) as D4 additions, or accept Jaeger plus the raw metrics endpoint.

- Decide SO-08.2's Caddy rate limit: add `caddy-ratelimit` (custom Caddy build) to D4, or reword.

- Run `aws login --profile saurav-heach-admin` so the dev infra (SSM parameters, narrower KMS
  policy) can be planned and applied; until then Deploy dev stops at its preflight and dev keeps
  the previous version.

- Lawyer review (D6), Step 2 exit criterion.
- Native Odia speaker review of new keys (I18N-07).
