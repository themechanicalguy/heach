# Feature Specification: Session-refresh reliability

**Status**: Approved

**Step**: [Step 2 spec](../../step-specs/step-02-secure-foundation.md) of the [guideline](../../../mvp-v1-implementation-guideline.md) (auth skeleton, guideline Step 2 item 5)

**Requirements in scope**: SE-07 (sessions); SE-02 (server-side authorisation, unchanged); SO-01 (threat model, in plan.md); TS-01, TS-03, TS-05 (test evidence)

**Approval**: Owner (Saurav Rath), 2026-10-21, merged in #54; Approved status recorded in this follow-up docs PR on the owner's instruction

**Created**: 2026-10-21

**Input**: User description: "Session-refresh reliability: concurrent expired-token requests, browser-tab concurrency, session restoration, refresh rejection and network failures, logout interactions and stale responses, and continued rejection of genuine refresh-token replay."

## Scope

A signed-in user must not be signed out of every device because their own browser refreshed the
session twice at once. Today each request that meets an expired access token refreshes on its
own, so two parallel requests (or two tabs, or the double start of the session check) present the
same refresh token twice and the server's replay detection (SE-07.2) revokes every session of the
user (finding C-1 of the 18 October 2026 codebase review, `docs/reviews/2026-10-18-codebase-review.md`,
which is not yet committed). This feature makes the web
app's session handling coordinate its refreshes, fail safely, and keep logout final, while the
server keeps rejecting genuine replay exactly as Step 2 approved.

**Out of scope** (each tracked in the [backlog](../../../backlog.md)):

- A server-side grace window that accepts the previous refresh token for a short time. It weakens
  replay protection and needs its own reviewed design decision; this feature does not add one.
- Making session rotation one database transaction (review S-2 follow-up).
- Rate-limit bypass by fake bearer tokens (review S-1).
- Revoking, on the server, the access tokens that other tabs still hold after a one-device
  logout (they expire within 15 minutes, SE-07.1).
- The admin app, which has no sign-in yet (SE-04).
- OTP re-verification for sensitive actions (SE-07, Step 3).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Parallel requests survive token expiry (Priority: P1)

**Journey and role**: any signed-in journey (J1 to J9); patient or provider

The user leaves a page open for longer than the access-token lifetime, then does something that
makes the page call the API several times at once. Every call succeeds after one silent session
refresh; the user is not signed out on this or any other device.

**Why this priority**: today this signs the user out of every device about every 15 minutes of use;
it is the defect the review rated High.

**Independent Test**: expire the access token, fire several calls at once, count refresh requests
and check every call succeeded and no session was revoked.

**Acceptance Scenarios**:

1. **Given** an expired access token and a valid refresh cookie, **When** the page makes several API calls at once, **Then** one refresh is sent, every call succeeds, and no session is revoked (SE-07.5)
2. **Given** a valid refresh cookie, **When** the app starts (including a development double start), **Then** one refresh is sent and the user is shown as signed in (SE-07.6)

---

### User Story 2 - Several tabs stay signed in (Priority: P1)

**Journey and role**: any signed-in journey; patient or provider

The user has HEACH open in two tabs of the same browser. Both tabs need a new access token at the
same moment. Both stay signed in.

**Why this priority**: tabs share one refresh cookie, so without coordination the same defect
happens across tabs.

**Independent Test**: two pages of one browser context with expired access tokens call the API at
the same time; both succeed and no session is revoked.

**Acceptance Scenarios**:

1. **Given** two tabs of one browser with expired access tokens, **When** both call the API at once, **Then** their refreshes run one after the other, both calls succeed, and no session is revoked (SE-07.7)

---

### User Story 3 - Failures and logout are honest and final (Priority: P2)

**Journey and role**: any signed-in journey; patient or provider

When the session really has ended, the user is shown as signed out in every tab. When only the
network failed, the user is not signed out. When the user signs out, nothing that was still in
flight can sign them back in.

**Why this priority**: wrong session state either hides a real sign-out or loses a session the user
still has; both erode trust and the second leaks a token after logout.

**Independent Test**: unit tests that stub the network responses and timings; one E2E test for
logout across tabs.

**Acceptance Scenarios**:

