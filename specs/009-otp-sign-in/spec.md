# Feature Specification: OTP sign-up and sign-in, language choice and sessions

**Status**: Draft

**Step**: [Step 3 spec](../../docs/specs/step-03-accounts-onboarding.md) of the [guideline](../../docs/mvp-v1-implementation-guideline.md), slice 3.1

**Requirements in scope**: AC-01, AC-02, AC-05 (session persistence; the re-verification primitive), SE-07 (OTP issue and verify, protected routes, safe return paths), SE-08 (OTP, number, device and address throttling), SE-02 (own account only), EN-09 (mobile lookup by blind index), NT-01 (OTP SMS), LM-06 and LM-07 (OTP delivery metric and alert), UX-04, UX-05

**Approval**:

**Created**: 2026-10-28

**Input**: Step 3 charter slice 3.1 and decisions D3-1, D3-2, D3-5, D3-6, D3-9, D3-12; owner's instruction of 28 October 2026 ([progress page](../../docs/step-3-login-progress.md)); visual reference `apps/web/design-mockups.html` (see Screens).

## Scope

Patients and providers create an account and sign in with an Indian mobile number and a six-digit
code sent by SMS; there is no password (AC-01). A first-time visitor chooses Odia, English or Hindi
before anything else, and the choice follows the account (AC-02). The session persists on the
device and ends safely (AC-05, SE-07), and any later feature can ask the user to prove the number
again before a sensitive action (the re-verification primitive). On first sign-in the user says
whether they need care or provide care; the server records that answer for routing only and
grants no provider privilege from it.

**Out of scope**:

- Linked patients, representatives, provider applicant and provider roles, role switching (slice
  3.2). Sign-up and identity consent records (3.3): until 3.3 merges, this feature stays behind
  its flag on local, test and dev only, so no one outside the team creates an account.
- Provider onboarding, save and resume, verification states (3.5 to 3.7, 3.10). Admin sign-in and
  MFA (3.9). Payout and deletion screens that consume re-verification (3.8, 3.12).
