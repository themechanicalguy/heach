# Implementation Plan: OTP sign-up and sign-in, language choice and sessions

**Status**: Draft

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-28 | **Approval**:

**Input**: Feature specification from `specs/009-otp-sign-in/spec.md`

## Summary

A new `accounts` module in `apps/api` owns `UserAccount`, `RoleAssignment` and `OtpChallenge`. A
code request normalises the number, checks Redis throttle counters, ends any open challenge for
that number, stores a new challenge with an HMAC of its code, and sends the code through the
existing `SmsSender` port. Verifying finds the challenge by the number's blind index, checks
expiry, attempts and the hash in constant time, then creates or finds the account and calls the
existing `SessionService` to issue tokens, so refresh rotation, replay detection and sign-out
(SE-07.1 to SE-07.23) are reused unchanged. The session's role comes from `RoleAssignment`, never
from the request. Re-verification reuses the same challenge table with a purpose bound to the
session and leaves a single-use grant in Redis that a `@Reverified(purpose)` guard spends.

On the web, a new `(auth)` group of pages uses `packages/ui` (`TextField`, `OtpField`, `Button`,
`Card`, `States`), the existing `lib/api.ts` session functions and `lib/session.tsx`, and a
`requireSession` helper that builds safe return paths. The proxy sends a first visit with no
language cookie to `/{locale}/welcome`. The refresh cookie is scoped to `/api/v1/auth`, so page requests carry
no session: protected pages render a skeleton and no account data until the client restores the
session, and `requireSession` redirects in the browser when it cannot (AC-05.2, SE-07.24).

The Step 2 `app.user_test` table, test sign-in route, adapter and synthetic users are removed in
this feature (spec open question 4): the session's foreign key moves to `app.user_account`, and
E2E tests sign in through the SMS fake's outbox behind the existing `TestLoginGate`.

## Technical Context

**Apps and packages touched**: `apps/api` (new `accounts` module; `auth` module changes; adapters;
migrations; observability), `apps/web` (pages, proxy, session helpers), `packages/i18n` (keys and
SMS templates), `packages/flags` (one flag), `packages/types` (generated client).

**New dependencies**: None. HMAC and HKDF from `node:crypto`; envelope encryption and blind index
from `@heach/crypto`; throttle counters in the existing Redis; WebOTP is a browser API.

**Storage**: PostgreSQL tables `app.user_account`, `app.role_assignment`, `app.otp_challenge`;
`app.session.user_id` re-pointed. Redis keys `otp:n:{bidx}:h|d`, `otp:d:{device}:h`,
`otp:a:{addr}:h`, `otp:cool:{bidx}`, `reverify:{sessionId}:{purpose}`.

**Third parties**: SMS through `SmsSender` (`apps/api/src/adapters/sms.port.ts`) and its fake
(`fakes.ts`), extended with an outbox. The real adapter waits for #20 (FU-09).

**Constraints**: single India Region (ap-south-1), lean host (ADR 0008): no new service. One API
process today (FU-25); throttle counters live in Redis so they hold across restarts and a second
process.

## Constitution Check

_GATE: Must pass before research. Re-check after design._

