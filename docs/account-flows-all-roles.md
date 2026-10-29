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
- **Status:** implemented and verified locally with test doubles; awaiting the owner's review on the pull request. Not complete end to end: real SMS delivery (FU-30), lost-number recovery (FU-33) and the legal decisions on deletion and retention (FU-31) are open. See [Completion](#completion).

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

## Concepts

- **Account:** one per mobile number (`app.account`), signs in by OTP. Holds at most one care role
  and one provider role.
- **Role assignment:** a role granted to an account by the server (`app.role_assignment`); a
  provider role carries its application status (PO-04), a front desk role has none.
- **Organisation:** a lab (owned by a `lab` account) or a clinic (owned by a `dentist` or
  `dermatologist` account), `app.organisation`. Approved when its owner's application is approved
  and the owner's account is active.
- **Organisation membership:** a staff invitation to a mobile number, bound to an account on
  acceptance (`app.membership`); it is what grants `sample_collector` or `clinic_front_desk`.
- **Linked patient:** a dependent profile owned by a care account, with no sign-in of its own.
- **Admin account:** a separate realm (`app.admin_account`), email, password and TOTP.

## Role-by-role matrix

"Verified" means automated tests against test doubles and the local Mailpit inbox; no real SMS has
been sent for any role (FU-30).

| Role | Registration or provisioning | Sign-in | Setup | Granted access and scope | After sign-in | States | Recovery | Evidence | Remaining |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Patient | Self, OTP | OTP | Language, name, gender, adult, consent | Own account, own linked patients | Home | Active, suspended | Number change (two codes); lost number: FU-33 | `role-journeys`, `linked-patients`, `account-data`; web E2E | Booking (Step 5) |
| Representative | Self, OTP | OTP | As patient | As patient; books for linked patients later | Home | As patient | As patient | As patient | Booking; vault transfer MV-13 |
| Doctor, dentist, dermatologist, physiotherapist, nurse, attendant | Self, OTP | OTP | Plus spoken languages | Own account; application Draft; no provider work (none exists) | Application page | Account active, suspended; application Draft to Suspended (only Draft reachable) | As patient | `role-journeys`; E2E provider setup | Verification (KY, PO, AD-02), excluded (O-4); approval gates on later work routes |
| Lab | Self, OTP | OTP | Plus lab name | As provider; manages its lab's collectors | Application page; Your team | As provider | As patient | `role-journeys`, `staff-membership`; E2E | As provider |
| Dentist, dermatologist as clinic | Self, OTP | OTP | As provider; names the clinic on Your team | Manages front desk staff | Application page; Your team | As provider | As patient | `staff-membership`, `role-journeys` | Clinic profile (Step 7) |
| Sample collector | Invitation from a lab, accepted after OTP (in setup, or on Account after a fresh code) | OTP | Name, gender, adult, consent | Sign-in and staff home only; own application Draft; lab work only when the lab is approved (none exists) | Staff home | Invited, active, removed (signed out at once), expired, declined, revoked | As patient; removed member re-invited | `staff-membership` (13), `role-journeys`; E2E | Lab work (Step 7); own verification (excluded) |
| Clinic front desk | Invitation from a clinic | OTP | As collector | Sign-in and staff home only; no application | Staff home | As collector | As collector | As collector | Clinic work (Step 7) |
| Super admin | First by CLI; others by a super admin | Email, password, TOTP | TOTP enrolment; temporary password replaced | All admin sections, admin management | Dashboard | Active, disabled, locked | Another super admin resets password or MFA; last super admin protected | `admin-management` (9), `role-journeys`; admin E2E | Break-glass (Step 6) |
| Verifier, support, finance | By a super admin | As super admin | As super admin | Verifier and support: users (support changes); finance: none yet | Dashboard | As super admin | Super admin reset | As super admin | Their consoles (later steps) |

## Completion

