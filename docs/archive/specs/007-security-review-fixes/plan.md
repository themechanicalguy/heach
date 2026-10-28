# Implementation Plan: Security review fixes (2026-10-24)

**Spec**: [spec.md](spec.md) · **Status**: Approved (see the spec's Approval line)

## Constitution Check

- G2 (spec first): **not met in order**. The owner directed the implementation directly, so this
  spec and the code arrive in one pull request, unmerged until the owner approves both.
- Security first: no authorisation, encryption, cookie, audit or replay check is weakened. SE-07.22
  narrows the account-wide revocation to live families only; a replay of a live family is still
  revoked everywhere (tests SE-07.19 kept and extended).
- No new runtime dependency. pnpm overrides pin patched transitive versions (finding 3).
- No personal data in logs: new log events carry no token, key, user ID or address.

## Data model and migrations

No database migration. Redis gains `family-at:<family id>` sets (access-token hashes, 15-minute
TTL), written next to the existing `user-at:<user id>` set. Sessions already carry `family_id`.

## Encryption and keys

No change to field encryption. The API role keeps `kms:GenerateDataKey` and `kms:Decrypt` on the
data-domain keys; the host role keeps them on the backup key only (EN-04.2 check still passes).

## API contracts

- `POST /v1/auth/test-login`: optional header `x-test-login-key` (required in dev). Refused requests
  get 404 before body validation. OpenAPI and generated types updated.
- `POST /v1/auth/logout` with `allDevices: false`: now revokes the device's whole session family.
- `POST /v1/auth/refresh`: a token of a family with no live session is 401 without account-wide
  revocation.
- Rate limit: every limited route counts by address (`RATE_LIMIT_PER_ADDRESS_PER_MINUTE`, default 200) and, for a live session, by user (`RATE_LIMIT_PER_MINUTE`, default 120). Health probes skip
  both; RUM caps both at 60.

## Threat model

| Threat (STRIDE)                                                                                   | Asset                               | Mitigation                                                                                                                    | Test                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Denial of service: new invalid token per request to get fresh allowances                          | API availability                    | Address limit on every request, user limit only after a live session resolves                                                 | `user-throttler.guard.spec.ts`, `rate-limit.int-spec.ts` SO-08.12                                                                      |
| Spoofing: anyone signs in as a seeded patient, provider or admin on the dev host                  | Synthetic sample notes, roles       | Public entry 404 and header strip; API requires the loopback entry's key; refused in dev without a key                        | `test-identity.adapter.spec.ts`, `test-login.gate.spec.ts`, `test-login.int-spec.ts`, `deploy-script.test.mjs`, CI deploy-bundle check |
| Elevation: stolen pre-refresh access token outlives device sign-out                               | Patient data the token can read     | Family set of access tokens revoked on device sign-out                                                                        | `session-rotation.int-spec.ts` SE-07.21                                                                                                |
| Denial of service: refresh racing a device sign-out signs every device out                        | Other devices' sessions             | Ended family is a plain 401 (SE-07.22), under the user's row lock                                                             | `session-rotation.int-spec.ts` SE-07.22 (50 races)                                                                                     |
| Information disclosure: a compromised API dependency reads the administrator or migrator password | Database superuser and DDL rights   | API IAM role with exact parameter ARNs; IMDS hop limit 1; bootstrap and migration passwords passed only to one-off containers | `load-secrets.spec.ts` EN-12.4, `check-infra-security.test.mjs`, `deploy-script.test.mjs`                                              |
| Tampering: vulnerable dev server or build tool                                                    | Source tree, developer machines, CI | Full audit gate; patched overrides; no exclusions                                                                             | CI audit step, `scanner-fixtures.sh`                                                                                                   |

## Rollout

The owner applies and deploys; nothing here changes AWS on its own.

1. Merge after review. CI runs the full audit, the infra checks and the deploy-bundle E2E through
   the loopback entry.
2. The merge's Deploy dev run stops at its preflight ("Cannot assume the API role … Nothing
   changed.") until step 3: the running version stays up.
3. Owner: `tofu -chdir=infra/envs/dev plan -out plan.tfplan`; expect to add `aws_iam_role.api`,
   `aws_iam_role_policy.api`, `random_id.test_login_key`, `aws_ssm_parameter.test_login_key`, and to
   change in place `aws_iam_role_policy.host` and `aws_instance.host` (metadata options only; no
   replacement). No cost. Apply after review.
4. Re-run Deploy dev at once: from step 3, the running API loses instance-role access when its
   cached credentials expire (within hours). The deploy installs the credentials timer
   and restarts the API with the API role.
5. Developers use `https://localhost:9443` through Session Manager port forwarding for test sign-in.

Rollback: revert the merge and re-apply the previous infrastructure (hop limit 2).

## Verification

Local on 24 October 2026, Node 24.22.1, pnpm 12.8.1, against PostgreSQL and Redis of the local
stack: see [tasks.md](tasks.md#evidence). Live IAM and the deployed host are verified after the
owner's apply and deploy (spec Open questions).