| Principle                               | How this plan meets it                                                                                                                                                                                      | Violation and justification  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| I Spec before code                      | Docs-only PR; code waits for spec and plan Approved, entry conditions E1, E2 (spec 008 merged) and E3 (owner's written exception)                                                                           | None                         |
| II Traceable criteria                   | Every criterion in spec.md has a test title or manual check in Verification                                                                                                                                 | None                         |
| III Data protection                     | Mobile number field-encrypted (identity domain) with a blind index; code kept only as HMAC; own-account routes only; audit events listed; threat model below. Sign-up consent waits for 3.3 behind the flag | None                         |
| IV Synthetic data, logs, secrets        | Synthetic numbers `98765 4xxxx` in tests; log scan (SE-08.6, SC-002); spec 008 merged first; OTP HMAC key derived from the existing blind-index root secret, no new secret in code                          | None                         |
| V Languages, accessibility, performance | Keys in or, en, hi; SMS templates per language; axe in E2E at three viewports; budgets unchanged                                                                                                            | None                         |
| VI Architecture, reuse, dependencies    | Reuses `SessionService`, `AuthGuard`, `TestLoginGate`, `SmsSender`, `@heach/crypto`, `AuditService`, `ErrorRateMonitor` pattern, `packages/ui`; no dependency                                               | None                         |
| VII Evidence-based completion           | Status page updated in the code PR; real SMS stays Partial                                                                                                                                                  | None                         |
| VIII Changes and exceptions             | Removing test sign-in changes how SE-07.4 and SE-07.23 are proved; the spec lists it as an open question for the owner; criteria text unchanged                                                             | None, once the owner answers |
| IX Humans approve                       | Agent leaves Status Draft; owner approves by PR comment                                                                                                                                                     | None                         |

## Project Structure

### Documentation (this feature)

```text
specs/009-otp-sign-in/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── accounts-api.md
├── checklists/
│   ├── requirements.md
│   └── security.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/migrations/0003_user_accounts.sql
apps/api/src/accounts/
├── accounts.module.ts
├── mobile-number.ts            # normalise and validate (pure)
├── otp-code.ts                 # generate, HMAC, constant-time compare (pure)
├── otp-throttle.service.ts     # Redis counters and cooldown
├── otp-challenge.repository.ts
├── user-account.repository.ts  # encrypt, blind index, role assignment
├── otp.service.ts              # request, verify, re-verify
├── otp.controller.ts           # /v1/auth/otp, /v1/auth/otp/verify, /v1/auth/reverify*
├── me.controller.ts            # GET, PATCH /v1/me
├── reverified.guard.ts         # @Reverified(purpose)
├── otp-failure.monitor.ts      # LM-07.2
└── *.spec.ts
apps/api/src/adapters/fakes.ts           # FakeSmsSender outbox
apps/api/src/auth/                       # session.repository role lookup; test-login removed
apps/api/test/otp-sign-in.int-spec.ts, reverify.int-spec.ts, authz-matrix.int-spec.ts (rows)
apps/web/src/app/[locale]/welcome/page.tsx
apps/web/src/app/[locale]/sign-in/page.tsx       # replaces TestSignIn
apps/web/src/app/[locale]/get-started/page.tsx
apps/web/src/app/[locale]/account/page.tsx
apps/web/src/components/auth/                    # NumberStep, CodeStep, IntentChoice
apps/web/src/lib/return-path.ts                  # safe return path (pure)
apps/web/src/proxy.ts                            # first-visit language redirect
apps/web/e2e/sign-in.spec.ts
packages/i18n/src/messages/{or,en,hi}.json
packages/flags/src/index.ts                      # 'otp-sign-in'
```

## Data model and migrations

Detail in [data-model.md](data-model.md). Migration `0003_user_accounts.sql`:

1. Create `app.user_account`, `app.role_assignment`, `app.otp_challenge`, each column with its
   `class=` comment (DC-01.1, checked by `check-classification.ts`).
2. `app.session.user_id`: drop the foreign key to `app.user_test`, revoke every existing session
   (they belong to synthetic test users), add the foreign key to `app.user_account`.
3. Drop `app.user_test` only if `app.patient_note` is already gone (slice 3.0); otherwise drop
   `patient_note`'s foreign key to it and leave the table for 3.0 to drop with the notes. The
   migration checks which case applies.

Down migration: recreate `app.user_test` with the four synthetic rows and point sessions back;
the three new tables are dropped. Accounts are synthetic on every environment where this runs
(the flag is off elsewhere), so a down migration loses no real data. Restore rehearsal (EN-10.1)
covers the new tables through the existing restore check.

## Encryption and keys

| Value                                            | Treatment                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile number (Confidential, encrypted per D3-2) | `FieldEncryptor.encrypt(number, 'identity')` into `app.encrypted_field`; `BlindIndexer.index('identity', '+91' + digits)` into `mobile_bidx` (unique). The normalised E.164 form is the only input to both                                                       |
| OTP code                                         | Six digits from `crypto.randomInt(0, 1_000_000)`, zero-padded. Stored as `HMAC-SHA-256(otpKey, challengeId + ':' + code)`; compared with `timingSafeEqual`. `otpKey = HKDF(blind-index root, 'heach-otp-code', 32)`: the existing secret, a separate derived key |
| Device identifier                                | 128 random bits, HttpOnly, Secure, SameSite=Strict cookie `heach_device`, path `/api/v1/auth`                                                                                                                                                                    |

`BlindIndexer` is wired into the API's crypto module for the first time here; the root key
already exists for EN-09.1.

## API contracts

Detail in [contracts/accounts-api.md](contracts/accounts-api.md). All under `/api/v1`; every route
declares `@Public(reason)` or `@Roles` (SE-02.1); DTOs use `whitelist` and
`forbidNonWhitelisted`, so unknown fields such as `role` are 400.

| Method and path                 | Roles allowed                                              | Request                                                 | Response                                                                               | Errors                                                               |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /v1/auth/otp`             | Public, throttled                                          | `mobile`, `locale`                                      | 202 `{ challengeId, resendAfter, expiresIn }`, identical for known and unknown numbers | 400 field error; 429 `retryAfter`; 503 `sms_unavailable`             |
| `POST /v1/auth/otp/verify`      | Public, throttled                                          | `challengeId`, `code`                                   | 200 `{ accessToken, expiresIn, isNewAccount }`; refresh cookie as today                | 400; 401 `code_invalid` with `attemptsLeft`; 410 `code_expired`; 429 |
| `POST /v1/auth/reverify`        | patient                                                    | `purpose`                                               | 202 as above; code to the account's own number                                         | 400 unknown purpose; 429; 503                                        |
| `POST /v1/auth/reverify/verify` | patient                                                    | `challengeId`, `code`                                   | 204; grant stored for this session and purpose for 5 minutes                           | 401, 410 as above                                                    |
| `GET /v1/me`                    | patient                                                    | none                                                    | `{ id, mobileLast4, preferredLanguage, signupIntent, roles, createdAt }`               | 401                                                                  |
| `PATCH /v1/me`                  | patient                                                    | `preferredLanguage?`, `signupIntent?` (only while null) | 200 as `GET`                                                                           | 400 including any other field; 409 intent already given              |
| `POST /v1/test/sms-outbox`      | Gate of SE-07.23 only (local, test; dev with loopback key) | `mobile` in the body, never the URL                     | `{ code, templateId }` of the latest message                                           | 404 everywhere else                                                  |
| `POST /v1/auth/test-login`      | Removed                                                    |                                                         |                                                                                        | 404                                                                  |

`patient` is the only signed-in role in this feature (AC-01.5); 3.2 widens these routes to the
roles it adds. Admin tokens get 403 on `/v1/me` (SE-02.4).

## Audit, logging and monitoring

- **Audit** through `AuditService.record` in the same transaction as the change (spec 003):
  `account.created`, `auth.sign_in`, `auth.reverified`, `account.language_changed`,
  `account.intent_given`. `auth.sign_out` and `auth.sign_out_all` are added in `SessionService`.
  Entity `user_account`, entity ID the account ID; no other field.
- **Logs** through `appLogger` only: events `otp_requested`, `otp_throttled` (which cap),
  `otp_verified`, `otp_failed` (reason), `sms_send_failed` (adapter error class). No number, no
  code, no challenge ID with a number. Spec 008's masking is the second line of defence.
- **Metrics** (LM-06.1): OpenTelemetry counters `heach.otp.requested`, `.sent`, `.send_failed`,
  `.verified`, `.verify_failed{reason}`, `.throttled{cap}`.
- **Alert** (LM-07.2): `OtpFailureMonitor` copies `ErrorRateMonitor`'s window logic: send
  failures above 20% of at least 20 requests in 10 minutes publish one alert with counts.

## Threat model

| Threat                                                                       | Mitigation                                                                                            | Criterion                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------- |
| Spoofing: brute force of a code                                              | 6 digits, 5 attempts per challenge, 5-minute validity, one live challenge per number, per-number caps | SE-08.1, SE-08.2, SE-08.5 |
| Spoofing: replay of a used or replaced code                                  | Challenge ended on success or resend                                                                  | SE-08.3, SE-08.4          |
| Denial of service and cost: SMS pumping to many or premium numbers           | Indian mobile numbers only; caps per number, device and address held in Redis; cooldown               | AC-01.4, SE-08.5          |
| Information disclosure: enumeration of registered numbers                    | Same response and timing for request; "new account" known only after a correct code                   | AC-01.3                   |
| Information disclosure: code or number in logs, URLs, errors or the database | HMAC only; number encrypted with blind index; number never in a URL; log scan                         | SE-08.6, EN-09.3, SC-002  |
| Elevation of privilege: browser sets its own role or another user's ID       | Roles read from `RoleAssignment`; DTO whitelist refuses extra fields; no user ID in any route         | AC-01.5, AC-01.6          |
| Elevation of privilege: one user reads or changes another account            | `/v1/me` resolves only the caller; authorisation matrix rows                                          | SE-02.4                   |
| Spoofing: open redirect after sign-in used for phishing                      | Return path allow-list: same origin, known locale, no `//`, `\` or scheme                             | SE-07.24                  |
| Spoofing: test back door reaches a shared environment                        | Test sign-in removed; outbox behind the SE-07.23 gate, absent outside local, test and dev             | SE-07.25                  |
| Spoofing: stolen session used for a sensitive change                         | Re-verification grant bound to session and purpose, 5 minutes, single use                             | AC-05.3                   |
| Tampering: sign-in on a shared phone left open                               | Sign out and sign out of all devices on the account page (SE-07.3); session-ended notice              | AC-05.2                   |
| Repudiation: user denies an account change                                   | Audit entries for each change                                                                         | AC-01.1, AC-02.2          |

## Rollout

- Flag `otp-sign-in` in `@heach/flags`, allowed in `local`, `test`, `dev`; off in `staging` and
  `production` until slice 3.3 (consent) merges and the owner decides (D3-12). With the flag off
  the OTP routes and pages answer 404.
- Migration `0003` runs with the deploy; it revokes existing synthetic sessions on dev, so the
  team signs in again.
- No infrastructure change, no cost. The real SMS adapter and its parameters arrive in their own
  spec when #20 is contracted.
- Turning it off: unset the flag; the data stays.

## Verification

| Criterion          | Proof                                                                                                           | Where                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| AC-01.1            | `AC-01.1 creates one account with the patient role and a session`                                               | `apps/api/test/otp-sign-in.int-spec.ts`; E2E `AC-01.1` in `apps/web/e2e/sign-in.spec.ts`                               |
| AC-01.2            | `AC-01.2 signs in the same account for every way of writing the number`                                         | `otp-sign-in.int-spec.ts`                                                                                              |
| AC-01.3            | `AC-01.3 answers known and unknown numbers alike` (body equality; p95 timing gap under 50 ms over 200 requests) | `otp-sign-in.int-spec.ts`                                                                                              |
| AC-01.4            | `AC-01.4 refuses numbers that are not Indian mobile numbers`                                                    | `apps/api/src/accounts/mobile-number.spec.ts`; `otp-sign-in.int-spec.ts`                                               |
| AC-01.5            | `AC-01.5 stores the intent and grants no role from the request` (role, roles, userId, status in each body)      | `otp-sign-in.int-spec.ts`; E2E                                                                                         |
| AC-01.6            | `AC-01.6 returns and changes only the caller's account`                                                         | `apps/api/test/me.int-spec.ts`                                                                                         |
| AC-02.1            | `AC-02.1 shows the language choice first`                                                                       | E2E; `apps/web/src/proxy.test.ts`                                                                                      |
| AC-02.2            | `AC-02.2 keeps the language on the account`                                                                     | `me.int-spec.ts`; E2E                                                                                                  |
| AC-05.1            | `AC-05.1 restores the session after the browser is reopened`                                                    | E2E                                                                                                                    |
| AC-05.2            | `AC-05.2 sends an ended session to sign-in with a notice`                                                       | E2E; `apps/web/src/lib/return-path.test.ts`                                                                            |
| AC-05.3            | `AC-05.3 refuses a sensitive route without a fresh re-verification`                                             | `apps/api/test/reverify.int-spec.ts`; `reverified.guard.spec.ts`                                                       |
| SE-07.24           | `SE-07.24 accepts only safe return paths` (table of hostile inputs)                                             | `return-path.test.ts`; E2E                                                                                             |
| SE-07.25           | `SE-07.25 serves the outbox only behind the test gate`; `SE-07.25 test sign-in is gone`                         | `apps/api/src/auth/test-login.gate.spec.ts`; `apps/api/test/test-login.int-spec.ts` (renamed `sms-outbox.int-spec.ts`) |
| SE-08.1 to SE-08.5 | One `it` per criterion with the controllable clock and a restart for SE-08.5                                    | `otp-sign-in.int-spec.ts`                                                                                              |
| SE-08.6            | `SE-08.6 keeps codes and numbers out of rows, logs and errors`                                                  | `otp-sign-in.int-spec.ts` with `test/capture-output.ts`                                                                |
| EN-09.3            | `EN-09.3 stores the number as ciphertext with a unique blind index`                                             | `apps/api/test/crypto.int-spec.ts`                                                                                     |
| NT-01.1, NT-01.2   | `NT-01.1 …`, `NT-01.2 …`                                                                                        | `otp.service.spec.ts`; `otp-sign-in.int-spec.ts`                                                                       |
| LM-06.1            | `LM-06.1 counts OTP outcomes without personal data`                                                             | `otp-sign-in.int-spec.ts`                                                                                              |
| LM-07.2            | `LM-07.2 alerts once on a high OTP send-failure rate`                                                           | `otp-failure.monitor.spec.ts`                                                                                          |
| SE-02.4            | Matrix rows for `/v1/me`, `/v1/auth/reverify*`                                                                  | `apps/api/test/authz-matrix.int-spec.ts`                                                                               |
| UX-04.2, UX-05.2   | `UX-04.2 …`, `UX-05.2 …`                                                                                        | `apps/web/src/components/auth/*.test.tsx`; E2E offline case                                                            |
| SC-001             | Manual: moderated test on a mid-range phone, throttled network                                                  | Step 3 usability record                                                                                                |
| SC-002             | Log and URL scan over the CI run                                                                                | `otp-sign-in.int-spec.ts`; E2E request log assertion                                                                   |
| SC-003             | Lighthouse CI and bundle budget                                                                                 | CI                                                                                                                     |

## Complexity Tracking

None.