1. **Given** a refresh the server rejects, **When** any call needed it, **Then** the user is shown as signed out in this tab and in the browser's other tabs (SE-07.8)
2. **Given** the network fails or the server errors during a refresh, **When** a call needed it, **Then** that call fails with a retryable error and the user stays signed in (SE-07.9)
3. **Given** a refresh in flight, **When** the user signs out, **Then** the sign-out ends the session that refresh produced and the user stays signed out (SE-07.10)
4. **Given** the user has signed out, **When** a response to an earlier request arrives, **Then** it does not restore a token or the signed-in state (SE-07.11)
5. **Given** two tabs signed in, **When** the user signs out in one, **Then** the other shows signed out (SE-07.12)

---

### User Story 4 - Stolen refresh tokens are still caught (Priority: P1)

**Journey and role**: attacker holding a copied refresh token (threat), patient or provider as victim

Coordination happens in the user's browser only. The server still treats any second use of a
refresh token as replay, whether it arrives later or at the same moment as the first use.

**Why this priority**: the fix must not trade the High correctness defect for a security one.

**Independent Test**: API integration test presenting one refresh token twice, sequentially and
concurrently.

**Acceptance Scenarios**:

1. **Given** a refresh token that has been used, **When** it is presented again, at any time and including concurrently with its first use, **Then** the reuse gets no tokens and the user's existing sessions are revoked (SE-07.13)

---

### Edge Cases and failures

- The refresh response is lost after the server rotated the token (connection dropped). The next
  refresh presents the old token and is treated as replay; the user signs in again on every
  device. This is the accepted cost of strict replay detection without a grace window (SE-07.13);
  see Assumptions.
- Two requests with one refresh token reach the server at the same moment (only possible now
  from outside the coordinated client, for example an attacker racing the user): the loser gets
  401 and revokes the user's sessions, but the winner's newly issued session can be created just
  after that revocation and survive. Closing this needs rotation and revocation in one
  transaction, which is backlog item 3 and out of scope here; SE-07.13 states only what is
  guaranteed today.
- A browser without cross-tab locking: within one tab SE-07.5, SE-07.6 and SE-07.8 to SE-07.11
  still hold; tabs are not coordinated (SE-07.7 does not hold). All browsers in the support
  matrix provide it (see plan).
- The refresh endpoint itself answers 401: it is never retried with a refresh (no loop) (SE-07.8).
- A call that still gets 401 after a successful refresh fails with 401; it is not refreshed again
  (no loop) (SE-07.5).
- The user signs in while a refresh from the previous session is in flight: the late refresh result
  is ignored (SE-07.11).
- The refresh endpoint fails with a server error (5xx): the tab stays signed in (SE-07.9), but
  today the server clears the refresh cookie on every refresh error and may already have revoked
  the old session, so the next refresh can answer 401 and sign the tab out (SE-07.8). Keeping the
  cookie and session on server errors is part of backlog item 3.
- Offline at app start: the session check fails like a network failure; the user is shown as signed
  out but nothing is cleared, so the next start restores the session (SE-07.9).

## Requirements _(mandatory)_

### Functional Requirements

| ID       | Given / when / then                                                                                                                                                                                                                                                                                                                                                  | Proof                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SE-07.5  | Given an expired access token and a valid refresh cookie, when one tab makes several API calls at once that each receive 401, then exactly one refresh request is sent, each call is retried once with the new token and succeeds, and no session of the user is revoked                                                                                             | Unit test `apps/web/src/lib/api.test.ts`; E2E `apps/web/e2e/session-refresh.spec.ts`               |
| SE-07.6  | Given a valid refresh cookie, when the app restores the session at start, including when the start runs twice (React StrictMode), then exactly one refresh request is sent and the status becomes signed in                                                                                                                                                          | Unit test `apps/web/src/lib/session.test.tsx`                                                      |
| SE-07.7  | Given two tabs of one browser with expired access tokens, when both call the API at once, then their refresh requests do not overlap, each presents the refresh cookie current at that moment, both calls succeed, and no session is revoked                                                                                                                         | Unit test (lock double) `apps/web/src/lib/api.test.ts`; E2E `apps/web/e2e/session-refresh.spec.ts` |
| SE-07.8  | Given the refresh endpoint answers 401, when a call or the session check needed the refresh, then the in-memory access token is dropped, the status becomes signed out in this tab and in the browser's other open tabs, the call fails with 401, and the refresh endpoint is never itself refreshed                                                                 | Unit tests `api.test.ts`, `session.test.tsx`                                                       |
| SE-07.9  | Given the network fails or the refresh endpoint answers with an error other than 401, when a call needed the refresh, then the call fails with a retryable error, this tab stays signed in and starts no further refresh for that call; after a network failure that never reached the server, the next call refreshes normally                                      | Unit test `api.test.ts`                                                                            |
| SE-07.10 | Given a refresh in flight, when the user signs out of this device, then the sign-out waits for that refresh, revokes the session it produced, and afterwards the status stays signed out and a refresh attempt fails with 401                                                                                                                                        | Unit test `session.test.tsx`; integration test `apps/api/test/auth.int-spec.ts`                    |
| SE-07.11 | Given the user signed out or signed in again after a request started, when that request's refresh or response completes, then it sets no access token and does not change the status                                                                                                                                                                                 | Unit tests `api.test.ts`, `session.test.tsx`                                                       |
| SE-07.12 | Given two tabs of one browser signed in, when the user signs out in one, then the other shows signed out within 2 seconds without a reload                                                                                                                                                                                                                           | E2E `apps/web/e2e/session-refresh.spec.ts`                                                         |
| SE-07.13 | Given a refresh token that was already used, when it is presented again, later or concurrently with its first use, then at most one of the requests receives new tokens, every other one gets 401 and no tokens, and every session and access token of the user that existed before the reuse was detected stops working (Step 2 SE-07.2 unchanged; no grace window) | Integration test `apps/api/test/auth.int-spec.ts`                                                  |

