---
description: 'Tasks for spec 009, OTP sign-up and sign-in'
---

# Tasks: OTP sign-up and sign-in, language choice and sessions

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md),
[contracts/accounts-api.md](contracts/accounts-api.md)

**Prerequisites**: spec.md and plan.md merged as Approved (G2); spec 008 implemented and merged
(charter E2); the owner's written exception E3; the spec's open questions answered. None is met
on 28 October 2026.

**Tests**: every criterion ID has a test whose title starts with it, written first and failing
before its implementation task.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Flag `otp-sign-in` allowed in `local`, `test`, `dev` in `packages/flags/src/index.ts`, with its test in `index.test.ts`
- [ ] T002 [P] i18n keys in `packages/i18n/src/messages/{or,en,hi}.json`: `auth.*` (welcome, number, code, resend, errors, attempts left, offline, session ended), `account.*`, `intent.*`, and SMS templates `sms.otp.sign_in`, `sms.otp.reverify` (code, app name, validity only); `catalogues.test.ts` passes
- [ ] T003 [P] Synthetic test numbers helper in `apps/api/test/auth-helpers.ts` (`98765 4xxxx` only)

## Phase 2: Foundational (blocks every story)

- [ ] T004 Migration `apps/api/migrations/0003_user_accounts.sql` as in data-model.md, with `class=` on every column and the down migration; `classification.int-spec.ts` passes
- [ ] T005 [P] `mobile-number.ts` normaliser and `mobile-number.spec.ts` (`AC-01.4` unit cases) in `apps/api/src/accounts/`
- [ ] T006 [P] `otp-code.ts` (randomInt, HMAC with HKDF-derived key, `timingSafeEqual`) and its spec in `apps/api/src/accounts/`
- [ ] T007 Wire `BlindIndexer` and the OTP key into `apps/api/src/crypto/crypto.module.ts` from the existing blind-index root
- [ ] T008 [P] `user-account.repository.ts` (encrypt, blind index, role assignment, audit in the same transaction) and `otp-challenge.repository.ts`
- [ ] T009 [P] `otp-throttle.service.ts` over Redis with the keys in data-model.md
- [ ] T010 [P] `FakeSmsSender` outbox (latest message per number, cleared per test) and a failing mode, in `apps/api/src/adapters/fakes.ts` with `fakes.spec.ts`
- [ ] T011 `session.repository.ts` reads the role from `app.role_assignment`; `SessionService.signIn` takes an account ID only from `OtpService`

**Checkpoint**: storage, crypto, throttles and the SMS fake are ready.

## Phase 3: User Story 1 - A new person creates an account (P1) 🎯 MVP

### Tests (write first)

- [ ] T012 [P] [US1] `AC-01.1`, `AC-01.4`, `AC-01.5` (bodies with `role`, `roles`, `userId`, `status`), `NT-01.1`, `NT-01.2`, `LM-06.1` in `apps/api/test/otp-sign-in.int-spec.ts`
- [ ] T013 [P] [US1] `EN-09.3` in `apps/api/test/crypto.int-spec.ts`
- [ ] T014 [P] [US1] `AC-02.1` in `apps/web/src/proxy.test.ts`; `UX-05.2`, `UX-04.2` in `apps/web/src/components/auth/*.test.tsx`
- [ ] T015 [P] [US1] E2E `AC-01.1`, `AC-01.5`, `AC-02.1` in `apps/web/e2e/sign-in.spec.ts` for `or` and `en` at 360, 768 and 1280 px with axe

### Implementation

- [ ] T016 [US1] `otp.service.ts` request and verify; `otp.controller.ts` with `@Public` reasons, whitelist DTOs, `no-store`, device cookie
- [ ] T017 [US1] `me.controller.ts` `GET` and `PATCH /v1/me` (intent once, language)
- [ ] T018 [US1] Proxy: first visit without `heach_locale` goes to `/{locale}/welcome`; `welcome/page.tsx` sets the cookie
- [ ] T019 [US1] `sign-in/page.tsx` with `NumberStep` and `CodeStep` (`TextField`, `OtpField`, `Button`, `States`), WebOTP where present, countdown announced politely; remove `TestSignIn`
- [ ] T020 [US1] `get-started/page.tsx` intent tiles; `account/page.tsx` with masked number, language, sign out, sign out of all devices, provider notice
- [ ] T021 [US1] Regenerate `@heach/types` and use the typed client in the web pages
- [ ] T022 [US1] Compare each new screen at 360 px with the nearest board of `apps/web/design-mockups.html` (Onboarding A, Home A); record screenshots and differences in Evidence