- The real SMS provider adapter: it needs the DLT registration and provider contract (FU-09,
  #20). This feature ships the port and its fake; the real-SMS exit criterion stays Partial.
- CAPTCHA or another third-party bot check (D3-6).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A new person creates an account with their mobile number (Priority: P1)

**Journey and role**: entry to J1 (provider) and J2 to J9 (patient); anonymous visitor

A visitor opens the app for the first time, picks a language, enters their mobile number, receives
a code by SMS, types it (or the phone fills it in), and is signed in to a new account. They answer
one question, "I need care" or "I provide care", and land on the right home.

**Why this priority**: nothing else in Step 3 can be used or tested without an account.

**Independent Test**: on a fresh database with the SMS fake, an E2E test completes the flow in
Odia and English at 360, 768 and 1280 px and ends signed in.

**Acceptance Scenarios**:

1. **Given** no language chosen, **When** the visitor opens any page, **Then** the language choice appears first (AC-02.1)
2. **Given** a valid number never seen before, **When** the visitor asks for a code and enters it, **Then** a new account exists and the visitor is signed in (AC-01.1)
3. **Given** a first sign-in, **When** the user picks "I provide care", **Then** the answer is stored and the user still holds only the patient role (AC-01.5)

---

### User Story 2 - A returning user signs in, and the session lasts (Priority: P1)

**Journey and role**: every journey; patient or provider applicant

A returning user enters the same number and code and reaches their own account, in their saved
language. Closing and reopening the browser keeps them signed in until the session ends; when it
ends, they are sent to sign-in and come back to the page they wanted.

**Why this priority**: re-entering an OTP on every visit would lose low-literacy users (UX).

**Independent Test**: integration tests over the API and an E2E test that reloads the browser,
expires the session and follows the return path.

**Acceptance Scenarios**:

1. **Given** an existing account, **When** its number signs in, **Then** the same account is opened and no second account is created (AC-01.2)
2. **Given** a signed-in user, **When** they close and reopen the app within the session lifetime, **Then** they are signed in without a new code (AC-05.1)
3. **Given** an ended session, **When** the user opens a protected page, **Then** they see sign-in with a notice and return to that page after signing in (AC-05.2, SE-07.24)

---

### User Story 3 - Abuse of codes is stopped (Priority: P1)

**Journey and role**: anonymous attacker or a user who mistypes

Wrong, old, reused and over-requested codes are refused in a way that does not reveal whether a
number has an account, and that cannot be used to send floods of SMS.

**Why this priority**: SE-08 and the charter threat model (brute force, SMS pumping, enumeration).

**Independent Test**: API integration tests with a controllable clock and the SMS fake.

**Acceptance Scenarios**:

1. **Given** a code older than its validity, **When** it is entered, **Then** it is refused (SE-08.1)
2. **Given** the attempt limit reached, **When** the right code is entered, **Then** it is refused (SE-08.2)

---

### User Story 4 - The user proves the number again before a sensitive action (Priority: P2)

**Journey and role**: signed-in patient or provider; consumed by 3.8 (payout details) and 3.12 (deletion)

A route marked sensitive refuses a request until the user has entered a fresh code sent to their
own number in the same session, for that purpose, within the last few minutes.

**Why this priority**: AC-05 and SE-07 require it; 3.8 and 3.12 build on it.

**Independent Test**: integration test with a test-only module that registers one sensitive route.

**Acceptance Scenarios**:

1. **Given** no fresh re-verification, **When** a sensitive route is called, **Then** it is refused with a code that tells the app to ask for one (AC-05.3)

---

### User Story 5 - Tests get codes without a test back door (Priority: P3)

**Journey and role**: developer and CI

End-to-end tests read the code the SMS fake "sent" through a route that exists only where test
sign-in exists today, behind the same gate. The Step 2 test sign-in and its synthetic users are
then removed.

**Why this priority**: charter D3-9; removes a sign-in path that bypasses OTP.

**Independent Test**: the gate tests of spec 007, re-pointed to the outbox route.

**Acceptance Scenarios**:

1. **Given** dev without the loopback key, or staging or production, **When** the outbox is called, **Then** it answers 404 (SE-07.25)

---

### Edge Cases and failures

- A number that is not a 10-digit Indian mobile number (after removing spaces, a leading 0 or
  +91): refused before any SMS, with a field error; the input is kept (AC-01.4, UX-05.1).
- A wrong code: an error with the attempts left; the code field is cleared, the number is kept
  (SE-08.2, UX-05.1).
- A code used once already, or one replaced by a resend: refused as wrong (SE-08.3, SE-08.4).
- Resend before the cooldown: the button stays disabled with a countdown; a direct call is refused
  with the seconds to wait (SE-08.4).
- Too many requests for one number, device or network address: refused with a "try again later"
  message and no SMS; the same for numbers with and without an account (SE-08.5, AC-01.3).
- The SMS adapter fails or times out: the user sees "could not send, try again"; the request is
  not counted against the resend cooldown; the failure is counted for the OTP alert (NT-01.2,
  LM-07.2).
- Offline: sending and verifying are disabled with the offline message; the typed number is kept
  (UX-04.2).
- The verify page is reloaded: the code entry cannot continue without the number, which is kept
  only in memory; the user returns to number entry (UX-04.2).
- Two tabs: signing in or out in one tab updates the other (spec 001 behaviour, unchanged).
- A return path to another site, a protocol-relative path or an unknown route: ignored; the user
  lands on their home (SE-07.24).
- A browser that sends `role`, `roles`, `userId` or `status` in a request body: refused with 400,
  nothing stored (AC-01.5, AC-01.6).
- Refresh cookie expired, revoked or replayed: existing Step 2 behaviour (SE-07.2, SE-07.16) and
  the session-ended notice (AC-05.2).

## Requirements _(mandatory)_

### Functional Requirements

| ID       | Given / when / then                                                                                                                                                                                                                                                                                                                | Proof                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| AC-01.1  | Given a valid number with no account, when a code is requested and the right code is verified within its validity, then one account is created with the patient role, the chosen language and status Active, a session is issued as in SE-07.1, and the response says the account is new                                           | Integration `otp-sign-in.int-spec.ts`; E2E `sign-in.spec.ts`                            |
| AC-01.2  | Given a number with an account, when it signs in again, written with or without +91, 0 or spaces, then the same account is opened, no account is created, and its last sign-in time is updated                                                                                                                                     | Integration                                                                             |
| AC-01.3  | Given any valid number, when a code is requested, then the response status and body are the same whether or not the number has an account, and the server-side handling time differs by less than 50 ms at the 95th percentile over 200 requests                                                                                   | Integration (statistical test)                                                          |
| AC-01.4  | Given input that is not a 10-digit number starting 6 to 9 after removing spaces, a leading 0 or +91, when a code is requested, then 400 with a field error is returned and no SMS is sent                                                                                                                                          | Unit (normaliser) and integration                                                       |
| AC-01.5  | Given a first sign-in, when the user answers "I need care" or "I provide care", then the answer is stored as the sign-up intent and decides the landing page only; the account holds the patient role and no other, and a request that names a role, roles, user ID or status is refused with 400 and changes nothing              | Integration (privilege escalation cases); E2E                                           |
| AC-01.6  | Given a signed-in user, when they read or change their account, then only their own account is returned or changed; only the preferred language and a not-yet-given sign-up intent can be changed; the mobile number is returned masked to its last four digits                                                                    | Integration; authorisation matrix                                                       |
| AC-02.1  | Given no language cookie and no signed-in account, when any page is opened, then the language choice is shown first, with Odia first and each language named in its own script, and the choice is kept in a cookie for one year                                                                                                    | E2E; unit                                                                               |
| AC-02.2  | Given a signed-in user, when they change the language from any screen, then the account's preferred language is updated and a later sign-in on another device opens in it                                                                                                                                                          | Integration; E2E                                                                        |
| AC-05.1  | Given a signed-in user, when the browser is closed and reopened within the refresh lifetime (30 days, SE-07), then the app restores the session from the refresh cookie without a code                                                                                                                                             | E2E (new browser context with the stored cookie)                                        |
| AC-05.2  | Given a session that ended (expired, signed out elsewhere, revoked), when the user opens or uses a protected page, then they are sent to sign-in with a "your session ended" notice, nothing from the protected page is shown, and the page sets no-store                                                                          | E2E; unit (redirect builder)                                                            |
| AC-05.3  | Given a route marked sensitive for a purpose, when it is called without a re-verification for that purpose made in the same session within 5 minutes, then it answers 403 with the code `reverification_required`; after the user verifies a fresh code sent to their own number, one call succeeds and the grant is spent         | Integration (test-only module); unit (guard)                                            |
| SE-07.24 | Given a protected page and no session, when it is opened, then the user is redirected to sign-in in the same language with the page as the return path; after sign-in they land there only if it is a path on this app under a known locale, never another origin, a protocol-relative path, a backslash path or an encoded scheme | Unit (return-path check, table of hostile inputs); E2E                                  |
| SE-07.25 | Given the SMS fake, when the code outbox is read, then it answers only where test sign-in answers today (local and test; dev with the loopback key, SE-07.23) and 404 elsewhere; the test sign-in route, its adapter and its synthetic users are removed, and no environment can sign in without a code                            | Unit and integration (gate tests re-pointed from spec 007); `test-login` route 404 test |
| SE-08.1  | Given a code issued more than 5 minutes ago, when it is verified, then it is refused and the user must request a new one                                                                                                                                                                                                           | Integration (clock)                                                                     |
| SE-08.2  | Given 5 wrong codes for one challenge, when any further code is verified, including the right one, then it is refused and the challenge is ended; the user sees how many attempts are left before that                                                                                                                             | Integration                                                                             |
| SE-08.3  | Given a code that was verified once, when it is verified again, then it is refused                                                                                                                                                                                                                                                 | Integration                                                                             |
| SE-08.4  | Given a challenge issued less than 30 seconds ago, when a resend is requested, then it is refused with the seconds to wait; after 30 seconds a resend ends the previous challenge, whose code no longer works                                                                                                                      | Integration                                                                             |
| SE-08.5  | Given the caps per number (5 per hour, 10 per day), per device cookie (10 per hour) and per network address (20 per hour), when a request would exceed one, then 429 is returned with a retry time and no SMS is sent; the caps hold across API restarts                                                                           | Integration (restart between requests)                                                  |
| SE-08.6  | Given any challenge, when it is stored, then only a keyed hash of its code is kept; the code is never in the database, a log line, an API response or an error, and the mobile number never in a log line, URL or error                                                                                                            | Integration scans database rows and captured logs after the E2E-equivalent API flow     |
| EN-09.3  | Given an account, when it is stored, then its mobile number is ciphertext under the identity domain key and found only by its blind index; the blind index is unique                                                                                                                                                               | Integration (`crypto.int-spec.ts` pattern; classification check)                        |
| NT-01.1  | Given a code request, when the SMS is sent, then it goes through the `SmsSender` port with a template for the user's language holding only the code, the app name and the validity, and nothing else personal                                                                                                                      | Unit (template); integration (fake records template and params)                         |
| NT-01.2  | Given the SMS adapter fails or takes longer than 10 seconds, when a code is requested, then the user gets a retryable error, the attempt does not start the resend cooldown, and the failure is counted                                                                                                                            | Integration (failing fake)                                                              |
| LM-06.1  | Given code requests, when they are sent, then counters of OTP sent, delivered by the adapter, failed and verified are emitted without numbers or codes                                                                                                                                                                             | Integration (metrics read)                                                              |
| LM-07.2  | Given OTP send failures above 20% of at least 20 requests in 10 minutes, when the monitor runs, then one alert is published through the existing alert publisher with counts only                                                                                                                                                  | Unit (monitor, existing error-rate pattern)                                             |
| SE-02.4  | Given each account route, when it is called anonymously, with another user's token, or with the admin role, then it answers 401 or 403 as the authorisation matrix says and never another user's data                                                                                                                              | Integration (`authz-matrix.int-spec.ts` rows)                                           |
| UX-04.2  | Given each new screen, when it is loading, failing or offline, then it shows the shared loading, error-with-retry and offline states, and the error is announced to screen readers                                                                                                                                                 | Component tests; E2E offline case                                                       |
| UX-05.2  | Given the number field and the code field, when used on a phone, then the number uses a telephone keypad with `tel-national` autofill and a fixed +91 prefix; the code uses a numeric keypad with `one-time-code` autofill (and the WebOTP API where the browser has it); input is kept on error                                   | Component tests; E2E                                                                    |

### Permissions

| Action                                       | Patient                    | Provider                   | Admin                          | Other                                | Criterion        |
| -------------------------------------------- | -------------------------- | -------------------------- | ------------------------------ | ------------------------------------ | ---------------- |
| Request or verify a sign-in code             | Yes (anonymous)            | Yes (anonymous)            | No: admins sign in through 3.9 | Anonymous, throttled                 | SE-08.5          |
| Read own account (`GET /v1/me`)              | Own only                   | Own only                   | No                             | No                                   | AC-01.6, SE-02.4 |
| Change own language or give sign-up intent   | Own only                   | Own only                   | No                             | No                                   | AC-01.6, SE-02.4 |
| Set a role, user ID, status or mobile number | No                         | No                         | No (3.2, 3.9)                  | No                                   | AC-01.5          |
| Request and verify re-verification           | Own number only, signed in | Own number only, signed in | No                             | No                                   | AC-05.3          |
| Read the SMS fake outbox                     | No                         | No                         | No                             | Tests only, behind the SE-07.23 gate | SE-07.25         |

"Provider" here means a signed-in user whose intent is "I provide care"; until 3.2 and 3.10 they
hold the patient role only.

### Key Entities and data classification

| Entity          | Field                                                 | Class        | Retention                                       | Notes                                                                             |
| --------------- | ----------------------------------------------------- | ------------ | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| UserAccount     | mobile number                                         | Confidential | Until account deletion (PR-04, 3.12)            | Field-encrypted under the identity domain; blind index for lookup (D3-2, EN-09.3) |
| UserAccount     | mobile blind index                                    | Internal     | As above                                        | Keyed hash; unique                                                                |
| UserAccount     | preferred language                                    | Internal     | As above                                        | `or`, `en`, `hi`                                                                  |
| UserAccount     | sign-up intent                                        | Internal     | As above                                        | `care`, `provide`; routing only                                                   |
| UserAccount     | status, created, last sign-in                         | Internal     | As above                                        | Status `active` in this feature; `suspended`, `deleted` come with 3.10 and 3.12   |
| RoleAssignment  | role, granted by, granted at                          | Internal     | As above                                        | Patient on creation; other roles in 3.2                                           |
| OtpChallenge    | purpose, code hash, attempts, created, expires, ended | Internal     | Deleted 24 hours after it ends                  | Keyed hash only (SE-08.6); `sign_in` or `reverify:<purpose>`                      |
| OtpChallenge    | mobile blind index                                    | Internal     | As above                                        | Never the number itself                                                           |
| Device          | device identifier                                     | Internal     | Cookie for one year; throttle counters 24 hours | Random; throttling only                                                           |
| Language cookie | locale                                                | Public       | One year                                        | Before sign-in only                                                               |

### Audit and consent

- **Audited** (SE-05, existing hash-chained log): `account.created`, `auth.sign_in`,
  `auth.sign_out`, `auth.sign_out_all`, `auth.reverified` (purpose), `account.language_changed`,
  `account.intent_given`; actor is the account, object its ID. Never the number or the code.
  Failed and throttled code requests are metrics (LM-06.1), not audit entries, so a flood cannot
  fill the audit log.
- **Consent**: none captured here. Sign-up consent (PR-01) is slice 3.3; the feature flag keeps
  sign-up to local, test and dev until it merges (D3-8, D3-12).

## Screens, languages and accessibility

- **Visual reference**: `apps/web/design-mockups.html` (owner's instruction names commit
  `d82d707`; see the [progress page](../../docs/step-3-login-progress.md#design-reference)). It has
  no sign-in boards, so these screens follow its patterns: bilingual heading (chosen language,
  then the other script below it), white bordered cards, lavender primary pill button pinned at
  the bottom on phones, globe language control top right, peach notices. Each screen is compared
  with the nearest board (Onboarding A for single-step screens, Home A for the account home) at
  360 px and recorded in the tasks evidence.
- **Screens** (`apps/web`, under `/{locale}`):
  - `/welcome` language choice: three large tiles, Odia first, each in its own script.
  - `/sign-in` mobile number, fixed +91; `/sign-in` code step in the same route (the number never
    enters a URL), six-digit field, resend countdown, "change number".
  - `/get-started` the one question on first sign-in: two large tiles with icons and text.
  - `/account` signed-in home of this slice: masked number, language, sign out, sign out of all
    devices. Provider intent adds a notice that the provider application opens in a later
    release (replaced by 3.5).
  - The session-ended notice on `/sign-in`.
- **States**: loading, empty, error with retry and offline for each screen (UX-04.2), from
  `packages/ui` `States`.
- **Viewports**: 360, 768 and 1280 px (UX-02); one column, centred card from 768 px.
- **Languages**: every new key in Odia, English and Hindi; SMS templates per language; text
  expansion 40% (I18N-06); the new Odia keys join the native review (FU-07 pattern).
- **Accessibility**: WCAG 2.2 AA; labels on every field; errors linked to their field and
  summarised; countdown announced politely, not every second; targets at least 44 px (A11Y).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new user completes language choice, number, code and the one question in under
  90 seconds at the 75th percentile in the moderated test on a mid-range phone over a throttled
  network (guideline rule; recorded in the Step 3 usability test).
- **SC-002**: Across the whole integration and E2E run, 0 synthetic mobile numbers and 0 codes
  appear in captured logs, URLs and error bodies.
- **SC-003**: The new pages stay within the existing bundle and Lighthouse budgets (PF-02, PF-03,
  PF-06).

## Assumptions

- The OTP values (5 minutes, 5 attempts, 30-second resend, caps per number, device and address)
  are the charter's D3-5 proposals; the owner confirms or changes them (Q3-8). Only configuration
  changes if they move.
- One account per number holds the patient role and, later, one provider role (D3-1). If the owner
  decides a provider must not hold the patient role, AC-01.1 and AC-01.5 change.
- The SMS fake stands in until the provider is contracted (#20); real delivery is a Step 3 exit
  item, not this feature's.

## Open questions

| Question                                                                                                                                                                  | Blocks                              | Owner |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----- |
| Confirm the OTP values and caps in D3-5 (charter Q3-8)                                                                                                                    | SE-08.1, SE-08.2, SE-08.4, SE-08.5  | Owner |
| Confirm D3-1, D3-2 and D3-9 as proposed (charter Q3-9), including that every new account gets the patient role                                                            | AC-01.1, AC-01.5, EN-09.3, SE-07.25 | Owner |
| Removing the test sign-in changes how SE-07.4 (Step 2) and SE-07.23 (spec 007) are proved. Approve re-pointing their proofs to the outbox route (criteria text unchanged) | SE-07.25                            | Owner |
| The charter removes `app.user_test` in slice 3.0, but sessions and test sign-in depend on it until this slice. Move its removal to this slice (proposal in the plan)      | SE-07.25                            | Owner |
