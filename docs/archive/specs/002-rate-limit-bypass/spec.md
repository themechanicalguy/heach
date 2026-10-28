# Feature Specification: Rate-limit bypass with fake bearer tokens

**Status**: Approved

**Step**: [Step 2 spec](../../step-specs/step-02-secure-foundation.md) of the [guideline](../../../mvp-v1-implementation-guideline.md) (security middleware, SO-08.1 and SO-08.2)

**Requirements in scope**: SO-08 (rate limits as part of DDoS protection); SE-08 (device and IP throttling, the IP part only); SO-01 (threat model, in plan.md); LM-02 (no personal data in logs); TS-01, TS-03 (test evidence)

**Approval**: Owner (Saurav Rath), 2026-10-22, explicit approval of this spec and its plan, with decisions D-1 to D-7 as written; takes effect when the owner merges this docs-only pull request

**Amended by**: [spec 007](../007-security-review-fixes/spec.md) (Approved 2026-10-24; Done, owner accepted 2026-10-25): SO-08.12 counts every request by client address as well, so SO-08.6 and SO-08.7 no longer exempt a live session from the address limit

**Created**: 2026-10-21

**Input**: User description: "Rate-limit bypass with fake bearer tokens (SO-08, SE-08; review S-1, T-3)"

## Scope

The API's rate limit (Step 2 SO-08.1) must hold no matter what a client puts in the
`Authorization` header. Today the limiter runs before authentication and counts each request
against the bearer token it carries, valid or not, so a client that sends a different random
token with each request gets a new, empty allowance every time and is never limited (finding S-1
of the 18 October 2026 codebase review, `docs/reviews/2026-10-18-codebase-review.md`, not yet
committed; confirmed on 21 October 2026: 20 requests with 20 random tokens against a limit of 5
all passed the limiter, while requests without a token got 429 after 5). This feature counts
requests by user only when the token belongs to a live session, and by client IP otherwise, so
unknown, expired, revoked and malformed tokens cannot create new allowances, and one user's many
tokens share one allowance on each route (counters stay per route, as in Step 2; decision D-6).

**Out of scope** (tracked in the [backlog](../../../backlog.md) or a later step):

- OTP rate limiting, device throttling and bot protection on sign-up, login and referral
  redemption (SE-08; Step 3, with OTP sign-in).
- Sharing counters between several API processes or hosts (review P-1). The dev host runs one API
  process (ADR 0008); a shared Redis counter is needed before a second one (see Assumptions).
- A web application firewall (Step 2 decision D3, ADR 0010).
- Changes to Caddy's edge limit (300 requests a minute per IP on `/api/*`, SO-08.2); it stays as it is.
- Separate limits per route other than the existing RUM limit, and alerts on rate-limit events
  (SO-08 anomaly alerts are covered by SO-08.3 for authorisation failures only).
- Other review findings (S-2 and the rest).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fake tokens cannot escape the limit (Priority: P1)

**Journey and role**: attacker (threat) against any API route, public or protected

An attacker floods the API from one address and puts a different made-up, expired or revoked
bearer token, or a malformed `Authorization` header, on every request. After the configured
number of requests in the window, every further request is refused with 429 until the window
passes, exactly as if no header had been sent.

**Why this priority**: the review rated it High; the public endpoints (`auth/refresh`, `rum`, and
OTP sign-in in Step 3) are unlimited today.

**Independent Test**: integration test sending more than the limit, each request with a new random
token, to a public and a protected route; count 429s and the limiter's stored entries.

**Acceptance Scenarios**:

1. **Given** one client address, **When** it sends more than the limit of requests in one window, each with a different bearer token that belongs to no live session, **Then** the requests beyond the limit get 429 (SO-08.4)
2. **Given** one client address, **When** it sends requests with malformed `Authorization` headers, **Then** they are counted by that address like requests with no header (SO-08.5)
3. **Given** any number of distinct fake tokens from one address, **When** they are sent, **Then** the limiter keeps one allowance for that address, not one per token (SO-08.8)

---

### User Story 2 - Signed-in users are limited as one user (Priority: P1)

**Journey and role**: any signed-in journey; patient or provider (and admin once it signs in)