### Permissions

No new actions. Refresh stays authenticated by the refresh cookie only, logout stays available to
every signed-in role for its own session, and both are enforced on the server as in Step 2.

| Action                       | Patient  | Provider | Admin                     | Other                          | Criterion         |
| ---------------------------- | -------- | -------- | ------------------------- | ------------------------------ | ----------------- |
| Refresh own session (cookie) | Own only | Own only | No (no admin sign-in yet) | No: 401 without a valid cookie | SE-07.8, SE-07.13 |
| Sign out own session         | Own only | Own only | No (no admin sign-in yet) | No: 401 without a token        | SE-07.10          |

### Key Entities and data classification

None. The feature adds no stored field. The access token stays in memory only and the refresh
token only in the `HttpOnly` cookie (SE-07.1); nothing is written to browser storage (EN-11).
Messages between tabs carry only a sign-out signal, never a token or a user ID.

### Audit and consent

- **Audited**: None. Session refresh and logout are not audited events in Step 2 (SE-05 covers
  Restricted data and admin actions); this feature does not change that.
- **Consent**: None; no new data or purpose.

## Screens, languages and accessibility

- **Screens**: no new screens or strings. The existing signed-in and signed-out states of the app
  shell and the sample notes screen are reused; SE-07.8 and SE-07.12 switch to the existing
  signed-out state.
- **States**: unchanged; a refresh network failure shows the existing error state of the screen
  that made the call (UX-04).
- **Viewports**: behaviour is the same on 360, 768 and 1280 px; E2E runs on the existing projects.
- **Languages**: no new keys.
- **Accessibility**: no change to markup.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 50 repeated runs of the parallel-expiry scenario (five calls at once in each of two
  tabs), no run signs the user out and no session is revoked.
- **SC-002**: In every run where a used refresh token is presented again, sequentially or
  concurrently, the reuse receives no tokens and the sessions that existed before it are revoked
  (100%).
- **SC-003**: After a sign-out in one tab, every other open tab of the browser shows signed out
  within 2 seconds.

## Clarifications

### Session 2026-10-21

Resolved by the author from the review, the approved Step 2 spec and the goal brief, without an
owner question round; the owner confirms or changes each at review.

- Q: Should the server tolerate a just-rotated token for a few seconds? → A: No. Replay stays
  strict (SE-07.13); a grace window is a separate decision in the backlog.
- Q: What does the user see when the session check at start fails because of the network?
  → A: The existing signed-out state; nothing is cleared (SE-07.9, Assumptions).
- Q: Must other tabs be told about a sign-out at once, or only at their next call? → A: At once,
  within 2 seconds where the browser supports it (SE-07.12, SC-003).

## Assumptions

- **No server grace window.** Coordination is entirely in the browser. If the owner later wants
  tolerance for lost responses, that is a separate reviewed decision (backlog item), and SE-07.13
  would change in that decision's spec first.
- **One browser profile.** Tabs are coordinated within one browser profile. Two different
  browsers or devices hold different refresh tokens and do not race.
- **Offline start shows signed out.** If the session check at start fails because of the network,
  the app shows the signed-out state rather than a new "cannot check" state, so no new strings or
  screens are needed; the cookie is kept, so the next start restores the session. If this is
  wrong, a new screen state and i18n keys are needed.
- **Step 2 behaviour stays.** SE-07.1 to SE-07.4 and the refresh and logout endpoints are unchanged.

## Open questions

None.
