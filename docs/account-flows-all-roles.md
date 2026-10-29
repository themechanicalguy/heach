# Account flows for every role: work record

Durable record of the work that completes HEACH's account and login flows for every application
role, on top of the Step 3 sign-in and setup merged in #94 ([earlier record](login-and-account-setup.md),
[ADR 0014](adr/0014-accounts-roles-and-admin-realm.md)). Update it in every commit that changes
the state below, so any session can resume without repeating finished work.

- **Branch:** `feat/account-flows-all-roles`, worktree `../heach-account-flows`, from `origin/main`
  `97e71fd` (29 October 2026, after #98).
- **Owner's working copy** (`../heach`, branch `feat/web-header-redesign`): uncommitted header work
  after #98 ("Sign in / Sign up", a header "Sign out") and the untracked
  `apps/web/design-mockups.html`. Not touched, not included here.
- **Status:** in progress. See [Task list](#task-list).

## Baseline (29 October 2026)

- Merged on `main`: #94 OTP sign-in, setup with save and resume, versioned consent, role switch and
  add, admin password and TOTP, suspend and reinstate; #95 API-backed web and admin E2E in CI;
  #97 and #98 navigation and header. CI green on `main` (`97e71fd`).
- Integration suite on this branch's base: 215 of 215 (local, real PostgreSQL and Redis).
- Stale records found: the earlier work record says "not pushed, not merged"; FU-28 waits "before
  the branch merges"; ADR 0014 says Proposed. #94 was merged by the shared account
  (`themechanicalguy`) with no review or comment, so no written owner approval of ADR 0014 or
  decisions L-1 to L-14 exists (FU-14 provenance). They are recorded as "merged, not formally
  accepted".
- External: SMS provider and DLT (#20) open, no activity; identity partner (#21) open; lawyer
  review (FU-06) and native Odia review (FU-07) not done.

## Owner decisions (relayed in chat, 29 October 2026)

Recorded by Claude Code from the owner's answers in the session (FU-14: same GitHub account).

| # | Question | Decision |
| --- | --- | --- |
| O-1 | Staff accounts (clinic front desk, sample collector) belong to Step 7 | Bring forward only the account and membership slice. An organisation is a lab account's lab or a dentist's or dermatologist's clinic. Its owner invites staff by mobile number; the invitee signs in by OTP and accepts; the owner can revoke an invitation or remove a member; invitations expire after 7 days. Sample collector is no longer self-registrable. Membership gives sign-in and a staff home only; no lab or clinic work until the organisation is Approved |
| O-2 | Admin password and MFA recovery | Super-admin reset: after a fresh TOTP, a super admin issues a one-time temporary password (shown once, changed at the next sign-in) or clears MFA so the admin enrols again. Every session of that admin is revoked; audited. The last active super admin cannot be disabled or demoted. Admins change their own password with the current password and a fresh TOTP |
| O-3 | Phone-number change and lost number | In-app change needs a fresh OTP on the current number and an OTP on the new number; the new number must not belong to another account; other devices are signed out. Lost old number: support-assisted recovery, not built now (owner and lawyer to define) |
| O-4 | Provider identity and professional verification (KY, PO-02, AD-02) | Excluded. Boundary L-5 stands: providers finish account setup and land on a Draft application with later steps shown as not open |

## Implementation defaults (Claude Code; owner may change)

| # | Default | Why |
| --- | --- | --- |
| D-1 | Linked patients (AC-03) are dependent profiles with no sign-in of their own, owned by one care account (patient or representative). Independent accounts stay adults only (setup's adult declaration, L-5); a minor is a linked profile. Transfer of a linked profile to its own account is MV-13 (Step 8) | Requirements: a representative acts "on behalf of" linked patients; DPDP parental consent is a legal point (FU-06) |
| D-2 | Linked patient fields: name, year of birth (the requirement's "age" without storing a date), gender, relationship from a fixed list. All Confidential. At most 10 per account | PR-02 minimisation |
| D-3 | Deletion request (AC-06, PR-04): recorded after a fresh OTP, one open request per account, cancellable; visible to admins. Carrying out the erasure is **not built**: the completion time and what must be kept (consent evidence, audit, provider-issued records) need the lawyer (PR-05, FU-06) | No invented retention or legal deadlines |
| D-4 | Data export (PR-04): a JSON download of the account's own data after a fresh OTP | Step 3 item 12 |
| D-5 | Purge job for expired OTP challenges (24 hours after expiry), sessions (30 days after revocation or expiry) and closed invitations (30 days). Windows are the proposals in the earlier record, awaiting the lawyer (PR-05); the job is built and runnable, not scheduled on the dev host until a deploy is approved | Internal security records only |
| D-6 | Staff invitations send no SMS: the invitee sees the invitation when they sign in. No new DLT template, and no SMS pumping through invitations | #20 not available; abuse |
| D-7 | Removing a member or revoking a role removes the grant and signs out at once every device using that role (sessions and access tokens); suspension already signs out every device | Revocation policy |

## Task list

| # | Task | State |
| --- | --- | --- |
| A1 | This record; role matrix | In progress |
| A2 | Migration 0004 (linked patients, deletion requests, organisations, memberships, admin password change, OTP purpose) | |
| A3 | Linked patients API (AC-03) | |
| A4 | Profile correction, export, deletion request API (AC-06, PR-04) | |
| A5 | Phone-number change API (O-3) | |
| A6 | Organisations, invitations, membership lifecycle API (O-1) | |
| A7 | Admin management, recovery, own password change, last super admin (O-2) | |
| A8 | Purge job (D-5) | |
| A9 | OpenAPI and generated types | |
| A10 | Web screens and i18n (or, en, hi) | |
| A11 | Admin screens | |
| A12 | Tests: unit, integration, E2E | |
| A13 | Docs: status page, register, ADR 0014 status, earlier record | |
| A14 | `pnpm check`, CI, PR | |