A signed-in user's requests are counted against that user, whichever of their valid access
tokens or devices sends them. Other users at the same address (for example behind a mobile
carrier's shared address) are not slowed by them.

**Why this priority**: closes the second form of the bypass (signing in many times to collect
tokens) without punishing users who share an address.

**Independent Test**: integration test with two sessions of one user and one session of another
user from one address.

**Acceptance Scenarios**:

1. **Given** a user with several valid access tokens, **When** their requests together exceed the limit in one window, **Then** the requests beyond the limit get 429 whichever token they carry (SO-08.6)
2. **Given** two signed-in users and anonymous traffic from one address, **When** one of them is limited, **Then** the other user is not (SO-08.7)

---

### User Story 3 - Limits are honest, recover, and leak nothing (Priority: P2)

**Journey and role**: any client that hits the limit; operator reading logs

A limited client gets a plain 429 that says when to retry; after the window it is served again.
Neither the response nor the logs reveal tokens, addresses or user IDs. A client cannot choose
its own address, and a session-store outage does not switch the limit off.

**Why this priority**: the limit must be usable by honest clients and must not open a new leak
or a new way around it.

**Independent Test**: integration tests with a short window, a spoofed forwarding header and a
session store that fails.

**Acceptance Scenarios**:

1. **Given** a client over the limit, **When** it gets 429, **Then** the response has a `Retry-After` header and a generic body, and after the window its requests succeed again (SO-08.9)
2. **Given** the API behind its one proxy, **When** a client adds its own `X-Forwarded-For` values, **Then** it is still counted by the address the proxy saw (SO-08.10)
3. **Given** the session store cannot be reached, **When** a request carries a bearer token, **Then** it is counted by client address, never unlimited (SO-08.11)

---

### Edge Cases and failures

- A token that was valid when the window started is revoked or expires mid-window: later requests
  with it are counted by address (SO-08.4). The user's allowance is not merged into the address's.
- A valid token on a public route (`auth/refresh` with a leftover header): counted by user
  (SO-08.6); the route stays public.
- A valid token whose role does not match the route: counted by user, then refused with 403 by the
  authorisation guard as today (SE-02); the limit runs first.
- Routes that skip the limit today (`/healthz`, `/readyz`) keep skipping it.
- The RUM route keeps its own lower limit (60 a minute); the same counting rule applies to it.
- The API process restarts: counters start again from zero (single-process assumption; Caddy's
  edge limit still applies).
- Many users behind one shared address who are all signed out (for example opening the sign-in
  page) share that address's allowance. With today's limit (120 a minute) this is acceptable for
  the restricted pilot; the limit is configurable.
- IPv6 clients are counted per full address. Grouping by network prefix is not done here.
- Allowances are per route, as in Step 2: a client that is limited on one route can still call
  another route until it reaches N there. Caddy's 300 a minute per address bounds the total for
  any one address (decision D-6).
- The session store is slow rather than down: the request waits for the lookup, bounded by the
  Redis client (1-second connect timeout, one retry), and is then counted by user or, on error,
  by address. It is never let through uncounted while waiting (SO-08.11).

## Requirements _(mandatory)_

### Functional Requirements

These refine Step 2's SO-08.1 ("more than the configured requests per minute from one IP or user
returns 429"), which stays in force.

| ID       | Given / when / then                                                                                                                                                                                                                                                                                                                         | Proof                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SO-08.4  | Given one client address and a limit of N per window, when it sends more than N requests in one window, each with a different well-formed bearer token that resolves to no live session (random, unknown, expired or revoked), then every request after the Nth gets 429, on a public route (`auth/refresh`) and on a protected route alike | Integration test `apps/api/test/rate-limit.int-spec.ts`                                                   |
| SO-08.5  | Given one client address, when requests carry an `Authorization` header that is not a well-formed bearer token (wrong scheme, too short, bad characters, empty), then they are counted by that address exactly like requests with no header                                                                                                 | Integration test `rate-limit.int-spec.ts`                                                                 |
| SO-08.6  | Given a user with two or more valid access tokens, when their requests to one route together exceed N in one window, then every request after the Nth gets 429 whichever of the tokens it carries                                                                                                                                           | Integration test `rate-limit.int-spec.ts`                                                                 |
| SO-08.7  | Given two signed-in users and anonymous requests from one client address, when one user or the anonymous traffic exceeds N on a route, then the other user's requests to that route within N are still served                                                                                                                               | Integration test `rate-limit.int-spec.ts`                                                                 |
| SO-08.8  | Given M requests from one address each carrying a different token that resolves to no live session, when they have been handled, then the limiter holds at most one counter for that address per route and limit, not M                                                                                                                     | Unit test `apps/api/src/security/user-throttler.guard.spec.ts`; integration test `rate-limit.int-spec.ts` |
| SO-08.9  | Given a client over the limit, when it gets 429, then the response carries `Retry-After` in whole seconds no longer than the window and the standard error body with no token, address or user ID; neither the 429 nor the request log line contains them; and once the window has passed, its next request is served                       | Integration test `rate-limit.int-spec.ts` (short configured window)                                       |
| SO-08.10 | Given the API behind exactly one proxy, when a request arrives with a client-supplied `X-Forwarded-For` list, then the address used is the one the proxy appended (the last), not one the client chose; and through the deployed proxy, varying `X-Forwarded-For` and fake tokens on each request still reaches 429                         | Integration test `rate-limit.int-spec.ts`; deploy-bundle check `scripts/rate-limit-check.sh` in CI        |
| SO-08.11 | Given the session store fails when the limiter looks up a bearer token, when the request is counted, then it is counted by client address and handled as without a valid token; the limiter does not let it through uncounted                                                                                                               | Unit test `user-throttler.guard.spec.ts`                                                                  |

### Permissions

No new actions and no change to who may call what. Rate limiting applies to every route except the
health probes, before authentication and authorisation, as in Step 2 (SE-02.1 guard order).

| Action                 | Patient          | Provider         | Admin                             | Other                      | Criterion          |
| ---------------------- | ---------------- | ---------------- | --------------------------------- | -------------------------- | ------------------ |
| Call any limited route | Counted per user | Counted per user | Counted per user (no sign-in yet) | Counted per client address | SO-08.4 to SO-08.7 |

### Key Entities and data classification

None stored. The limiter keeps short-lived counters in the API process's memory, keyed by either a
user ID or a client address (both Internal; the counter key is never logged or returned) and
dropped when the window ends. No database or Redis schema changes.

### Audit and consent

- **Audited**: None. Rate-limit refusals are not audited events (SE-05 covers Restricted data and
  admin actions); the request log line records route and status 429 only.
- **Consent**: None; no new data or purpose.

## Screens, languages and accessibility

- **Screens**: none. The web app already treats a failed call as the screen's error state (UX-04);
  a 429 is shown the same way.
- **States**: unchanged.
- **Viewports**: not applicable (API only).
- **Languages**: no new keys; the 429 body is an API error, not a user-facing string.
- **Accessibility**: not applicable.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With a limit of N per window, 10 × N requests from one address, each with a new random
  token, receive at least 9 × N responses of 429 (none escape beyond the limit).
- **SC-002**: The number of limiter counters after M fake-token requests from one address stays
  constant as M grows from 10 to 1,000.
- **SC-003**: Two users and anonymous traffic sharing one address: limiting any one of them never
  causes a 429 for the others (100% of runs).

## Clarifications

### Session 2026-10-21

Resolved by the author from the review, the approved Step 2 spec and the goal brief, without an
owner question round; the owner confirms or changes each at review.

- Q: Should a signed-in request count against both its user and its address? → A: Its user only.
  Counting it against the address too would let one busy user, or anonymous traffic, limit every
  user behind a shared mobile-carrier address; Caddy's edge limit per address (300 a minute) still
  bounds any single address (SO-08.7).
- Q: Should counters move to Redis now (review P-1)? → A: No. One API process runs on the dev host
  (ADR 0008), so in-memory counters are exact there, need no new code path that can fail, and
  need no dependency. Moving them is required before a second API process and is listed in the
  backlog (see Assumptions). Recorded as decision D-1 in plan.md for the owner to confirm.
- Q: What happens when the session store (Redis) cannot be reached during the lookup? → A: The
  request is counted by address (fail closed to the stricter key); the request then fails or
  succeeds as it does today (SO-08.11).
- Q: One threshold or separate ones for users and addresses? → A: One, the existing
  `RATE_LIMIT_PER_MINUTE` (Step 2 SO-08.1 names one configured number). A window setting is added
  so tests can prove recovery quickly; its default stays one minute.
- Q: Is the allowance per route or one across the whole API? → A: Per route, unchanged from
  Step 2 (the throttler counts per controller handler). One allowance across all routes would let
  a busy route such as RUM block sign-in for the same user; Caddy already bounds each address
  across all `/api/*` routes. Added at the 22 October review as decision D-6 for the owner.
- Q: Which address is trusted? → A: The one Caddy appends. The API trusts exactly one proxy hop
  (`trust proxy 1`, unchanged); Caddy is the only way in on the dev host (ADR 0008) and does not
  pass on client-supplied forwarding headers as trusted.

## Assumptions

- **One API process per environment.** Counters live in that process and reset when it restarts.
  Before running a second API process or host, counters move to a shared store (review P-1,
  backlog); until then SO-08.4 to SO-08.11 hold per process.
- **One proxy hop.** Caddy is the only route to the API, and the API trusts exactly one hop. If a
  load balancer or CDN is added in front of Caddy (pilot, ADR 0008 replacement), the trusted hop
  count changes with it in that change's spec.
- **Same limit as today.** `RATE_LIMIT_PER_MINUTE` keeps its default (120) and its meaning; the RUM
  route keeps its 60. Tuning for the pilot is an operations decision, not this feature.
- **Step 2 behaviour stays.** SO-08.1 to SO-08.3, the guard order (rate limit, then authentication
  and roles) and the health probes' exemption are unchanged.

## Open questions

None.
