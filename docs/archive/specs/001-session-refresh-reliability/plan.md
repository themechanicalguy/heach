# Implementation Plan: Session-refresh reliability

**Status**: Approved

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-21 | **Approval**: Owner (Saurav Rath), 2026-10-21, merged in #54; Approved status recorded in this follow-up docs PR on the owner's instruction

**Input**: Feature specification from `specs/001-session-refresh-reliability/spec.md`

## Summary

Fix review finding C-1 in the web client only. All refreshes in a tab share one in-flight
promise; refreshes across tabs are serialised with the browser's Web Locks API so each presents
the cookie current at that moment; a session epoch discards results that belong to a session
that has since ended; a `BroadcastChannel` tells other tabs when the session ended. The server's
rotation and replay detection stay exactly as approved in Step 2 (no grace window); new API
integration tests pin that behaviour, including concurrent replay. Decisions and rejected
alternatives: [research.md](research.md).

## Technical Context

**Apps and packages touched**: `apps/web` (`src/lib/api.ts`, `src/lib/session.tsx`, new unit
tests, new E2E spec); `apps/api` (tests only); `.github/workflows/ci.yml` (add the new E2E spec to
the deploy-bundle job's file list).

**New dependencies**: None. Web Locks and `BroadcastChannel` are browser APIs; tests use the
existing Vitest, Testing Library, jsdom, supertest and Playwright.

**Storage**: None. No table, Redis key or browser storage is added (EN-11).

**Third parties**: None.

**Constraints**: Supported browsers (UX-08) include iOS 15.0 to 15.3, which lack Web Locks and
`BroadcastChannel` (both from Safari 15.4). There the client falls back to in-tab coordination
only, as the spec's edge cases state.

## Constitution Check

_GATE: Must pass before research. Re-check after design._ Re-checked after design: unchanged.

| Principle                               | How this plan meets it                                                                                                                  | Violation and justification |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| I Spec before code                      | No application code until this spec and plan merge as Approved; this pull request is docs only                                          | None                        |
| II Traceable criteria                   | SE-07.5 to SE-07.13, each with a named test (Verification below)                                                                        | None                        |
| III Data protection                     | No new data; tokens stay in memory and in the `HttpOnly` cookie; replay protection unchanged (SE-07.13); server authorisation unchanged | None                        |
| IV Synthetic data, logs, secrets        | Tests use the seeded synthetic patients; no logging added; cross-tab messages carry no token or ID                                      | None                        |
| V Languages, accessibility, performance | No new strings or markup; one extra lock round-trip per refresh (every 15 minutes at most)                                              | None                        |
| VI Architecture, reuse, dependencies    | Extends the existing `api.ts` and `SessionProvider`; no new dependency or module                                                        | None                        |
| VII Evidence-based completion           | Implementation status updated with test evidence in the implementation pull request                                                     | None                        |
| VIII Changes and exceptions             | Server behaviour SE-07.1 to SE-07.4 unchanged; a grace window would need its own spec change first                                      | None                        |
| IX Humans approve                       | Owner approves by merging; agent leaves Status Draft                                                                                    | None                        |

## Project Structure

### Documentation (this feature)

```text
specs/001-session-refresh-reliability/
├── spec.md              # Behaviour
├── plan.md              # This file
├── research.md          # Decisions and rejected alternatives
├── data-model.md        # Client session state and transitions (no stored data)
├── quickstart.md        # How to run the proofs
├── contracts/
│   ├── auth-endpoints.md    # Existing refresh and logout endpoints, unchanged
│   └── client-session.md    # api.ts and SessionProvider contract, cross-tab messages
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/src/lib/api.ts              # single-flight refresh, lock, epoch, end-of-session events
apps/web/src/lib/api.test.ts         # new: SE-07.5, .7, .8, .9, .11
apps/web/src/lib/session.tsx         # restore, sign-out ordering, listens for session end
apps/web/src/lib/session.test.tsx    # new: SE-07.6, .8, .10, .11
apps/web/e2e/session-refresh.spec.ts # new: SE-07.5, .7, .12 against the real API (E2E_API=1)
apps/api/test/auth.int-spec.ts       # extended: SE-07.10, SE-07.13
.github/workflows/ci.yml             # deploy-bundle job runs the new E2E spec
```

## Data model and migrations

None: no table, column or migration. The client's in-memory session state and its transitions
are in [data-model.md](data-model.md).

## Encryption and keys

None: no Restricted data.

## API contracts

No endpoint, field or role changes; the generated OpenAPI file must stay byte-identical
(`pnpm --filter @heach/types check`). The existing contracts this feature relies on are in
[contracts/auth-endpoints.md](contracts/auth-endpoints.md); the client module contract is in
[contracts/client-session.md](contracts/client-session.md).

| Method and path                         | Roles allowed          | Request                                  | Response                                          | Errors                                                                                            |
| --------------------------------------- | ---------------------- | ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/refresh` (unchanged) | Public; refresh cookie | `heach_refresh` cookie (Confidential)    | 200 `{ accessToken, expiresIn }` + rotated cookie | 401 and cookie cleared: missing, expired, revoked or replayed token (replay revokes all sessions) |
| `POST /api/v1/auth/logout` (unchanged)  | Every role             | `{ allDevices: boolean }` + bearer token | 204, cookie cleared                               | 401 without a valid access token; 400 on invalid body                                             |

## Audit, logging and monitoring

No audit events (session events are not SE-05 events). No new logs or metrics. The existing API
request logs already record each refresh call with its correlation ID and status, which is how
an operator would see a replay revocation; no personal data is added to them.

## Threat model

Assets: the refresh token (cookie), access tokens (memory), the user's sessions. Entry points:
`POST /auth/refresh`, `POST /auth/logout`, the same-origin `BroadcastChannel`.

| Threat                                                                                      | Mitigation                                                                                                                             | Criterion                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Spoofing: a stolen refresh token is used alongside the real user                            | Server keeps strict single use; the second use (later or concurrent) gets no tokens and revokes the existing sessions; no grace window | SE-07.13                  |
| Spoofing: an attacker relies on the client's coordination to make a replay look like a race | Coordination is client-only; the server never treats a reused token as benign                                                          | SE-07.13                  |
| Elevation: a late refresh response signs the user back in after logout                      | Session epoch discards results of an ended session; logout waits for the in-flight refresh, then revokes the session it produced       | SE-07.10, SE-07.11        |
| Information disclosure: tokens exposed through cross-tab messaging or storage               | Messages carry only `{ type: 'signed-out' }`; no token in storage, messages or URLs (EN-11)                                            | SE-07.8, SE-07.12         |
| Tampering: another same-origin script posts a fake sign-out message                         | Effect is a local sign-out only (denial of convenience); same-origin scripts are already trusted under the nonce CSP                   | SE-07.12                  |
| Denial of service: refresh loops hammer the endpoint                                        | The refresh endpoint is never refreshed; each call retries at most once; refresh failures are not retried automatically                | SE-07.8, SE-07.9          |
| Denial of service: a user is signed out everywhere by their own concurrent requests (C-1)   | Single-flight in a tab and a cross-tab lock                                                                                            | SE-07.5, SE-07.6, SE-07.7 |
| Repudiation: none added                                                                     | Unchanged from Step 2                                                                                                                  | SE-07.13                  |

Residual risks:

- A refresh response lost in transit after the server rotated leads to a replay revocation and a
  fresh sign-in on every device (accepted by the spec).
- Under a truly concurrent replay, the winning request's new session can be created after the
  loser's revocation and survive (existing Step 2 behaviour, found during this analysis). Not
  introduced or widened by this feature; fixed by transactional session rotation,
  [backlog](../../../backlog.md) item 3.

## Rollout

No feature flag: the change is a bug fix in client code with no data or contract change, and the
old behaviour is the defect. Deploys with the web app through the normal dev pipeline after
merge. Roll back by reverting the pull request; nothing to migrate back. Nothing for the owner
to approve beyond the pull requests (no infrastructure, no cost).

## Verification

| Criterion | Proof                                                                                                                                                    | Where                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| SE-07.5   | `SE-07.5 parallel 401s share one refresh and each call retries once` (unit); `SE-07.5 SE-07.7 parallel expired calls in two tabs keep the session` (E2E) | `apps/web/src/lib/api.test.ts`; `apps/web/e2e/session-refresh.spec.ts` |
| SE-07.6   | `SE-07.6 a double start restores the session with one refresh`                                                                                           | `apps/web/src/lib/session.test.tsx`                                    |
| SE-07.7   | `SE-07.7 refreshes run inside the cross-tab lock, one at a time` (unit, lock double); E2E above                                                          | `apps/web/src/lib/api.test.ts`; `apps/web/e2e/session-refresh.spec.ts` |
| SE-07.8   | `SE-07.8 a rejected refresh ends the session here and in other tabs`; `SE-07.8 the refresh endpoint is never refreshed`                                  | `apps/web/src/lib/api.test.ts`; `apps/web/src/lib/session.test.tsx`    |
| SE-07.9   | `SE-07.9 a network or server failure keeps the session`                                                                                                  | `apps/web/src/lib/api.test.ts`                                         |
| SE-07.10  | `SE-07.10 sign-out waits for the in-flight refresh` (unit); `SE-07.10 logout after a refresh ends the rotated session` (integration)                     | `apps/web/src/lib/session.test.tsx`; `apps/api/test/auth.int-spec.ts`  |
| SE-07.11  | `SE-07.11 results from an ended session are ignored`                                                                                                     | `apps/web/src/lib/api.test.ts`; `apps/web/src/lib/session.test.tsx`    |
| SE-07.12  | `SE-07.12 signing out in one tab signs out the other`                                                                                                    | `apps/web/e2e/session-refresh.spec.ts`                                 |
| SE-07.13  | `SE-07.13 a concurrent second use of a refresh token revokes every session`; existing SE-07.2 test for later reuse                                       | `apps/api/test/auth.int-spec.ts`                                       |
| SC-001    | E2E SE-07.5/SE-07.7 test repeated 50 times locally (`--repeat-each 50`)                                                                                  | Recorded in implementation status                                      |

## Complexity Tracking

No violations.
