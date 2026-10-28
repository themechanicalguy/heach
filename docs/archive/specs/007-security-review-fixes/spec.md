# Feature Specification: Security review fixes (2026-10-24)

**Status**: Approved

**Step**: [Step 2 spec](../../step-specs/step-02-secure-foundation.md) of the [guideline](../../../mvp-v1-implementation-guideline.md) (rate limits SO-08, sessions SE-07, secrets EN-12, CI scanning SO-03)

**Requirements in scope**: SO-08 (rate limits); SE-07 (sessions, test identity); EN-12 (secrets, least privilege); SO-03 (dependency scanning); SE-05 (audit, verified only); SO-01 (threat model, in plan.md); LM-02 (no personal data in logs); TS-01, TS-03 (test evidence)

**Approval**: Owner (Saurav Rath), 2026-10-24, explicit approval of this spec and its plan as implemented ("spec 007 approved, mark it Approved"), recorded in pull request #74 together with the code; the owner directed the implementation on 2026-10-24 before approval (see plan.md, G2). Takes effect when #74 merges

**Created**: 2026-10-24

**Input**: Owner instruction: fix the seven findings of the [security review of 2026-10-24](../../../reviews/2026-10-24-security-review.md), with regression tests

## Scope

The review was written against a stale working copy. Re-checked against `main` (`6057a67`):
finding 6 (note and audit entry not atomic) was already fixed by [spec 003](../003-transactional-audit-writes/spec.md),
finding 5 (concurrent refresh) was fixed in the web client by [spec 001](../001-session-refresh-reliability/spec.md),
and the Storybook, Vite and Next.js advisories of finding 3 by #67 and #71. Still open were: a valid
token escaping the address limit (finding 1), public test sign-in on the dev host (finding 2), new
and unfixed dependency advisories and a production-only CI audit (finding 3), device sign-out that
left earlier access tokens alive (finding 4), a refresh racing a device sign-out treated as a replay
of the whole account (the server half of finding 5), and an API that could obtain the database
administrator and migrator passwords through the shared host role (finding 7).

This feature:

- counts every request against its client address, whatever credentials it carries, and a live
  session against its user as well (amends [spec 002](../002-rate-limit-bypass/spec.md) SO-08.6 and
  SO-08.7, which counted a live session by user only);
- serves test sign-in on the dev host only through a loopback-only proxy entry that adds a key the
  API requires; the public entry refuses it;
- makes device sign-out revoke the device's whole session family, and a later use of that family's
  refresh token a plain 401 instead of an account-wide revocation;
- gives the API its own IAM role that reads exactly its runtime parameters, and keeps containers
  away from the host role;
- gates CI on the full dependency audit, development dependencies included.

**Out of scope**:

- Shared (Redis) rate-limit counters: one API process runs (checked 22 October; backlog item 8).
  Caddy's per-address edge limit sits in front. Needed before a second API process.
- A refresh-token grace window: still not adopted (spec 004). Concurrent refreshes from one
  browser are serialised by the client (SE-07.5 to SE-07.7); a browser without Web Locks (iOS
  before 15.4) can still race two tabs.
- Real sign-in (OTP, Step 3), which removes test sign-in altogether.
- Applying the infrastructure or deploying: the owner applies the OpenTofu plan and runs the
  deploy (plan.md, Rollout).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Changing or valid tokens buy no extra requests (Priority: P1)

**Journey and role**: an anonymous attacker, or a signed-in user, sending many requests from one address

Every request counts against the client address. Inventing a new bearer token for each request,
or rotating through several real accounts, gives no fresh allowance. A signed-in user also has a
per-user allowance, so one user cannot use up another user's share behind a shared address.

**Independent Test**: requests from one address with a new invalid token each are refused after
the address limit; valid tokens of three users from one address are refused after the address limit.

**Acceptance Scenarios**:

1. **Given** one address, **When** it sends more than the address limit with a different invalid bearer token each time, **Then** the requests over the limit get 429.
2. **Given** three signed-in users at one address, **When** they together exceed the address limit, **Then** the requests over it get 429 although each user is under their own limit.

### User Story 2 - Nobody on the internet can sign in as a synthetic user (Priority: P1)

**Journey and role**: anyone reaching the dev host's public address; a developer with Session Manager access

