# Step 3: Accounts, identity verification and provider onboarding

<!-- Step charter (ADR 0007 as amended by ADR 0011). Criteria live in the feature specs listed
     under "Feature specs"; this charter defines none. -->

- **Status:** Draft
- **Approval:** none yet. The owner approves by a pull request comment in their own words
  (constitution IX); an agent never sets this Approved.
- **Guideline:** [Step 3](../mvp-v1-implementation-guideline.md#step-3-accounts-identity-verification-and-provider-onboarding)
- **Roadmap:** [web roadmap, Step 3](../web-roadmap.md#step-3-accounts-identity-verification-and-provider-onboarding);
  every requirement's slice and proof in the [traceability matrix](../requirements-traceability.md)
- **Requirements in scope:** AC-01 to AC-06; PO-01 to PO-07; KY-01 to KY-09; AD-01, AD-02, AD-03,
  AD-11, AD-12; SE-01 (ownership model), SE-04 (admin), SE-07 (OTP sign-in and re-verification),
  SE-08 (sign-up and login); PR-01 (sign-up and identity consent), PR-02, PR-03, PR-04; EN-07
  (uploads), EN-09 (mobile lookup); NT-01 (OTP and verification outcome SMS); LM-06 and LM-07 (OTP
  delivery); LM-09 (admin actions); SD-05 (provider profile pages); UX-05, UX-07 (onboarding test).
  Cross-cutting requirements apply through the definition of done.
- **Journeys:** J1 (provider self-onboarding), J5 (admin verifies a provider)
- **Out of scope:** listings, availability and search (Step 4); clinic treatments, lab tests and
  their catalogues (Steps 4 and 7); clinic front-desk and lab staff accounts beyond the role
  definition (Step 7, IC-10, AD-13); booking-time consents: teleconsult (Step 6) and record sharing
  (Step 8); break-glass (SE-03, Step 6, roadmap amendment A4); patient identity verification as a
  booking precondition (open question Q-PATIENT-KYC); WhatsApp (fast-follow); the production
  environment and any real user (Step 6).

## Purpose

Supply comes before demand: every provider type can sign in on a phone browser, prove identity,
upload documents, and be approved or rejected in the admin website, with every decision audited.
Patients and representatives can sign in, choose a language, add linked patients and exercise
their data rights. Nothing in this step is open to real users; it runs on dev with synthetic data.

## Entry conditions

From the [audit](../step-1-2-audit.md#step-3-readiness) and the
[follow-up register](../follow-up-register.md). This charter can be reviewed now; code waits.

| # | Condition | Register | Needed before |
| --- | --- | --- | --- |
| E1 | This charter and the first feature spec and plan merged as Approved | FU-15 | Any Step 3 code (constitution I) |
| E2 | Spec 008 (nested log masking) approved, implemented and merged | FU-27 | Slice 3.1 code; any code that logs personal data |
| E3 | The owner's written exception to run Step 3 code while Step 2's external items stay open (FU-01 to FU-08), naming each and its end condition (constitution VIII) | Audit condition 2 | First Step 3 code PR |
| E4 | Each 18 October review finding has a backlog row or a written acceptance | FU-13 | This charter's approval |
| E5 | Branch protection decided | FU-10 | First Step 3 merge |
| E6 | Admin entry through port forwarding decided | FU-18 | Slice 3.9 |
| E7 | The lawyer's advice on the Aadhaar route and consent wording | FU-06 | Slices 3.3 and 3.6 beyond the test double |
| E8 | Identity partner and SMS provider applications submitted | FU-09 (#20, #21) | Step 3 exit (sandbox verification, real OTP SMS) |

## Feature specs

One feature spec per slice, specified in this order. A later slice's spec may be drafted while an
earlier one is built, but is not approved against anything that is not yet Approved.

| Order | Slice | Requirements | Depends on | External dependency | Spec |
| --- | --- | --- | --- | --- | --- |
| 1 | 3.0 Foundation fixes before personal data | FU-13 items the owner accepts for a fix (S-3, S-4, S-5, P-2, A-1); retire the Step 2 sample scaffolding (decision D3-9) | E2, E4 | None | Not yet specified |
| 2 | 3.1 OTP sign-up and sign-in, language choice | AC-01, AC-02, AC-05, SE-07, SE-08, EN-09, NT-01, LM-06, LM-07, UX-05 | 3.0 | SMS provider for the real adapter; double until then | Not yet specified |
| 3 | 3.2 Roles, representatives and linked patients | AC-03, AC-04, SE-01, SE-02 | 3.1 | None | Not yet specified |
| 4 | 3.3 Consent records | PR-01, PR-02 | 3.1 | Lawyer wording (E7) | Not yet specified |
| 5 | 3.4 Secure upload pipeline | EN-07, PO-02 | 3.1 | Scanner decision (Q3-4) | Not yet specified |
| 6 | 3.5 Onboarding framework | PO-01, PO-03, PO-04 | 3.2, 3.4 | None | Not yet specified |
| 7 | 3.6 Identity verification | KY-01 to KY-09, PR-03 | 3.3, 3.5 | Partner (E8), lawyer (E7) | Not yet specified |
| 8 | 3.7 Role onboarding flows | PO-01 (checklists per role), PO-07 | 3.5, 3.6 | Recorded Odia audio prompts | Not yet specified |
| 9 | 3.8 Payout details and OTP re-verification | PO-06, AC-05, SE-07 | 3.1, 3.5 | None | Not yet specified |
| 10 | 3.9 Admin shell | AD-01, AD-11, SE-04, LM-09 | 3.2, E6 | None | Not yet specified |
| 11 | 3.10 Verification queue, user management, assisted onboarding | AD-02, AD-03, AD-12, NT-01 | 3.6, 3.7, 3.9 | None | Not yet specified |
| 12 | 3.11 Public provider profile | PO-05, KY-09, SD-05 | 3.10 | None | Not yet specified |
| 13 | 3.12 Account and data rights | AC-06, PR-04 | 3.1, 3.8 | None | Not yet specified |

Slices 3.1 to 3.5, 3.8, 3.9 and 3.12 do not wait for the lawyer or a partner. Slice 3.6 can be
built and tested against the identity double, but cannot meet the exit criterion without the
partner's sandbox.

## Cross-feature decisions (proposed)

Each is a proposal for the owner. Feature specs follow whatever is approved here.

| # | Decision | Proposal | Why |
| --- | --- | --- | --- |
| D3-1 | Account model | One `User` per mobile number, holding at most one patient role and one provider role (requirements, users and roles). A representative is a patient-side account with one or more linked patients and a declared relationship, not a separate login | Matches "who booked" and "who receives care" (BK-01) without duplicate accounts |
| D3-2 | Mobile number storage | Encrypted at field level in the identity domain, looked up by blind index; never in a URL, log or message body other than the OTP SMS itself | DC lists the mobile number as Confidential; EN-09 names mobile lookup as the blind-index case; LM-02 |
| D3-3 | Roles (AC-04) | patient, representative, doctor, dentist, dermatologist, physiotherapist, nurse, attendant, lab (owner or signatory), sample collector (linked to a verified lab), clinic front desk (defined now, accounts in Step 7), and admin sub-roles super admin, verifier, support, finance. Deny by default; each route names its roles (existing guard) | Guideline Step 3 item 2 |
| D3-4 | Admin authentication | Separate from patient and provider sign-in: email and password (scrypt from `node:crypto`), mandatory TOTP (RFC 6238 with `node:crypto`), its own short session, no OTP SMS; reachable on dev only through the Session Manager tunnel | AD-01, SE-04; no new dependency |
| D3-5 | OTP rules | Six digits; valid for 5 minutes; 5 wrong attempts end the challenge; resend after 30 seconds; caps per number, device cookie and IP per hour and per day; stored only as a keyed hash; values in configuration | AC-01, SE-08; numbers are proposals for the owner |
| D3-6 | Bot protection (SE-08) | Throttles first (D3-5, existing per-address and per-user limiter); no third-party CAPTCHA in Step 3, because it sends user data to a processor (PR-06) and adds a dependency | Revisit if abuse appears on dev or at the pilot |
| D3-7 | Uploads | Each object gets its own data key under the documents domain (envelope encryption, `@heach/crypto`); private bucket; object unavailable until the scanner's verdict; served only through a signed URL valid for 60 seconds, issued after an object-level access check that writes an audit entry; JPEG, PNG and PDF up to 5 MB checked by content, not extension; images compressed in the browser, which also drops their metadata (location) | EN-07, PO-02, SE-05 |
| D3-8 | Consent | `ConsentRecord` stores purpose, text version, language, time given and time withdrawn. Texts come from the i18n catalogues under a version key. A text the lawyer has not approved is flagged draft and blocked outside dev by a feature flag | PR-01; lets 3.3 be built before the lawyer's final wording without exposing it |
| D3-9 | Step 2 scaffolding | `app.user_test`, `app.patient_note`, the sample-note routes and screens are removed in slice 3.0. The Step 2 criteria they prove (encryption, ownership, audit, logs) are re-pointed in the same PR to the first real Restricted entity, with the Step 2 criteria unchanged. The dev-only test sign-in stays behind its loopback gate (spec 007) until the SMS double gives E2E tests the OTP the same way, then goes | FU-15; keeps Step 2 evidence valid |
| D3-10 | Verifier access to identity results | The verification queue shows the identity result (Restricted) to verifiers as a purpose-bound read: only for a provider in their queue, audited per read, no export. Not a break-glass action | AD-02 needs it on every review; SE-03 as written would make each one a break-glass (roadmap amendment A9). **Owner decision** |
| D3-11 | Assisted onboarding | A support admin completes a profile only after the provider confirms by OTP; the audit entry names both the admin and the provider; the provider sees who acted for them | AD-12, PO-07 |
| D3-12 | Flags | Each slice ships behind a flag in `@heach/flags`, off outside dev, until the Step 3 exit | Definition of done |
| D3-13 | Odia audio prompts | Recorded clips per onboarding step for attendants, served as static assets; not browser speech synthesis, which rarely has an Odia voice | PO-07; web roadmap capability table |

## Data

Classes from the requirements' data classification. Exact fields, retention and migrations are
in each feature plan; this table is what the specs must not contradict.

| Entity | Field | Class | Notes |
| --- | --- | --- | --- |
| User | mobile number | Confidential | Field-encrypted (identity domain) with a blind index (D3-2) |
| User | preferred language | Internal | `or`, `en`, `hi` |
| User | status, created, last sign-in | Internal | |
| OtpChallenge | code hash, attempts, expiry | Internal | Keyed hash only; never logged |
| RoleAssignment | role, granted by, at | Internal | Admin grants are audited |
| LinkedPatient | name, age or date of birth, gender, relationship | Confidential | Owned by the booking user (AC-03) |
| ConsentRecord | purpose, text version, language, given, withdrawn | Confidential | Kept after withdrawal as evidence (retention in PR-05) |
| ProviderProfile | name, photo, gender, languages, experience, qualifications | Confidential until Approved, then the published subset is Public | PO-05 decides the public subset |
| ProviderProfile | registration number | Confidential until Approved, then Public for doctors and nurses | PO-05 |
| ProviderProfile | status | Internal | PO-04 states |
| ProviderDocument | file, type, checklist item | Confidential | Encrypted per object (D3-7) |
| ProviderDocument | identity documents shared from DigiLocker | Restricted | Identity verification results are Restricted (DC) |
| IdentityVerification | last four digits, result, method, time, partner transaction reference | Restricted | KY-05; full Aadhaar number never stored (PR-03) |
| IdentityVerification | verified name, date of birth, gender, photo, address | Restricted | Pre-fills the profile (KY-03) |
| VerificationDecision | decision, reason code, admin, time | Internal | Free-text note is Confidential |
| PayoutDetails | bank account, IFSC, UPI ID | Restricted | Payments domain key (EN-06); change needs OTP (PO-06) |
| AdminUser | email | Confidential | |
| AdminUser | password hash, TOTP secret | Restricted | TOTP secret encrypted; never returned by the API |
| DataRightsRequest | type, state, due date | Confidential | PR-04 |
| Clinic, Lab | name, address, registration and establishment documents | Confidential until Approved; name and address then Public | Profiles and catalogues in Step 7 |

## API

Groups only; contracts in each feature plan and the generated OpenAPI.

| Group | Roles | Slice |
| --- | --- | --- |
| `POST /v1/auth/otp`, `POST /v1/auth/otp/verify` | Anonymous (throttled) | 3.1 |
| `GET` and `PATCH /v1/me`, linked patients under `/v1/me/patients` | Signed-in user, own objects only | 3.1, 3.2 |
| `/v1/consents` | Signed-in user | 3.3 |
| `/v1/uploads` (create, part URLs, complete, status) and signed reads | Owner of the object; verifier through the queue | 3.4 |
| `/v1/onboarding` (profile, checklist, submit) | Provider roles, own profile | 3.5, 3.7 |
| `/v1/identity` (start, callback, status, fallback) | Signed-in user; partner callback signed | 3.6 |
| `/v1/me/payout-details` | Provider, fresh OTP | 3.8 |
| `/v1/me/data-requests` | Signed-in user | 3.12 |
| `/v1/providers/{id}` public profile | Anonymous, Approved only | 3.11 |
| `/admin/v1/*` sign-in, MFA, users, verification queue, audit log | Admin sub-roles | 3.9, 3.10 |

## Threat model (SO-01)

Step-level threats; each feature plan refines its own. STRIDE category in brackets.

| Threat | Mitigation | Slice |
| --- | --- | --- |
| OTP brute force or SMS pumping to premium numbers [Denial of service, Spoofing] | Per-number, device and IP caps; Indian numbers only; attempt limit; OTP-failure alert (LM-07) | 3.1 |
| Account takeover by SIM swap or a stolen phone [Spoofing] | Short access tokens, rotating refresh (Step 2); OTP re-verification for payout changes and deletion; sign out of all devices | 3.1, 3.8 |
| Enumeration of registered mobile numbers [Information disclosure] | Same response and timing for known and unknown numbers | 3.1 |
| Mobile numbers or identity data in logs [Information disclosure] | Spec 008 before 3.1; no personal data in log calls; tests per slice | 3.0, all |
| A user reads or edits another user's linked patient, document or profile [Elevation of privilege] | Object-level guard on every route; authorisation matrix per role | 3.2 onward |
| Malware or polyglot files uploaded as documents [Tampering] | Content-type check, size cap, scan before availability, quarantine | 3.4 |
| A signed document URL leaked or reused [Information disclosure] | 60-second URLs issued only after an access check, never logged, no-store | 3.4 |
| Full Aadhaar number stored or logged [Information disclosure] | Adapter returns only the masked reference; tests over database, logs and responses | 3.6 |
| Forged identity-partner callback [Spoofing, Tampering] | Signature check, nonce bound to the session, replay window | 3.6 |
| Profile details changed after verification [Tampering] | Verified fields locked; change requires re-verification (KY-03) | 3.6 |
| Attendant listed as a nurse or offering clinical procedures [Tampering] | Role-specific checklists and templates; admin approval | 3.7 |
| Payout details swapped to an attacker's account [Tampering] | Fresh OTP, notification to the provider, audit entry, cooling-off period before first payout to new details | 3.8 |
| Admin credential stuffing or phishing [Spoofing] | Password plus TOTP, lockout and alert, admin reachable only through the tunnel on dev | 3.9 |
| Verifier browses identity data without need [Information disclosure] | Purpose-bound queue access, audit per read, no export (D3-10) | 3.10 |
| Support admin acts as a provider without consent [Repudiation] | Provider OTP for assisted mode; audit names both parties | 3.10 |
| Admin action denied after the fact [Repudiation] | Hash-chained audit entry for every admin action, viewer for super admin | 3.9 |
| Public profile exposes unpublished data [Information disclosure] | Public view built from an explicit field list, Approved profiles only | 3.11 |
| Data export sent to the wrong person [Information disclosure] | OTP before export; download behind a short-lived link; audit | 3.12 |

## Screens and languages

- **Web app (360, 768, 1280 px):** language choice, sign-in and OTP, profile, linked patients,
  consent prompts, onboarding steps with progress and save-and-resume, document capture and upload
  with progress and retry, identity verification hand-off and fallback, payout details, account
  and data rights, public provider profile. Attendant flows use large targets, icons with text and
  Odia audio prompts.
- **Admin (1280 px down to tablet, English keys):** sign-in with MFA, users, verification queue
  with document viewer (zoom, rotate), decision dialogs, audit log viewer.
- **States:** loading, empty, error and offline on every screen (UX-04), from `packages/ui`.
- **Languages:** every new key in Odia, English and Hindi; consent texts versioned per language;
  native Odia review of the new keys before the Step 3 exit; usability test of onboarding with at
  least five attendants and five nurses, in Odia (guideline check).

## Exit criteria

From the guideline, with the slice that proves each.

| Exit criterion | Proved by |
| --- | --- |
| One provider of each type completes onboarding on a phone and is approved in the admin panel | J1 E2E per provider type (3.7) and J5 (3.10); real-phone demo in Odia over a throttled network (guideline rule) |
| Identity verification works in the partner's production or sandbox environment, with the fallback path tested | 3.6 sandbox run in the nightly suite; fallback E2E |
| An admin cannot open a provider's documents without an audit entry | 3.4 and 3.10 integration tests |
| Provider recruitment for the pilot districts begins using this build | Owner record |
| Aadhaar number never in the database, logs or API responses (guideline check) | 3.6 encryption and log assertions |
| Threat models for authentication, identity verification and document storage (guideline check) | Plans of 3.1, 3.4, 3.6 |

## Open questions

The charter is not Approved while a row is open. Owner unless stated.

| # | Question | Blocks |
| --- | --- | --- |
| Q3-1 | Who operates the application (requirements open question)? Needed for consent texts, terms and the provider agreement | 3.3, 3.7 |
| Q3-2 | Aadhaar and DigiLocker route: direct or licensed partner (lawyer, FU-06, #21) | 3.6 |
| Q3-3 | Accept D3-10 (purpose-bound verifier access to identity results) or require break-glass | 3.10 |
| Q3-4 | Virus scanner: ClamAV in its own container (GPL-2.0, not linked) or a managed service; its memory on the `t4g.small` host | 3.4 |
| Q3-5 | Attendants: freelancers only, or agencies too | 3.7 |
| Q3-6 | Doctors registered outside Odisha allowed | 3.7, 3.10 |
| Q3-7 | Background or police verification for home-visit providers and attendants | 3.7, 3.10 |
| Q3-8 | OTP and throttle values in D3-5 | 3.1 |
| Q3-9 | Accept the decisions D3-1 to D3-13 as proposed, or change them | All slices |
