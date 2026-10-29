# 0014. Keep patient and provider accounts and admins in separate sign-in realms

- **Status:** Accepted by the owner on 29 October 2026, with the amendments below (stated in chat
  and recorded by Claude Code: "I confirm O-1 to O-4 and accept ADR 0014"; FU-14). Implemented in
  #94 and #99.
- **Date:** 2026-10-29
- **Requirements:** AC-01 to AC-05, AD-01, AD-03, SE-04, SE-07, SE-08, PR-01, PO-04

## Context

Step 3 needs real sign-in. Patients and providers sign in by mobile OTP (AC-01) and one account
may hold a patient role and a provider role. Admins need email, password and mandatory MFA with
short sessions (AD-01, SE-04). Step 2 left one session implementation (rotation, replay
detection, sign-out of all devices) tied to the `user_test` table, and roles were three fixed
values. The full decision list is in [login and account setup](../login-and-account-setup.md#decisions)
(L-1 to L-14).

## Decision

Two sign-in realms share one session implementation: `app.account` (OTP) and `app.admin_account`
(password and TOTP), each with its own session table, cookie path and lifetimes. Roles are granted
only by the server: registration stores the role asked for, setup completion grants it, and the
session carries the active role, re-checked at every refresh. Admin sub-roles are route roles in
the existing guard. TOTP, scrypt and the OTP keyed hash use `node:crypto`; no new dependency.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Two realms, one parameterised session service (chosen) | Admin tokens can never act on patient routes; one tested rotation path | Table names passed as realm constants |
| One account table with an admin flag | One login table | Admins would share OTP sign-in and long sessions; a flag bug escalates |
| Managed identity service (for example Cognito) | Hosted MFA and OTP | New processor of personal data (PR-06), new dependency, SMS still needs DLT |

## Consequences

- Suspension or role removal ends a device at its next refresh (at most 15 minutes for an
  existing access token); suspension also revokes every session at once.
- A real SMS provider (DLT registration, #20) is still needed outside local; until then OTP works
  only locally (Mailpit) and in tests (double). The `accounts` flag stays off outside dev.
- Admins are created by a CLI; an admin console for creating admins and changing sub-roles is
  still to build. TOTP enrolment happens at first sign-in, so the first password must be passed
  to the admin securely.
- Revisit if a second sign-in method (for example passkeys for admins) is added.

## Amendments (29 October 2026, owner decisions relayed in chat)

Recorded in [account flows for every role](../account-flows-all-roles.md#owner-decisions-relayed-in-chat-29-october-2026).

- **O-1:** clinic front desk and sample collector hold their role only through an organisation
  membership (a lab account's lab, a dentist's or dermatologist's clinic), invited by mobile number
  and accepted after OTP sign-in; sample collector is no longer self-registrable. A front desk role
  has no provider application of its own. Removing a member ends that role's sessions at once.
- **O-2:** the admin console for creating admins and changing sub-roles now exists (super admins
  only); recovery is a super-admin reset to a temporary password or of MFA; the last active super
  admin cannot be removed. The CLI remains for the first super admin.
- **O-3:** a number change needs a fresh OTP on the current number and an OTP on the new one.
- **Amended by [ADR 0015](0015-defer-online-consultation-and-clinic-appointments.md)** (29 October
  2026): the clinic half of O-1 (dentist's or dermatologist's clinic, clinic front desk) is deferred
  beyond the MVP; those roles are kept but refused by the server while `doctor-and-clinic` is off.