The public entry answers test sign-in with 404. A developer opens the loopback entry through
Session Manager port forwarding (like admin) and signs in as a synthetic user as before. Local
development and CI keep working without a key.

**Independent Test**: test sign-in through the public entry is 404 with or without a guessed key;
through the loopback entry it succeeds; the API alone refuses it without the key.

**Acceptance Scenarios**:

1. **Given** the dev host, **When** a request to test sign-in arrives through the public entry, **Then** it gets 404 and no token.
2. **Given** the dev host with no key configured, **When** any request reaches test sign-in, **Then** it gets 404.

### User Story 3 - Signing out a device ends everything that device was given (Priority: P1)

**Journey and role**: a signed-in patient or provider on one of several devices

Signing out of one device ends every access token and refresh token that device ever held,
including tokens issued before its last refresh, and leaves the user's other devices signed in.
Signing out of all devices ends everything. A refresh that races the sign-out cannot keep the
device signed in and cannot sign the other devices out.

**Independent Test**: login, refresh twice, sign out the device; every earlier token is refused;
another device still works.

**Acceptance Scenarios**:

1. **Given** a device that refreshed twice, **When** it signs out of this device, **Then** its three access tokens and three refresh tokens are refused and the user's other device still works.
2. **Given** a refresh and a device sign-out sent at the same moment, **When** both finish, **Then** nothing of that device works and the other device still works (50 races).

### User Story 4 - The API cannot read the database administrator password (Priority: P2)

**Journey and role**: the API process on the dev host (a compromised dependency, for example)

The API process holds AWS credentials that read only its own four parameters. It cannot reach the
host role, so it cannot read the administrator or migrator password, even by asking AWS directly.

**Independent Test**: the infrastructure checks fail on a wildcard parameter grant, on a privileged
name in the API's list, or on a metadata hop limit above 1; the loader asks for exactly four names.

**Acceptance Scenarios**:

1. **Given** the dev API, **When** it starts, **Then** it asks Parameter Store for exactly DB_APP_PASSWORD, REDIS_PASSWORD, BLIND_INDEX_KEY and TEST_LOGIN_KEY, by name.
2. **Given** the committed infrastructure, **When** CI runs, **Then** the API role grants exactly those four parameter ARNs and no container can obtain the instance role.

### Edge Cases and failures

- Session store (Redis) failure while resolving a token for the rate limit: only the address limit applies; the request is not let through uncounted (SO-08.11 unchanged).
- Health probes: exempt from both limits, also when sent with a signed-in token.
- A guessed or empty test sign-in key, a malformed body, a different letter case or a doubled slash in the path: 404 from the public entry, and 404 from the API before body validation.
- Device sign-out when the session row is already gone: the presented access token is still revoked.
- A refresh token of a family that was signed out: 401, the cookie is cleared, other devices stay signed in. A replayed token of a live family still revokes every session (SE-07.2, SE-07.19).
- API role credentials expire (host asleep past the hour): API calls to AWS fail until the timer refreshes them on wake; the API restarts until then.

### Functional Requirements

These amend spec 002's SO-08.6 and SO-08.7 (a live session was counted by user only) and spec
004's single-device sign-out; everything else in those specs stays in force.

