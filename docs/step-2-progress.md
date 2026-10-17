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
| 5 | feat/step2-observability | Logger context and masking, OpenTelemetry, Collector and Jaeger, error-rate alert, web-vitals endpoint | Open |

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
| LM-01.1 | 🟡 | API to DB to logs: `test/tracing.int-spec.ts` (Jaeger search by correlation ID finds the pg spans; the log line has the trace ID). Browser leg in the web PR |
| LM-02.1 | ✅ | `packages/logger/src/index.test.ts` |
| LM-02.2 | ✅ | `apps/api/src/lint-rules.spec.ts` |
| LM-04.1 | 🟡 | `POST /v1/rum` logs vitals per route and device; browser reporting in the web PR |
| LM-05.1 | 🟡 | Traces in OpenTelemetry and Jaeger; request metrics on the Collector's Prometheus endpoint. One dashboard for rate, errors and p50/p95/p99 needs Prometheus and Grafana, outside D4: owner decision |
| LM-07.1 | 🟡 | `error-rate.monitor.spec.ts` (in-process 5-minute window, SNS publisher); live test alert after infra apply |
| FF-01.1 | ✅ | `feature-flags.spec.ts`, flag-off test in `sample-notes.int-spec.ts` |

## Owner actions

- LM-05.1 dashboard: approve Prometheus and Grafana (Apache-2.0 / AGPL-3.0, local only) as D4 additions, or accept Jaeger plus the raw metrics endpoint.

- Decide SO-08.2's Caddy rate limit: add `caddy-ratelimit` (custom Caddy build) to D4, or reword.

- Run `aws login --profile saurav-heach-admin` so the dev infra (SSM parameters, narrower KMS
  policy) can be planned and applied; until then Deploy dev stops at its preflight and dev keeps
  the previous version.

- Lawyer review (D6), Step 2 exit criterion.
- Native Odia speaker review of new keys (I18N-07).
