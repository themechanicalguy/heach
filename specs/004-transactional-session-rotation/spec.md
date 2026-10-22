# Feature Specification: Transactional session rotation and replay handling

**Status**: Draft

**Step**: [Step 2 spec](../../docs/specs/step-02-secure-foundation.md) of the [guideline](../../docs/mvp-v1-implementation-guideline.md) (sessions, SE-07.1 to SE-07.4)

**Requirements in scope**: SE-07 (rotating refresh tokens, replay revokes every session); SO-01 (threat model, in plan.md); LM-02 (no personal data in logs); TS-01, TS-03 (test evidence)

**Approval**:

**Created**: 2026-10-22

**Input**: User description: "Transactional session rotation, concurrent replay handling, and cookie preservation on non-401 transient failures (SE-07; review S-2 note; backlog item 3; spec 001 analysis F1 and F2)"

## Scope

Refreshing a session swaps the old refresh token for a new one. Today that swap is three separate
steps on the server: mark the old session used, store the new session, issue a new access token.
A failure between them (database or Redis error, pool timeout) leaves the old session used and no
new one returned, and the server also clears the refresh cookie on that error, so the user is
signed out by a transient fault. When the same token is used twice at the same moment, the second
use is correctly treated as a replay and revokes the user's sessions, but the first use can store
its new session and access token after that revocation, so the replayed family survives
([spec 001 analysis](../001-session-refresh-reliability/analysis.md) F1 and F2, backlog item 3).

This feature makes a rotation one all-or-nothing unit, makes a concurrent replay revoke the
winner's new session and access token too, and clears the refresh cookie only when the session
really is over (401). Replay detection stays strict: a token used twice is a replay, with no grace
window.

**Out of scope** (tracked in the [backlog](../../docs/backlog.md) or a later step):

- A refresh-token grace window (accepting the previous token briefly). Not adopted; it weakens
  replay detection (SE-07.2, SE-07.13). Listed under "Decisions waiting for the owner" in the
  backlog; any change needs a separate, approved spec.
- A refresh whose response is lost after the server committed it (client keeps the old cookie;
  its next use is a replay and signs every device out). This is the strict behaviour SE-07.2
  requires; only a grace window would change it.
- Audit entries for sign-in, refresh and replay (sessions hold no Restricted data; SE-05 covers
  Restricted data and admin actions). Security alerting on replay belongs with SE-08 in Step 3.
- OTP re-verification, device throttling and real sign-in (Step 3, SE-07, SE-08, AC-01).
- The web client: spec 001 already keeps the session on non-401 refresh failures (SE-07.8,
  SE-07.9). No client change is needed.
- The shared transaction helper itself ([spec 003](../003-transactional-audit-writes/spec.md),
  SE-05.9). This feature reuses it and cannot start before spec 003 is implemented.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A server fault during refresh does not sign the user out (Priority: P1)

**Journey and role**: any signed-in user (patient, provider; the Step 2 test identities) whose
access token expires while the database or Redis briefly fails

The app refreshes the session in the background. The server fails part-way. The user sees the
screen's usual error state for that one call; the refresh cookie and the old session are unchanged,
so the next refresh, once the fault clears, succeeds and the user stays signed in.

**Why this priority**: today one transient fault signs the user out of that device and, if the
client retries with a cleared cookie, can look like a forced sign-out. It defeats spec 001's
client-side fix.

**Independent Test**: integration test that makes storing the new session (or issuing the access
token) fail once, checks the response and its `Set-Cookie`, then refreshes again with the same
cookie.

**Acceptance Scenarios**:

1. **Given** a valid refresh cookie, **When** storing the new session fails, **Then** the response is the generic server error, the old session is still valid, and no new session exists (SE-07.14)
2. **Given** a valid refresh cookie, **When** issuing the new access token fails, **Then** the same holds and no new access token works (SE-07.15)
3. **Given** a refresh that failed with a server error, **When** the client refreshes again with the same cookie after the fault clears, **Then** it gets a new access token and a rotated cookie (SE-07.17)
4. **Given** any refresh answered with a status other than 401, **When** the response is sent, **Then** it does not clear or change the refresh cookie unless it is a success that rotates it (SE-07.16)