| ID       | Given / when / then                                                                                                                                                                                                                                                                                                                                                                                                           | Proof                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SO-08.12 | Given an address limit A and a user limit U per route and window, when requests arrive from one address, then every request counts against the address whatever its Authorization header (none, malformed, invalid, changing, or valid for any user) and the ones after the Ath get 429; a request whose token resolves to a live session also counts against its user and gets 429 after the Uth. Defaults: A = 200, U = 120 | `user-throttler.guard.spec.ts`; `test/rate-limit.int-spec.ts`; `scripts/rate-limit-check.sh` in the deploy-bundle job                                  |
| SE-07.21 | Given a device that signed in and refreshed any number of times, when it signs out of this device, then every session and access token of its session family is revoked, including those issued before or by a refresh, and the user's other families keep working; when it signs out of all devices, every family is revoked. The family sign-out takes the user's row lock                                                  | `session.service.spec.ts`; `test/session-rotation.int-spec.ts`                                                                                         |
| SE-07.22 | Given a refresh token whose family has no live session (signed out, or revoked by a replay), when it is used, then the response is 401, the cookie is cleared and no other session is revoked; given a refresh token used twice while its family is live, then every session of the user is revoked (SE-07.2 unchanged). A refresh racing a device sign-out never leaves the device signed in nor signs other devices out     | `session.service.spec.ts`; `test/session-rotation.int-spec.ts` (50 races)                                                                              |
| SE-07.23 | Given a configured test sign-in key, when a request lacks it or carries another value, then test sign-in answers 404 before body validation; given the dev host without a key, then every test sign-in is 404; outside local, test and dev it never works. On the dev host the public proxy entry answers test sign-in with 404 and strips any client-sent key; only the loopback-only entry adds the key                     | `test-identity.adapter.spec.ts`; `test-login.gate.spec.ts`; `test/test-login.int-spec.ts`; `scripts/deploy-script.test.mjs`; deploy-bundle check in CI |
| EN-12.4  | Given the API process on a host, when it reads secrets or calls AWS, then it uses an IAM role that may read exactly its named runtime parameters and never the database administrator or migrator password, and no container can obtain the host role's credentials (metadata hop limit 1); bootstrap and migrations get the privileged passwords from the host for their one-off run only                                    | `load-secrets.spec.ts`; `scripts/check-infra-security.test.mjs`; `scripts/deploy-script.test.mjs`; live IAM check after the owner's apply              |
| SO-03.2  | Given a pull request, when CI runs the dependency audit, then production and development dependencies are audited and any high or critical advisory blocks the merge, with no exclusions and no lowered threshold                                                                                                                                                                                                             | CI audit step; `scripts/security/scanner-fixtures.sh` (dev-dependency fixture)                                                                         |

### Permissions

| Role                                             | Can do                                                                          | Cannot do                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Anonymous (internet)                             | Use public routes within the address limit                                      | Test sign-in on the dev host; extra allowance from invented tokens |
| Signed-in user                                   | Use their routes within the address and user limits; sign out one device or all | Keep a signed-out device's earlier tokens working                  |
| Developer with Session Manager access            | Test sign-in as a synthetic user through the loopback entry                     | Reach it from the internet                                         |
| API process (IAM)                                | Read its four parameters, use data-domain keys, uploads, alerts                 | Read the administrator or migrator password; use the host role     |
| Host (deploy.sh, bootstrap, migrations, backups) | Read the environment's parameters, assume the API role                          | (unchanged otherwise)                                              |

### Key Entities and data classification

| Entity                                                  | Fields                                    | Class                       | Encrypted at field level?                                        |
| ------------------------------------------------------- | ----------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `TEST_LOGIN_KEY` (SSM SecureString, API env, Caddy env) | 256-bit random hex                        | Confidential (credential)   | Not stored in the database; SecureString in Parameter Store      |
| Redis set `family-at:<family id>`                       | access-token hashes of one session family | Confidential (token hashes) | No: hashes only, 15-minute TTL, like `user-at:<user id>`         |
| API role credentials file (`/opt/heach/aws`)            | temporary AWS credentials, one hour       | Confidential (credential)   | No: root-owned directory, readable by the container's group only |

### Audit and consent

No Restricted data is read or written by these changes. Refused test sign-ins, refreshes of a
signed-out family and replays are logged as events without token, key, user ID or address.
Audit-log behaviour for notes is unchanged (SE-05.5, spec 003; re-verified).

## Screens, languages and accessibility

No screen changes. Developers reach the dev web app with test sign-in at the loopback entry
(`https://localhost:9443` through port forwarding) instead of the public address.

## Success Criteria

- **SC-001**: 1,000 different invalid bearer tokens from one address create one rate-limit counter and are refused after the address limit.
- **SC-002**: 50 of 50 refresh-and-device-sign-out races leave nothing of the device working and the other device working.
- **SC-003**: Test sign-in through the public entry is 404 in the deploy-bundle CI job; through the loopback entry it succeeds.
- **SC-004**: `pnpm audit` (all dependencies) reports no known vulnerabilities on the merge commit.

## Open questions

None. Resolved on 2026-10-24: the owner approved this record as written, including the amended SO-08.6 and SO-08.7 (default 200). Applying the infrastructure and re-running the deploy is a rollout step ([plan.md, Rollout](plan.md#rollout)), not an open question.
