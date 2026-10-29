# 0014. Keep patient and provider accounts and admins in separate sign-in realms

- **Status:** Proposed (the owner accepts or changes it on the pull request)
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
