# 0015. Defer online consultation and in-clinic appointments beyond the MVP

- **Status:** Accepted. Scope change confirmed by the owner on 29 October 2026 (stated in the
  task brief and recorded by Claude Code). No later release is promised.
- **Date:** 2026-10-29
- **Requirements:** SL-01, SL-08, OC-01 to OC-07, IC-01 to IC-10, EN-08, A11Y-06, J2, J6
  (deferred); AC-04, PO-05, SD-01, BK-03, PR-01, LB-09, MV-02, PK-01, PK-02, AD-04, AD-13,
  LM-06, LM-07 (revised)

## Context

The MVP requirements listed six services. Online doctor consultation needs a video provider,
Telemedicine Practice Guidelines review and prescribing rules; dental and skin clinic
appointments need clinic onboarding, front-desk work and clinical establishment checks. Neither
is built beyond account roles: Step 3 already lets doctor, dentist and dermatologist accounts sign
up and clinics invite front desk staff (owner decision O-1). Earlier drafts of this change cited
a "scope decision V2-1" and a "Version 2" that no document defined.

## Decision

Online doctor consultation and in-clinic dental and skin appointments are out of scope for the
MVP and are **deferred beyond the MVP**, with no release or date promised. The MVP keeps four
services (physiotherapy, nursing and bedside attendant care at home, and lab tests) and keeps the
vault, packages, subscriptions and referrals in their existing scope.

- Requirement IDs stay; deferred rows are marked **Deferred beyond the MVP** and no MVP exit gate
  depends on them. Shared requirements keep their MVP part.
- External prescriptions (uploads to the vault, prescription checks before booking), historical
  records and sharing with a doctor outside the application (MV-09) stay in the MVP.
- The roles `doctor`, `dentist`, `dermatologist` and `clinic_front_desk` (staff of their clinics)
  stay in the database, the OpenAPI enums and the code, behind the server flag
  `doctor-and-clinic`. The flag may be on only in local, test and dev; staging and production
  never turn it on (`packages/flags`).
- While the flag is off the server does not offer, grant, sign in to or switch to those roles:
  setup (save and completion, including an invitation's role) and adding a role answer
  `role_unavailable`; an invitation to a clinic is neither listed nor accepted; a sign-in starts in
  an offered grant, or with no role (`new_account`) if none is offered; a session in a deferred
  role ends at its next refresh and its access token is revoked at first use. Grants, drafts and
  invitations are kept, never deleted, and `/v1/me` and admin user views mark each grant
  `available`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Defer, keep IDs and code behind a flag refused by the server (chosen) | History and IDs stay traceable; retained code still tested; no data loss | Dead-ish code to keep compiling; flag discipline needed |
| Delete the roles, code and migrations | Smallest MVP surface | Loses existing grants and drafts; a later return rebuilds from scratch |
| Hide the roles in the UI only | Smallest change | The API would still grant and act in them (SE-02 requires server authorisation) |

## Consequences

- Steps 6 and 7 of the guideline lose their consultation and clinic work and need re-estimating;
  the video provider, telemedicine review and clinic agreements leave the MVP gates.
- A provider whose only role is deferred can sign in, see their kept role, add a care role and use
  their data rights only after adding a role (PR-04 routes need a granted role; follow-up FU-35).
- Revisit when the owner schedules either service: review OC, IC, J2 and J6 as written, then turn
  the flag into a released feature through a new ADR.