---

### User Story 2 - A replayed token cannot leave a live session behind (Priority: P1)

**Journey and role**: a user whose refresh token was copied by an attacker; both use it at the
same moment

Two requests present the same refresh token concurrently. At most one gets a new token, the other
is the replay. Once both are answered, no session and no access token of that user works,
including the one just issued to the winner, so the attacker cannot keep a session by winning the
race.

**Why this priority**: SE-07.2's promise (replay revokes every session) must hold under
concurrency, which is exactly when a stolen token is likely to be used.

**Independent Test**: integration test that fires pairs of concurrent refreshes with one cookie and
then checks every token and cookie the user has.

**Acceptance Scenarios**:

1. **Given** one refresh token used by two concurrent requests, **When** both are answered, **Then** at most one got 200, and afterwards every access token and refresh cookie of that user, including the winner's new ones, is rejected with 401 (SE-07.18)
2. **Given** a refresh token already used, **When** it is used again (not concurrently), **Then** behaviour is as SE-07.2: 401, the cookie is cleared, every session is revoked (SE-07.19)
3. **Given** a user who signs out of all devices, **When** another of their devices refreshes at the same moment, **Then** no session survives (SE-07.20)

---

### Edge Cases and failures

- The pool has no free connection when a refresh starts: generic error, nothing changed, cookie
  kept (SE-07.14, SE-07.16).
- The commit itself fails: nothing changed; the access token issued just before is revoked best
  effort; cookie kept (SE-07.15).
- The commit succeeds but the connection drops before the server learns it: the server answers
  with the generic error and keeps the cookie; the next use of the old token is a replay and signs
  every device out. Accepted under strict replay detection (Scope, out of scope).
- A replay arrives while the first use is still being processed: it waits for the first use to
  finish, then is treated as a replay (SE-07.18). It waits at most a few seconds; past that it gets
  the generic error and changes nothing.
- Revoking the user's sessions in the database succeeds on a replay but revoking access tokens in
  Redis fails: the response is the generic error; the database revocation stands, so every refresh
  cookie is already dead and access tokens expire within 15 minutes (SE-07.1). The error type is
  logged.
- Expired, unknown, missing or revoked token: 401 and the cookie is cleared, as today (SE-07.16
  keeps this).
- Rate limit (429) or validation (400) before the controller: the cookie is untouched, as today.
- Two different devices of the same user refresh at once: their refreshes run one after the other
  (a few milliseconds apart); both succeed.
- A replay on one device while another device of the same user refreshes: the other device's new
  session is revoked too, whichever finishes first (SE-07.18).
- "Sign out of all devices" while another device refreshes: no session survives (SE-07.20).

## Requirements _(mandatory)_

### Functional Requirements

These extend Step 2's SE-07.1 to SE-07.4 and spec 001's SE-07.5 to SE-07.13, which stay in force.

| ID       | Given / when / then                                                                                                                                                                                                                                                                          | Proof                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| SE-07.14 | Given a valid, unused refresh token, when storing the new session fails during refresh, then the response is the generic 500 (or 503), the old session is still unused and accepted by the next refresh, and no new session row from that attempt exists                                     | Integration test `apps/api/test/session-rotation.int-spec.ts`; unit test `apps/api/src/auth/session.service.spec.ts` |
| SE-07.15 | Given a valid, unused refresh token, when issuing the new access token fails or the commit fails, then the response is the generic error, the old session is still unused, and no access token issued in that attempt is accepted                                                            | Integration test `session-rotation.int-spec.ts`; unit test `session.service.spec.ts`                                 |
| SE-07.16 | Given a refresh request, when the response status is anything other than 200 or 401, then the response carries no `Set-Cookie` for the refresh cookie; a 401 clears it and a 200 rotates it, as today                                                                                        | Integration test `session-rotation.int-spec.ts`; unit test `apps/api/src/auth/auth.controller.spec.ts`               |
| SE-07.17 | Given a refresh that failed with a server error (SE-07.14, SE-07.15), when the same cookie is presented again after the fault clears, then the refresh succeeds with 200 and a rotated cookie, and no replay is detected                                                                     | Integration test `session-rotation.int-spec.ts`                                                                      |
| SE-07.18 | Given one refresh token presented by two concurrent requests, when both have been answered, then at most one got 200, and every access token and refresh cookie of that user, including any issued to the winner, is rejected with 401; repeated 50 times with no surviving session (SC-001) | Integration test `session-rotation.int-spec.ts`                                                                      |
| SE-07.19 | Given a refresh token that was already used, when it is presented again after the first use completed, then the response is 401, the cookie is cleared, and every session and access token of the user is revoked (SE-07.2 unchanged under the new design)                                   | Integration test `session-rotation.int-spec.ts`; existing `auth.int-spec.ts` SE-07.2 keeps passing                   |
| SE-07.20 | Given a user signing out of all devices (SE-07.3) while another of their devices refreshes concurrently, when both have been answered, then no session or access token of that user is accepted                                                                                              | Integration test `session-rotation.int-spec.ts`                                                                      |