| Item | State |
| --- | --- |
| Every role registers or is provisioned, signs in again and lands on a working destination | Implemented and verified (test doubles) |
| OTP expiry, resend, attempts, single use, caps, generic answers | Implemented and verified (#94; unchanged) |
| Linked patients, profile correction, export, deletion request | Implemented and verified |
| Number change | Implemented and verified |
| Staff invitation, acceptance, expiry, revocation, removal with immediate sign-out | Implemented and verified |
| Admin provisioning, sub-roles, disable, password and MFA reset, own password change, last super admin | Implemented and verified |
| Purge job | Implemented and verified; not scheduled (FU-32) |
| Real SMS delivery | Blocked by the SMS provider and DLT registration (#20, FU-30) |
| Carrying out deletions; retention windows | Blocked by legal decisions (FU-31) |
| Lost-number recovery | Not built by owner decision O-3; procedure needed (FU-33) |
| Bot challenge on sign-up | Not built: needs a provider or dependency decision (charter D3-6) |
| Native Odia and Hindi review; real-device test | Not done (FU-34, FU-08) |

## Validation (29 October 2026, local)

- `pnpm check`: 37 of 37 tasks; `pnpm format:check`; generated types up to date; data classes.
- API: unit 133, integration 269 of 269 (`pnpm --filter @heach/api test:e2e`).
- Web: unit 64; API-backed E2E 45 of 45 (`sign-in-setup.spec.ts`, `account-flows.spec.ts`) on
  mobile, tablet and desktop.
- Admin: unit 9; API-backed E2E 12 of 12 on desktop and tablet (one worker: the suites share users).
- Changed-line coverage against `origin/main`: 97.5 % (421 of 432).
- Found and fixed by the new tests: provider setup in one session lost the chosen role on the
  details step (pre-existing on `main`); nested forms dropped the fresh-code confirmation.

## Next actions

1. Owner: review the pull request; accept or change ADR 0014, L-1 to L-14 and O-1 to O-4 in
   writing (FU-28).
2. Owner: DLT and SMS provider (#20, FU-30); then Claude Code builds the real adapter.
3. Owner with the lawyer: deletion deadline and retention windows (FU-31), lost-number recovery
   (FU-33), consent texts (FU-06).
4. Owner: native review of the new keys (FU-34).
5. After approval: schedule the purge job (FU-32).

## Task list

| # | Task | State |
| --- | --- | --- |
| A1 | This record; role matrix | Done |
| A2 | Migration 0004 (linked patients, deletion requests, organisations, memberships, admin password change, OTP purpose) | Done (`d822be7`) |
| A3 | Linked patients API (AC-03) | Done |
| A4 | Profile correction, export, deletion request API (AC-06, PR-04) | Done |
| A5 | Phone-number change API (O-3) | Done |
| A6 | Organisations, invitations, membership lifecycle API (O-1) | Done |
| A7 | Admin management, recovery, own password change, last super admin (O-2) | Done |
| A8 | Purge job (D-5) | Done; not scheduled on a host |
| A9 | OpenAPI and generated types | Done (`251a9a3`) |
| A10 | Web screens and i18n (or, en, hi) | Done (`226d2aa`); Odia and Hindi await review (FU-34) |
| A11 | Admin screens | Done (`47123fb`) |
| A12 | Tests: unit, integration, E2E | Done (`251a9a3`, `fcce088`, `10f1012`) |
| A13 | Docs: status page, register, ADR 0014 status, earlier record | Done |
| A14 | `pnpm check`, CI, PR | Local checks green; PR opened by the owner's authorisation only |

## Progress

- 29 October 2026, `d822be7` and `251a9a3`: API complete for A2 to A9. Integration 269 of 269
  (215 before, 54 new: `role-journeys`, `staff-membership`, `linked-patients`, `account-data`,
  `admin-management`, `purge-expired`), unit 133 of 133. Found and fixed on the way: a membership
  CHECK that made a removed member violate the table (caught by the D-7 test).
- Local setup for this worktree: its own `.env` copy points PostgreSQL at database
  `heach_flows` and Redis at db 1, so tests never touch the owner's `heach_local` or their dev
  sessions. Migration 0004 was briefly applied to `heach_local` by mistake and reverted by hand
  the same minute (tables were empty; ledger back to 0003).
- The secret-scan hook failed in a git worktree (gitleaks in Docker could not see the common
  `.git`); `scripts/hooks/secrets.mjs` now mounts it read-only, with a unit test.
