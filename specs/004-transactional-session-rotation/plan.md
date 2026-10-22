# Implementation Plan: Transactional session rotation and replay handling

**Status**: Draft

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-22 | **Approval**:

**Input**: Feature specification from `specs/004-transactional-session-rotation/spec.md`

## Summary

Close spec 001 analysis findings F1 and F2 (backlog item 3). `SessionService.refresh` runs inside
spec 003's `withTransaction`: it locks the session and its user row (`SELECT … FOR UPDATE` on the
join), checks expiry and use, marks the session used, inserts the new session, issues the access
token in Redis, then commits. A replay takes the same lock, so it runs only after any in-flight
rotation of that user has committed, and then revokes every session row and every access token,
including the ones just issued. Sign-out of all devices takes the user-row lock too. The controller
clears the refresh cookie only on 401. No schema, endpoint, client or dependency change. Decisions:
[research.md](research.md).

## Technical Context

**Apps and packages touched**: `apps/api` only: `src/auth/session.service.ts`,
`src/auth/session.repository.ts`, `src/auth/auth.controller.ts`, their unit tests (new
`session.service.spec.ts`, new `auth.controller.spec.ts`), `test/session-rotation.int-spec.ts`
(new). `test/auth.int-spec.ts` SE-07.13 comment updated (the winner is now revoked too).

**New dependencies**: None. Uses `pg` and `ioredis` already in the stack, and spec 003's
`withTransaction`.

**Storage**: None added. Existing `app.session`, `app.user_test` and Redis keys.

**Third parties**: None.

**Constraints**: depends on spec 003 being implemented (helper, SE-05.9). The user-row lock is
held across one `INSERT`, one `UPDATE` and one Redis `MULTI`; `SET LOCAL lock_timeout = '5s'`
bounds waiting. No KMS call and no `audit.append` inside the transaction, so the audit lock
(review P-2) is not involved. Pool size 10, connection timeout 1 s (unchanged).

## Constitution Check

_GATE: Must pass before research. Re-check after design._ Re-checked after design: unchanged.

| Principle                               | How this plan meets it                                                                                                                           | Violation and justification |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| I Spec before code                      | No application code until this spec and plan merge as Approved, and not before spec 003 is implemented; this pull request is docs only           | None                        |
| II Traceable criteria                   | SE-07.14 to SE-07.20, each with a named test (Verification)                                                                                      | None                        |
| III Data protection                     | Closes an SE-07 gap (replay survivor); no new data; authorisation unchanged                                                                      | None                        |
| IV Synthetic data, logs, secrets        | Step 2 test identities only; error type only in logs; tokens and hashes never logged                                                             | None                        |
| V Languages, accessibility, performance | No strings or screens; SC-003 bounds the added latency                                                                                           | None                        |
| VI Architecture, reuse, dependencies    | Reuses spec 003's helper; plain row locks in the existing repository; no new dependency, no guard or token-format change                         | None                        |
| VII Evidence-based completion           | Status page updated in the implementation pull request; SE-07 stays Partial (OTP re-verification is Step 3)                                      | None                        |
| VIII Changes and exceptions             | SE-07.1 to SE-07.13 unchanged; the SE-07.13 test comment that accepted the survivor is replaced by SE-07.18; grace window explicitly not adopted | None                        |
| IX Humans approve                       | Owner approves by merging; agent leaves Status Draft                                                                                             | None                        |

## Project Structure

### Documentation (this feature)

```text
specs/004-transactional-session-rotation/
├── spec.md
├── plan.md              # This file
├── research.md          # Current behaviour, decisions D-1 to D-5
├── data-model.md        # No stored data; transaction and lock scope
├── quickstart.md        # How to run the proofs
├── contracts/
│   └── refresh.md       # HTTP contract of POST /v1/auth/refresh on failure
├── checklists/
│   └── requirements.md
├── analysis.md          # Consistency analysis
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/auth/session.repository.ts      # lockByHash, lockUser, revoke, create take a client
apps/api/src/auth/session.service.ts         # refresh and signOutEverywhere inside withTransaction
apps/api/src/auth/session.service.spec.ts    # new: SE-07.14, SE-07.15 ordering and rollback (unit)
apps/api/src/auth/auth.controller.ts         # clear the cookie only on 401
apps/api/src/auth/auth.controller.spec.ts    # new: SE-07.16 (unit)
apps/api/test/session-rotation.int-spec.ts   # new: SE-07.14 to SE-07.20
apps/api/test/auth.int-spec.ts               # SE-07.13 comment only
```