### Permissions

No new actions; who may call refresh is unchanged (the holder of the refresh cookie, SE-07.1).

| Action                           | Patient              | Provider             | Admin                   | Other | Criterion            |
| -------------------------------- | -------------------- | -------------------- | ----------------------- | ----- | -------------------- |
| Refresh; sign out of all devices | Own session (cookie) | Own session (cookie) | Denied (no sign-in yet) | 401   | SE-07.14 to SE-07.20 |

### Key Entities and data classification

No new table, column, Redis key or browser storage. Behaviour changes only for existing fields:
`app.session.revoked_at` (Internal) and the new session row (`refresh_token_hash`, Confidential)
are now written in one transaction; the access-token keys `at:<hash>` and `user-at:<user>`
(Confidential, 15-minute expiry) are unchanged. Retention unchanged.

| Entity      | Field                                   | Class        | Retention                 | Notes        |
| ----------- | --------------------------------------- | ------------ | ------------------------- | ------------ |
| app.session | (unchanged; written in one transaction) | As in Step 2 | Unchanged (30-day expiry) | No migration |

### Audit and consent

- **Audited**: none added. Sessions hold no Restricted data (SE-05 scope); see Out of scope.
- **Consent**: none; no new data or purpose.

## Screens, languages and accessibility

API only. No screen, string or state changes: a 5xx on refresh already shows the calling screen's
error state while the session is kept (spec 001, SE-07.8 and SE-07.9).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across 50 concurrent pairs of refreshes with one token, 0 sessions or access tokens
  of that user still work afterwards.
- **SC-002**: Across 50 refreshes with a forced server fault, 50 of 50 users can refresh
  successfully with their unchanged cookie once the fault clears (0 sign-outs).
- **SC-003**: A normal refresh's p95 response time stays within 10 ms of today's on the local
  integration stack (one extra round trip for the row lock at most).

## Clarifications

### Session 2026-10-22

Resolved by the author from the spec 001 analysis, the review and the goal brief, without an owner
question round. The owner confirms or changes each at review (research D-1 to D-5).

- Q: Add a grace window so a lost response does not sign the user out? → A: No. Strict replay
  detection stays (goal brief; backlog "Decisions waiting for the owner"). Decision D-5.
- Q: What does a concurrent replay do to the winner? → A: Revokes it too. The replay waits for the
  first use to finish and then revokes everything, including what the first use created (SE-07.18).
  Decision D-2.
- Q: Which statuses clear the cookie? → A: Only 401 (session over). 5xx, 503 and anything before
  the controller (400, 429) leave it alone (SE-07.16). Decision D-4.
- Q: Should a refresh be audited now that it is transactional? → A: No; out of scope (no
  Restricted data). Decision recorded in Out of scope.

## Assumptions

- **Spec 003 lands first.** Its `withTransaction` helper (SE-05.9) is merged before this feature's
  code; this spec does not define or change the helper.
- **One database and one Redis.** Sessions live in PostgreSQL and access tokens in Redis, as in
  Step 2. A multi-region or multi-database design would need a new spec.
- **Access tokens stay opaque Redis keys** checked without reading the session row (Step 2
  design). If the guard ever checks the session row, SE-07.18 becomes easier but is still proven
  by the same test.
- **Strict replay detection** (SE-07.2) is the owner's standing decision.

## Open questions

None.
