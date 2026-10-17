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
| 3 | feat/step2-db-tls-migrations | Data TLS, roles, audit schema, migrations, KMS adapter, SSM secrets, DC check | Open; dev deploy needs infra apply |

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

## Owner actions

- Run `aws login --profile saurav-heach-admin` so the dev infra (SSM parameters, narrower KMS
  policy) can be planned and applied; until then Deploy dev stops at its preflight and dev keeps
  the previous version.

- Lawyer review (D6), Step 2 exit criterion.
- Native Odia speaker review of new keys (I18N-07).