## Data model and migrations

None. Statement and lock scope per operation are in [data-model.md](data-model.md).

## Encryption and keys

Unchanged. Refresh tokens are stored only as SHA-256 hashes (Step 2); no field encryption involved.

## API contracts

No endpoint, DTO or OpenAPI change. The failure contract of `POST /v1/auth/refresh` (which status
clears the cookie) is in [contracts/refresh.md](contracts/refresh.md).

## Audit, logging and monitoring

- Audit: none added (spec Out of scope).
- Logging: the error filter logs the error type as today. On a replay the service logs
  `Refresh token replay; sessions revoked` at warn with the user ID only (Internal, opaque UUID),
  as SE-08 alerting will need; no token or hash. When the post-commit access-token revocation fails
  the service logs `Access-token revocation failed: <error name>`.
- Monitoring: 5xx on refresh counts toward the LM-07.1 error-rate monitor.

## Threat model

Assets: sessions and access tokens (account takeover), API availability. Entry points:
`POST /v1/auth/refresh`, `POST /v1/auth/logout` with `allDevices`.

| Threat                                                                                   | Mitigation                                                                                                     | Criterion            |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| Spoofing: an attacker who races a stolen refresh token keeps a live session              | User-row lock serialises rotation and replay; the access token is issued before commit, so revoke-all finds it | SE-07.18             |
| Spoofing: a session survives "sign out of all devices" through a concurrent refresh      | Sign-out of all devices takes the same user-row lock                                                           | SE-07.20             |
| Denial of service: a transient database or Redis fault signs the user out                | Rotation is all-or-nothing; the cookie is cleared only on 401                                                  | SE-07.14 to SE-07.17 |
| Denial of service: requests pile up on the user-row lock                                 | Lock held for three statements and one Redis call; `lock_timeout` 5 s; only one user's requests can queue      | SE-07.18, SC-003     |
| Denial of service: connections leaked by failed rotations                                | Spec 003 helper releases in `finally` (SE-05.9, SE-05.10)                                                      | SE-07.14             |
| Spoofing: an access token from a failed (rolled back) rotation stays valid               | Redis failure rolls back before any token exists; commit failure revokes the issued token best effort          | SE-07.15             |
| Information disclosure: tokens or hashes in logs                                         | Only user ID and error type logged                                                                             | SE-07.16             |
| Repudiation: a lost response after commit looks like a replay and signs every device out | Accepted: strict replay detection (SE-07.2), no grace window without an owner decision                         | SE-07.19             |

## Rollout

One API release, no flag, no migration. Rollback is a redeploy of the previous image; no data
repair (session rows written by either version are valid for both). Deploy only after spec 003's
code is on `main`.

## Verification

| Criterion        | Test or check                                                                                                                                                                                                     | Where it runs |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| SE-07.14         | Int: `vi.spyOn` on `SessionRepository.create` throws once; 500, old cookie still refreshes, no extra row for that user. Unit: statement order `BEGIN`, lock, revoke, insert, issue, `COMMIT`; `ROLLBACK` on throw | CI Checks job |
| SE-07.15         | Int: `AccessTokenStore.issue` throws once → as SE-07.14. Unit: `COMMIT` throws → issued token revoked, error rethrown                                                                                             | CI Checks job |
| SE-07.16         | Int: 500 response has no `heach_refresh` in `Set-Cookie`; 401 clears; 200 rotates. Unit: controller with a service that throws `Error` vs `UnauthorizedException`                                                 | CI Checks job |
| SE-07.17         | Int: after the SE-07.14 and SE-07.15 faults, the same cookie gets 200 and a new cookie; SC-002 loop of 50                                                                                                         | CI Checks job |
| SE-07.18         | Int: 50 × two concurrent refreshes with one cookie; afterwards every token and cookie of that user is 401 (SC-001)                                                                                                | CI Checks job |
| SE-07.19         | Int: sequential reuse → 401, cookie cleared, other device 401; existing SE-07.2 test unchanged                                                                                                                    | CI Checks job |
| SE-07.20         | Int: logout `allDevices` concurrently with another device's refresh, 50 times; afterwards every token and cookie is 401                                                                                           | CI Checks job |
| SC-003           | Int: timing of 200 sequential refreshes recorded before and after in tasks.md Evidence (local)                                                                                                                    | Local, once   |
| Regression proof | SE-07.14, SE-07.16 and SE-07.18 run against current `main` and fail (recorded in tasks.md Evidence)                                                                                                               | Local, once   |

## Complexity Tracking

None. No principle is violated.