## Phase 4: User Story 2 - Returning sign-in and lasting sessions (P1)

- [ ] T023 [P] [US2] `AC-01.2`, `AC-01.3`, `AC-01.6`, `AC-02.2` in `otp-sign-in.int-spec.ts` and new `apps/api/test/me.int-spec.ts`
- [ ] T024 [P] [US2] `SE-07.24` table in `apps/web/src/lib/return-path.test.ts`; `AC-05.1`, `AC-05.2` in `sign-in.spec.ts`
- [ ] T025 [P] [US2] `SE-02.4` rows in `apps/api/test/authz-matrix.int-spec.ts`
- [ ] T026 [US2] `return-path.ts` and a `requireSession` helper used by `account` and `get-started`; session-ended notice on `sign-in`; `no-store` on protected pages
- [ ] T027 [US2] Same-work path for unknown numbers in `otp.service.ts` (AC-01.3)

## Phase 5: User Story 3 - Abuse of codes is stopped (P1)

- [ ] T028 [P] [US3] `SE-08.1` to `SE-08.6` in `otp-sign-in.int-spec.ts` (controllable clock; API restart for SE-08.5; row and log scan for SE-08.6)
- [ ] T029 [US3] Expiry, attempts, single use, replace on resend, cooldown and caps in `otp.service.ts` and `otp-throttle.service.ts`
- [ ] T030 [P] [US3] `LM-07.2` in `otp-failure.monitor.spec.ts`; `otp-failure.monitor.ts` on the `ErrorRateMonitor` pattern; OTP counters
- [ ] T031 [US3] Daily sweep of challenges ended over 24 hours ago (existing jobs pattern; no personal data in its log)

## Phase 6: User Story 4 - Re-verification (P2)

- [ ] T032 [P] [US4] `AC-05.3` in `apps/api/test/reverify.int-spec.ts` with a test-only module registering one `@Reverified('payout_details')` route, and `reverified.guard.spec.ts`
- [ ] T033 [US4] `POST /v1/auth/reverify` and `/reverify/verify`, the Redis grant and `reverified.guard.ts`

## Phase 7: User Story 5 - Outbox and removal of test sign-in (P3)

- [ ] T034 [P] [US5] `SE-07.25` in `test-login.gate.spec.ts` and `apps/api/test/sms-outbox.int-spec.ts` (renamed from `test-login.int-spec.ts`); test-login route answers 404
- [ ] T035 [US5] `POST /v1/test/sms-outbox` behind `TestLoginGate`; remove `test-identity.adapter.ts`, `TestLoginDto`, the test-login route and the synthetic users; E2E helpers sign in through the outbox; deploy-bundle check and Caddy loopback entry point at the outbox path (spec 007's infrastructure: show the change, owner approves)
- [ ] T036 [US5] Re-point the proofs of SE-07.4 (Step 2 spec) and SE-07.23 (spec 007) only if the owner approved it in this PR's spec (open question 3)

## Phase 8: Verification and status

- [ ] T037 `pnpm check`; `pnpm --filter @heach/types generate`; review the OpenAPI against contracts/accounts-api.md
- [ ] T038 SC-002: assert in CI that captured logs and recorded URLs hold no synthetic number or code
- [ ] T039 Update `docs/implementation-status.md`: AC-01, AC-02, AC-05, SE-07, SE-08, EN-09, NT-01 (Partial: fake SMS only), LM-06, LM-07, UX-04, UX-05; "Last updated"
- [ ] T040 Update `docs/step-3-login-progress.md` log and handoff
- [ ] T041 Code PR `feat/009-otp-sign-in` with `Spec:` and `Criteria:` lines
- [ ] T042 Owner: G4 acceptance and SC-001 moderated test. Not an agent task

## Dependencies & Execution Order

- Phase 1 and 2 first. US1 before US2 and US3 (they test its routes). US4 after US1. US5 after
  US1 (E2E sign-in must use the outbox before the test sign-in goes).
- Within a story, tests first, then implementation.

## Evidence

Filled in by the code PR: design comparison screenshots (T022), test run IDs, OpenAPI diff.
