# Role-based login and account setup: work record

Durable record of the work on web role-based login and account setup, so any session (human or
LLM) can resume it without repeating finished work. Update it in every commit that changes the
state below.

- **Branch:** `feat/role-based-login-account-setup`, from `origin/main` `4e4d87e` (28 October 2026)
- **Design reference:** `apps/web/design-mockups.html`, stated to be added on `main` in commit
  `d82d707` ("Added design layout and mockup."). **Discrepancy:** on 29 October 2026 no local or
  remote ref contains `d82d707`; the file exists only as an untracked file in the owner's working
  copy (6,956,601 bytes). It is used as found and is not committed by this branch. The owner
  should push the commit that adds it.
- **Status:** in progress. See [Progress](#progress).

## Instructions (as given by the owner, 29 October 2026)

Implement HEACH's web-based role-based login and account setup end to end.

- **Design and scope.** Use `apps/web/design-mockups.html` (commit `d82d707`) as the visual
  reference; inspect it before designing screens; record path and commit in progress records and
  handoffs. Scope: patient and provider responsive web/PWA, admin web, and the APIs, database
  changes and integrations they need. No native applications.
- **Initial audit.** Read repository instructions, requirements, architecture and status. Spec-driven
  development is retired: no Spec Kit, spec artifacts or approval gates. Inspect code, remote
  `main` and local changes; preserve existing work; branches only, never `main`. Reuse existing
  authentication, session code, shared packages and UI components. Make an actionable task list,
  then build.
- **Roles and behaviour.** Discover roles and permissions from the requirements: patients,
  representatives, provider types, clinic front desk, lab and collector, admin sub-roles. Separate
  registration role selection from server-authorised roles and approved role switching; never grant
  privileges from browser input. Implement: OTP registration and login for patients and providers;
  admin credentials, mandatory MFA and sub-role permissions; language selection and role-specific
  account setup; validation, save and resume, versioned consent; new-user, returning-user and
  incomplete-profile routing; pending, approved, rejected and suspended behaviour; protected routes,
  safe redirects, authorised role switching; session restoration, refresh, expiry, logout including
  all devices; re-verification for sensitive actions; accessible loading, error, retry and offline
  states; Odia, English and Hindi translations and the admin English catalogue. Define and build the
  boundary between basic account setup and wider provider verification; no placeholders for
  dependencies login and setup need.
- **Engineering and security.** Existing stack and rules; server-side permissions on every request
  and object; existing crypto, logger and adapter packages; resolve security prerequisites (nested
  log masking where still needed). Classify new data, define retention, encrypt as required; no
  personal data in logs, URLs or errors. Migrations, audit events, API contracts, generated types.
  Safe under concurrent requests, duplicate submissions and transient failures. OTP expiry, resend
  cooldown, attempt limits, abuse protection, generic errors. Test sign-in only in approved
  environments. Synthetic data; never print secrets. Test doubles in automated tests, but fake
  integrations are not counted as real ones; list the credentials or partner access needed.
- **Verification.** Test registration, returning login, setup and resume, each role's allowed and
  denied access, privilege escalation, cross-account access, OTP failures, expiry, reuse and limits,
  sessions, admin MFA. Unit, integration and browser E2E across locales and mobile, tablet and
  desktop. Compare screens with the design. Run `pnpm check` and the other required checks; fix
  failures; update implementation status and docs.
- **Completion.** Persist until it works end to end and is reviewable. Pause only for genuine missing
  inputs or authorisation, with the exact unblock action. No merge, deploy or infrastructure apply
  without authorisation.
- **Handoff.** Keep this record current; before context runs out, save progress and give a
  self-contained handoff prompt.

## Audit findings (29 October 2026)

- `origin/main` is `4e4d87e`: nested log masking (LM-02.1, FU-27) is merged (#93), so that
  prerequisite is met; nothing more is needed in `@heach/logger`.
- Existing to reuse: opaque access tokens in Redis and rotating refresh cookies with replay
  detection, sign-out of one device or all (`apps/api/src/auth`, SE-07); the web session client
  (`apps/web/src/lib/api.ts`, `session.tsx`: one refresh per tab, Web Locks, BroadcastChannel);
  the global role guard (`@Roles`, `@Public`, SE-02.1 route-table test); hash-chained audit
  (`AuditService`); envelope encryption and blind indexes (`@heach/crypto`); the SMS port and its
  fake (`adapters/`); feature flags (`@heach/flags`); `@heach/ui` (Button, TextField, OtpField,
  Card, Sheet, Table, Toast, BottomNav, states); i18n catalogues with the missing-key check.
- Step 2 scaffolding still present: `app.user_test` (four synthetic identities, roles
  `patient`/`provider`/`admin`), test sign-in, the sample note. Sessions reference `user_test`.
- Admin app: no router, no API proxy, no sign-in. The dev host's admin site (Caddy, port 8443)
  does not route `/api`.
- No OTP, accounts, roles beyond the three Step 2 values, consent, or admin authentication exist.
- External: no SMS provider or DLT registration (#20), no identity partner (#21), lawyer review of
  consent wording not done (FU-06), Odia review not done (FU-07).

## Decisions

Proposals from the archived [Step 3 charter](archive/step-specs/step-03-accounts-onboarding.md)
are applied where they fit; deviations are stated.

| # | Decision | Why |
| --- | --- | --- |
| L-1 | One `app.account` per mobile number replaces `app.user_test`. The four Step 2 synthetic identities become accounts flagged `synthetic` with no mobile number; test sign-in accepts only synthetic accounts, so it can never act as a real OTP account. The Step 2 "admin" identity is dropped: admins now live in their own realm | Charter D3-1, D3-9; keeps Step 2 tests and evidence working |
| L-2 | Roles. Care side: `patient` or `representative` (one of them; a representative also books for self). Provider side: one of `doctor`, `dentist`, `dermatologist`, `physiotherapist`, `nurse`, `attendant`, `lab`, `sample_collector`, `clinic_front_desk`. Admin realm: `super_admin`, `verifier`, `support`, `finance`. An account holds at most one care role and one provider role (requirements, users and roles). `clinic_front_desk` is never self-selected (clinic staff accounts arrive in Step 7) | AC-04, charter D3-3 |
| L-3 | Registration choice is only a request. The server validates it against the self-registrable set, grants the role in `app.role_assignment`, and puts the granted *active role* in the session. Switching role re-checks the grant on the server and re-issues the access token; adding a second side needs OTP re-verification | Never grant privileges from browser input |
| L-4 | Provider application status (`draft`, `submitted`, `under_review`, `changes_requested`, `approved`, `rejected`, `suspended`, PO-04) lives on the provider role assignment. Account status (`active`, `suspended`) is separate (AD-03). A suspended account cannot sign in or refresh; its sessions are revoked when suspended | PO-04, AD-03 |
| L-5 | **Boundary.** Account setup = language, role, basic details (name, gender; providers add languages spoken; labs add the lab's name), adult declaration, and the versioned terms and privacy consents. Provider verification (identity check KY, documents PO-02, profile details and registration number, service area, payout, submission, admin review) is the wider onboarding of guideline Step 3 slices 3.4 to 3.10. After setup a provider lands on the application page with status Draft and the remaining steps listed as not yet available, never as working fakes | Instruction: define the boundary; avoid placeholders for what login and setup need |
| L-6 | OTP: six digits, 5 minutes, 5 wrong attempts end the challenge, resend after 30 seconds, at most 3 resends per challenge; per-number, per-device-cookie and per-address caps per hour and day (Redis counters); code stored as an HMAC keyed per environment; Indian mobile numbers only; same answer for known and unknown numbers. Values are configuration | Charter D3-5, SE-08; owner may change values (Q3-8) |
| L-7 | Mobile number: encrypted in the `identity` domain plus blind index (lookup); never in a URL, log or error | Charter D3-2, EN-09 |
| L-8 | SMS: the port stays; `SMS_PROVIDER=fake` (tests, in memory) or `mailpit` (local: delivered to the Mailpit inbox over its HTTP send API). No real SMS provider exists until #20 (DLT) is done; the API refuses to start with OTP on and no usable provider. The Mailpit adapter is a local tool, not a real integration | Fake integrations are not counted as real |
| L-9 | Admin realm separate from users: email and password (scrypt, `node:crypto`), mandatory TOTP (RFC 6238, `node:crypto`), enrolment at first sign-in, lockout after 5 failed passwords for 15 minutes, TOTP steps never reused, 10-minute access tokens, refresh cookie idle limit 30 minutes and absolute limit 8 hours. Admins are created by a CLI that reads the password from standard input | AD-01, SE-04, charter D3-4; no new dependency |
| L-10 | Sessions: one implementation, two realms (`app.session` for accounts, `app.admin_session` for admins) sharing rotation, replay detection and sign-out. Refresh re-checks account status and the active role grant | DRY; suspension and role removal take effect at the next refresh |
| L-11 | Re-verification: a fresh OTP (users) or TOTP (admins) within 5 minutes, held per session family in Redis, is required for: adding a role to an account, admin suspend and reinstate. Payout details and deletion (later slices) use the same guard | AC-05, SE-07 |
| L-12 | Consent: `app.consent_record` (purpose, version, locale, given, withdrawn). Current versions live in code; a newer version makes the consent due again and routing sends the user to accept it. Texts are drafts pending the lawyer (FU-06) | PR-01, charter D3-8 |
| L-13 | Everything new is behind the flag `accounts` (local, test, dev only) until Step 3 exit | Charter D3-12 |
| L-14 | Admin password hash is classified Confidential (salted scrypt; field encryption adds nothing); the TOTP secret is Restricted and field-encrypted. The charter's data table listed both as Restricted | Deviation, recorded |

## Data classification and retention

| Table.column | Class | Retention (proposed; lawyer to confirm, PR-05) |
| --- | --- | --- |
| `account.mobile` (encrypted, identity) | Confidential | Life of the account; deletion request erases |
| `account.mobile_index` (blind index) | Confidential | As above |
| `account.preferred_locale`, `status`, timestamps, `synthetic` | Internal | As above |
| `account.suspension_reason` (reason code) | Internal | As above |
| `account_profile.full_name`, `organisation_name` | Confidential | As above |
| `account_profile.gender`, `languages`, `adult_declared_at` | Confidential | As above |
| `role_assignment.*` | Internal | As above |
| `consent_record.*` | Confidential | Life of the account plus 3 years as evidence (proposal) |
| `otp_challenge.*` (code HMAC, attempts, expiry, mobile index) | Internal | Deleted 24 hours after expiry (opportunistic purge on each new challenge) |
| `session.*`, `admin_session.*` | Internal (token hash Confidential) | Revoked or expired rows: purge after 30 days (job not yet scheduled) |
| `admin_account.email` | Confidential | While the admin is employed plus 1 year |
| `admin_account.password_hash` | Confidential | As above |
| `admin_account.totp_secret` (encrypted, identity) | Restricted | As above |
| Audit entries | Internal | Per SE-05 (retention still open, PR-05) |

## Task list

| # | Task | State |
| --- | --- | --- |
| T1 | This record | Done |
| T2 | Role model and migration 0003 | Not started |
| T3 | Realm-aware sessions; refresh re-checks status and role | Not started |
| T4 | OTP issue, resend, verify; throttles; SMS adapters | Not started |
| T5 | `/v1/me`, setup save and resume, consent, locale, role switch and add | Not started |
| T6 | Re-verification (OTP for users, TOTP for admins) | Not started |
| T7 | Admin auth: password, TOTP enrolment and sign-in, lockout, sessions, CLI | Not started |
| T8 | Admin users: masked list and search, view, suspend and reinstate | Not started |
| T9 | OpenAPI and generated types | Not started |
| T10 | i18n keys (or, en, hi) and admin catalogue | Not started |
| T11 | Web: design tokens from the mockup, language choice, sign-in, setup, consent, application status, account, guards | Not started |
| T12 | Admin web: sign-in with MFA, users, suspend and reinstate | Not started |
| T13 | Tests: unit, integration, E2E (locales, viewports) | Not started |
| T14 | Docs: status page, threat model, local development | Not started |
| T15 | `pnpm check`, integration, classification, types, coverage | Not started |

## Progress

Nothing committed yet beyond this record.

## Blockers and external inputs

| Item | Needed for | Unblock action |
| --- | --- | --- |
| SMS provider with DLT registration (#20) | Real OTP SMS outside local | Owner submits the DLT and provider application; then a real `SmsSender` adapter and secrets |
| Lawyer review of consent wording (FU-06) | Consent texts beyond draft | Owner shares the lawyer's feedback |
| Native Odia review (FU-07) | New Odia keys | Owner engages the reviewer |
| Admin entry through port forwarding (FU-18) and `/api` on the admin site | Admin sign-in on the dev host | Owner approves the Caddyfile change in this branch and its deploy |
| Commit `d82d707` | Design provenance | Owner pushes it |

## Next commands

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH   # this Mac: Homebrew's default node is broken
pnpm install
pnpm check
pnpm --filter @heach/api test:e2e
```
