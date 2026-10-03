# Implementation guideline: 10 steps from repo setup to go-live

- **Applies to:** MVP (Minimum Viable Product) Version 1 requirements (`mvp-v1-requirements.md`)
- **Date:** 3 October 2026
- **Status:** Draft. Step lengths are estimates and need re-estimating by the team that builds it.

The application is built in 10 steps: two that lay the secure foundation, seven that add features in dependency order with staged pilots, and one that hardens and launches. This guideline follows the MVP Version 1 requirements; module codes such as `BK` and `MV` refer to that document.

## Contents

1. [At a glance](#at-a-glance)
2. [Step 1: Repository and app initialization](#step-1-repository-and-app-initialization)
3. [Step 2: Secure foundation and quality gates](#step-2-secure-foundation-and-quality-gates)
4. [Step 3: Accounts, identity verification and provider onboarding](#step-3-accounts-identity-verification-and-provider-onboarding)
5. [Step 4: Listings, availability and search](#step-4-listings-availability-and-search)
6. [Step 5: Booking, payments and notifications](#step-5-booking-payments-and-notifications)
7. [Step 6: Online consultation, home services and the Stage A pilot](#step-6-online-consultation-home-services-and-the-stage-a-pilot)
8. [Step 7: In-clinic appointments and lab tests](#step-7-in-clinic-appointments-and-lab-tests)
9. [Step 8: E-medical report vault and the Stage B launch](#step-8-e-medical-report-vault-and-the-stage-b-launch)
10. [Step 9: Plans, referrals and admin completion](#step-9-plans-referrals-and-admin-completion)
11. [Step 10: Hardening, launch readiness and go-live](#step-10-hardening-launch-readiness-and-go-live)

## At a glance

The 10 steps run in order and total roughly 38 to 43 weeks for a team of eight to ten; the lengths are estimates and need re-estimating by the team that builds it.

| Step | What it delivers | Modules | Indicative length | Exit gate |
| --- | --- | --- | --- | --- |
| 1. Repository and app initialization | Monorepo, three app shells, CI, environments | None | 1 to 2 weeks | Empty apps deploy to dev and staging through the pipeline |
| 2. Secure foundation and quality gates | Encryption, audit, i18n, design system, observability, test harness | DC, EN, SE, SO, PF, A11Y, I18N, TS, LM, UX | 3 weeks | A sample sensitive record is encrypted, access-controlled, audited and shown in three languages |
| 3. Accounts, identity and onboarding | OTP login, Aadhaar and DigiLocker verification, provider onboarding, admin verification | AC, KY, PO, AD-01 to AD-03, AD-11 | 5 weeks | Every provider type can onboard and be approved |
| 4. Listings, availability and search | Service catalogue, listings, schedules, discovery | SL, AV, SD, AD-04 | 3 weeks | A patient can find a verified provider with open slots |
| 5. Booking, payments and notifications | Booking engine, gateway payments, refunds, payouts, SMS | BK, PY, NT, AD-05, AD-07 | 4 weeks | A patient can book and pay; refund and payout work in sandbox |
| 6. Consultation, home services and Stage A pilot | Video consult, prescriptions, home visits, attendant shifts, ratings | OC, HS, RF, AD-06 | 7 to 8 weeks | Stage A live in pilot districts |
| 7. In-clinic appointments and lab tests | Dental and skin clinic booking, lab test booking and reports | IC, LB, AD-13 | 5 to 6 weeks | Journeys J6 and J7 work with pilot clinics and labs |
| 8. E-medical report vault and Stage B | Record storage, medical history, consent-based sharing | MV, AD-15 | 3 to 4 weeks | Stage B live; vault sharing passes its penetration test |
| 9. Plans, referrals and admin completion | Care packages, subscriptions, coupons, remaining admin screens | PK, RR, AD-08 to AD-10, AD-14, AD-16, AD-17 | 4 to 5 weeks | Journey J8 works; entitlements reconcile daily |
| 10. Hardening and go-live | Security and load testing, legal, support, launch and hypercare | All | 3 weeks plus 4 weeks of hypercare | Stage C live: full MVP Version 1 |

Three rules apply to every step:

- **The definition of done is the gate.** No feature merges without encryption of sensitive fields, authorisation tests, translations in three languages, unit and E2E tests, accessibility and performance checks, and logging.
- **Third-party onboarding starts early.** Payment gateway, SMS (DLT registration), Aadhaar and DigiLocker partner, and video provider approvals can take weeks, so applications go in during steps 1 and 2.
- **Each step ends with a demo on a real mid-range Android phone**, in Odia, over a throttled network.

## Step 1: Repository and app initialization

Goal: a working monorepo where three empty apps build, test and deploy through one pipeline, so every later step starts from a running system.

### Build

1. Create the Git repository with branch protection on `main`: pull requests only, one review, passing checks required, signed commits.
2. Set up the monorepo with pnpm workspaces and Turborepo, Node LTS pinned, TypeScript in strict mode.
3. Scaffold the apps: `apps/web` (Next.js, patients and providers), `apps/admin` (React single-page app), `apps/api` (NestJS).
4. Scaffold shared packages: `packages/ui`, `packages/i18n`, `packages/config` (ESLint, Prettier, tsconfig), `packages/types` (API client generated from OpenAPI), `packages/crypto`, `packages/logger`.
5. Add local development with Docker Compose: PostgreSQL, Redis, an S3-compatible store, a mail and SMS catcher. One command starts everything.
6. Add commit hooks (lint, format, type check on staged files) and conventional commit messages.
7. Build the first CI pipeline: install, type check, lint, unit tests, build, with caching. Add the pull request template carrying the definition of done.
8. Provision cloud accounts in an India region with infrastructure as code: separate dev, staging and production projects, networks, and a container registry.
9. Deploy the three empty apps to dev and staging automatically on merge; add preview deployments per pull request.
10. Write the README, contribution guide, architecture decision record template, and a `docs/` folder holding the requirements file.

### Start in parallel

- Apply for the payment gateway account, SMS provider and DLT sender registration, Aadhaar and DigiLocker verification partner, and video provider trial.
- Engage the healthcare lawyer on the regulatory points and consent wording.
- Begin design: user research with each role, information architecture, wireframes for onboarding and booking.

### Exit criteria

- [ ] A new developer can clone, run one command and see all three apps locally within 30 minutes
- [ ] A merged pull request reaches staging without manual steps
- [ ] `main` is protected and the pipeline blocks a failing build
- [ ] Third-party applications are submitted and tracked

## Step 2: Secure foundation and quality gates

Goal: every cross-cutting requirement exists as shared code and a CI check before the first feature, so features inherit security and quality instead of adding them later.

### Build

1. **Encryption.** Set up the key management service with separate keys per environment and data domain. Build the envelope-encryption library in `packages/crypto`, with field-level encryption, key versioning and blind indexes (EN-03 to EN-06, EN-09).
2. **Data classification.** Add class tags (Restricted, Confidential, Internal, Public) to the schema definition, and a check that fails when a field has no class.
3. **Database.** Set up PostgreSQL with migrations, encrypted connections, least-privilege database roles, encrypted backups to a second region.
4. **Audit log.** Build the tamper-evident audit service and the helper every Restricted read and write must call (SE-05).
5. **Auth skeleton.** Token and session handling, role-based and object-level authorisation guards, and the authorisation test harness that tries every endpoint as every role (SE-02, SE-07).
6. **Secrets and security scanning.** Secrets manager, plus static analysis, dependency, container and secret scanning in CI (EN-12, SO-03).
7. **Security middleware.** Headers, input validation, rate limiting, web application firewall (SO-05, SO-08).
8. **Logging and monitoring.** Shared logger with masking, correlation IDs, OpenTelemetry tracing, error tracking, dashboards, and one alert wired to on-call (LM-01 to LM-07).
9. **Internationalisation.** Locale routing for Odia, English and Hindi, ICU message catalogues, the lint rule against hard-coded strings, the missing-key check, and the Odia font pipeline (I18N-01 to I18N-07).
10. **Design system.** Tokens, responsive grid, base components (button, input, OTP field, card, sheet, table, toast), bottom navigation, loading, empty, error and offline states, all in Storybook with accessibility checks (UX-01 to UX-05).
11. **Testing harness.** Vitest and Testing Library, API integration tests against a real test database, Playwright projects for mobile, tablet and desktop, axe checks, visual snapshots, coverage threshold (TS-01 to TS-07).
12. **Performance gates.** Lighthouse CI and bundle budgets that fail the build (PF-01 to PF-06).
13. **PWA shell.** Manifest, service worker for the app shell only, offline banner; no sensitive data cached (PF-07, EN-11).
14. **Third-party adapters.** Interfaces and test doubles for SMS, payment, video and identity verification (TS-06).
15. **Feature flags** and the threat-model template (SO-01).

### Exit criteria

- [ ] A sample "patient note" travels end to end: entered in Odia on a phone, encrypted at field level, readable only by its owner, with an audit entry
- [ ] A test proves the note is ciphertext in the database and absent from logs
- [ ] A pull request with a hard-coded string, a missing translation, an accessibility violation, an oversized bundle or a leaked secret is blocked
- [ ] Traces show one correlation ID from browser to database
- [ ] The lawyer's first review of consent wording and the Aadhaar route is in hand

## Step 3: Accounts, identity verification and provider onboarding

Goal: every user type can sign in, and every provider type can prove identity, onboard and be approved by an admin. Supply has to exist before patients can book anything.

### Build

1. Mobile OTP sign-up and login with rate limiting and bot protection; language choice on first launch (AC-01, AC-02, SE-08).
2. Roles and permissions for patient, representative, each provider type, clinic front desk, lab, sample collector and admin sub-roles (AC-04).
3. Linked patients: add, edit and remove family members (AC-03).
4. Consent capture and storage, with versioned consent text per language (PR-01).
5. Aadhaar and DigiLocker verification through the partner adapter: consent, verification, profile pre-fill, name and photo match, masked reference only, manual fallback (KY-01 to KY-09).
6. Onboarding framework with role-specific steps and document checklists, save and resume, encrypted and virus-scanned uploads (PO-01 to PO-04).
7. Onboarding flows for doctor, dentist or dermatologist with clinic, physiotherapist, nurse, attendant (with voice prompts and assisted mode), lab and sample collector (PO-07).
8. Payout details with OTP re-verification (PO-06).
9. Admin panel shell: login with MFA, sub-roles, masked lists, audit log viewer (AD-01, AD-11).
10. Admin verification queue with identity result, document viewer, approve, reject and request changes; user management (AD-02, AD-03, AD-12).
11. Public provider profile page with verified badges (PO-05).
12. Account settings: view, correct, export and delete personal data (AC-06, PR-04).

### Checks specific to this step

- Threat model for authentication, identity verification and document storage.
- Test that the Aadhaar number never appears in the database, logs or API responses.
- Usability test of onboarding with at least five attendants and five nurses, in Odia.
- E2E tests for journeys J1 and J5.

### Exit criteria

- [ ] One provider of each type completes onboarding on a phone and is approved in the admin panel
- [ ] Identity verification works in the partner's production or sandbox environment, with the fallback path tested
- [ ] An admin cannot open a provider's documents without an audit entry
- [ ] Provider recruitment for the pilot districts begins using this build

## Step 4: Listings, availability and search

Goal: verified providers can publish what they offer and when, and a patient can find the right one for their location and language.

### Build

1. Service catalogue in admin with translations in three languages: specialities, nursing procedures, physiotherapy services, attendant tasks, dental and skin treatments, lab tests (AD-04). Build the catalogue model for all six services now, even though clinic and lab booking come in step 7.
2. Listing creation per provider type: consultation, physiotherapy visit, nursing procedure, attendant shift (SL-01 to SL-04, SL-06, SL-07).
3. Service area by district and PIN code, with the Odisha PIN code dataset loaded (SL-05).
4. Availability: weekly rules, date overrides, leave, buffer time (AV-01, AV-03, AV-04).
5. Slot generation service with slot locking in Redis (AV-02).
6. Home screen with service tiles, search with spelling tolerance across Odia, Hindi and English, and filters (SD-01 to SD-03).
7. PIN-code restriction for home services (SD-04).
8. Server-rendered, indexable listing and profile pages with structured data (SD-05).

### Checks specific to this step

- Performance budget on the search and profile pages, the first pages most patients load.
- Search relevance review with a native Odia speaker, including transliterated terms.
- Load test of slot generation and locking under concurrent requests.

### Exit criteria

- [ ] A patient in a pilot PIN code finds a verified doctor, physiotherapist, nurse and attendant with open slots
- [ ] Two users cannot hold the same slot
- [ ] Search and profile pages meet the Core Web Vitals targets on a throttled mid-range phone

## Step 5: Booking, payments and notifications

Goal: one booking engine that every service uses, with money moving correctly in both directions.

### Build

1. Booking model and state machine: pending payment, requested, confirmed, in progress, completed, cancelled, no-show, refunded, with an event history per booking (BK-01, BK-02).
2. Checkout: choose patient, slot or shift, address, attachments, fee breakdown, cancellation policy shown before payment (BK-04, BK-05).
3. Payment gateway integration through the adapter: UPI, cards, net banking, hosted fields so card data never reaches the servers, signed webhooks, idempotent handling (PY-01, PY-07).
4. Confirmation rules: instant for consultations, provider acceptance window with auto-cancel and refund for home services (BK-03, HS-01).
5. Cancel, reschedule and automatic refunds under the policy; manual refunds in admin (PY-02).
6. Receipts and invoices (PY-03).
7. Provider earnings ledger, commission calculation, payout runs through split settlement (PY-04, PY-05).
8. Background jobs: reminders, auto-cancel, payment reconciliation, with retries and a dead-letter queue.
9. Notifications: SMS with DLT-approved templates in three languages, in-app notification centre, web push; no health details in any message (NT-01 to NT-03, SE-09).
10. Booking history for patients and providers, with the non-sensitive offline summary (BK-07, BK-09).
11. Admin bookings console and finance screens (AD-05, AD-07).

### Checks specific to this step

- Threat model for payments; test duplicate webhooks, payment success with a failed booking write, and refund after payout.
- Daily reconciliation job between bookings, gateway and settlements, with an alert on mismatch.
- Business metrics and alerts for OTP delivery and payment success (LM-06, LM-07).
- Design the booking model so plan entitlements and coupons can attach in step 9 without a rewrite (BK-08).

### Exit criteria

- [ ] A patient books and pays for each of the four service types in the gateway sandbox
- [ ] Cancellation produces the correct refund; a completed booking produces the correct payout entry
- [ ] Reconciliation shows zero mismatches over a week of test traffic
- [ ] SMS templates are approved and delivered in all three languages

## Step 6: Online consultation, home services and the Stage A pilot

Goal: the four original services work end to end and go live with real providers and patients in one or two districts. This is the first time real patient data enters production.

### Build (4 to 5 weeks)

1. Video consultation through the provider adapter: pre-call device and network check, waiting room, in-browser call, audio fallback, in-call chat, no recording (OC-01, OC-02, OC-06, OC-07, EN-08).
2. Teleconsultation consent stored with the booking (OC-03).
3. Doctor's consultation workspace: patient details, reason, attachments, notes (OC-04).
4. Prescription builder and PDF with the doctor's name, qualification and registration number, stored as Restricted data (OC-05).
5. Home-visit workflow: accept or decline, address and map link, start code, visit notes, complete (HS-01 to HS-04).
6. Attendant shifts: check-in and check-out per shift, extend, end early, replacement request (HS-05).
7. "Report a safety concern" for both parties, and the complaints queue in admin (HS-06, RF-03, AD-06).
8. Ratings and reviews with reporting and moderation (RF-01, RF-02).
9. Patient-facing access history for their records (SE-06).

### Pilot readiness (3 weeks)

1. Independent penetration test; fix all high and medium findings.
2. Load test at the agreed launch volume; video trial on real rural networks.
3. Usability tests with five users per role; manual screen-reader pass.
4. Translation review by a native Odia speaker with clinical vocabulary.
5. Legal pages, consent texts, grievance officer details, provider agreement, all in three languages.
6. Support process, on-call rota, status page, breach runbook rehearsal, backup restore test.
7. Production environment hardened: named access with MFA, no shared accounts, alerts live.

### Exit criteria

- [ ] Journeys J2, J3 and J4 pass E2E tests on mobile, tablet and desktop in two languages
- [ ] No open high-severity security finding
- [ ] Enough verified providers in the pilot districts for each service (number to be agreed)
- [ ] Stage A is live in the pilot districts behind an invite or district gate
- [ ] Two weeks of pilot data reviewed: connect rate, payment success, completion rate, complaints

## Step 7: In-clinic appointments and lab tests

Goal: add the two facility-based services on top of the booking engine already running in production. Work continues behind feature flags while the Stage A pilot runs.

### Build: in-clinic appointments, dental and skin

1. Clinic profile and listing: address, map pin, timings, photos, doctors, treatments and fees (SL-08, IC-01, IC-02).
2. Clinic account with several doctors and a front-desk role that cannot see clinical notes (IC-10).
3. Search by treatment, clinic or doctor with distance (IC-03).
4. Slot booking with instant or manual confirmation, and payment options per clinic: booking fee, full amount or pay at clinic (IC-04, IC-05).
5. Check-in by code or QR, visit statuses, walk-in and phone bookings entered by front desk (IC-06, IC-07).
6. Visit summary, prescription and follow-up date; linked multi-sitting treatments (IC-08, IC-09).

### Build: lab test booking

1. Lab listing: tests and packages with price, preparation, sample type, report time, home collection (SL-09, LB-01).
2. Test cart, home collection or walk-in, prescription upload and lab rejection with refund (LB-02 to LB-04).
3. Sample collector app flow: assignment, patient sees collector details, collection code, sample identifier (LB-05, LB-06).
4. Status tracking with notifications at each step (LB-07).
5. Report upload by the lab with a confirmation step against the booking, encrypted storage, patient access (LB-08).
6. Re-collection and report correction flows (LB-10).
7. Lab dashboard and admin clinic and lab management (LB-11, AD-13).

### Checks specific to this step

- Threat model for lab reports, with a test that a report can only attach to its own booking and patient.
- Authorisation tests for front-desk, lab and collector roles.
- Tablet and desktop layouts for clinic front desk and lab dashboard, which are used at a counter.
- E2E tests for journeys J6 and J7.

### Exit criteria

- [ ] A patient books, attends and rates a dental and a skin appointment with a pilot clinic
- [ ] A patient books a lab test, has a sample collected at home, and downloads the report
- [ ] A front-desk user cannot read clinical notes; a lab cannot see another lab's orders
- [ ] Both features run in production behind flags for pilot clinics and labs only

## Step 8: E-medical report vault and the Stage B launch

Goal: every patient has one encrypted place for prescriptions, reports and medical history, and decides who sees it. The vault holds the most sensitive data in the application, so it gets its own step and its own penetration test.

### Build

1. Vault data model: records, medical history entries, shares and access events, all classed Restricted (MV-01, MV-11).
2. Automatic filing of prescriptions, visit notes, clinic summaries and lab reports already produced in steps 6 and 7, including a back-fill for pilot users (MV-02).
3. Patient uploads by camera or file, with compression, resumable upload, virus scan, type, date and provider details (MV-03, MV-04, MV-16).
4. Medical history profile: allergies, conditions, medicines, surgeries, blood group, vaccinations, family history, with attribution (MV-05).
5. Timeline with filters and metadata search; "My records" in the main navigation (MV-06).
6. Sharing: per-booking, view-only, time-limited, revocable; "Shared records" panel in the provider's booking view (MV-07, MV-08).
7. Share by expiring link with a one-time code for doctors outside the application (MV-09).
8. Access history per record, download, export and deletion rules (MV-10, MV-12).
9. Representative access and transfer of a vault when a linked patient opens their own account (MV-13).
10. Provider-added notes within a booking; storage quota; admin operations view without content (MV-14, MV-15, AD-15).

### Checks specific to this step

- Threat model for the vault and for share links.
- Sharing tests in CI: a provider cannot read unshared, expired or revoked records, or another patient's records by changing an identifier.
- Confirm no vault content is cached on the device or present in logs, analytics or notifications.
- Penetration test focused on the vault, sharing and lab reports.
- Legal confirmation of record retention and deletion rules.
- E2E test for journey J9.

### Exit criteria

- [ ] A patient uploads a record, shares it for a booking, and sees the provider's view in the access history
- [ ] Access ends automatically after the booking window and on revoke
- [ ] Vault penetration test passes with no high or medium finding open
- [ ] Stage B is live: in-clinic appointments, lab tests and the vault are open to all users in the launch districts

## Step 9: Plans, referrals and admin completion

Goal: add the commercial layer (care packages, subscriptions, referral coupons) and finish the admin panel, so the operator can run the business without engineering help.

### Build

1. Plan definitions in admin: care packages and subscriptions with entitlements, validity, price and covered family members; approval of provider-defined packages (PK-01, PK-02, AD-14).
2. Plan pages with inclusions, exclusions, renewal and cancellation terms in three languages (PK-03).
3. Purchase flow and entitlement ledger; checkout draws on entitlements automatically (PK-04, BK-08).
4. Recurring payments: UPI Autopay and card mandates, pre-debit notice, retry and pause on failure, cancel at any time (PK-05, PK-06, PY-06).
5. Pro-rata refunds and per-session provider payouts for packages (PK-07).
6. Expiry and low-balance reminders (PK-08).
7. Referral codes and share links, admin-configurable reward rules, coupons issued after the qualifying event, provider referral as commission discount (RR-01 to RR-05, RR-08).
8. Coupon application at checkout, one per booking.
9. Abuse controls: device and number limits, self-referral block, velocity limits, review queue (RR-06, AD-16).
10. Remaining admin screens: configuration, content and templates, dashboard and reports, security console (AD-08 to AD-10, AD-17).

### Checks specific to this step

- Invariant tests: entitlement use never exceeds purchase; a coupon is used at most once; a refund never exceeds the amount paid.
- Mandate tests in the gateway sandbox: renewal, failure, retry, cancellation.
- Legal review of plan terms, auto-renewal wording and referral rules, including the ban on rewards for steering patients to providers.
- Daily reconciliation extended to plan purchases, renewals and payouts.
- E2E test for journey J8.

### Exit criteria

- [ ] A patient buys a package and a subscription, uses entitlements across services, and cancels auto-renewal
- [ ] A referral produces a coupon only after the invited user's first completed booking
- [ ] Entitlements and payments reconcile daily with zero mismatch for two weeks
- [ ] Operations staff can change prices, policies, templates and plans without a deployment

## Step 10: Hardening, launch readiness and go-live

Goal: prove the whole application is secure, fast and supportable at full scope, then open it across Odisha district by district and watch it closely.

### Harden

1. Full-scope penetration test and dynamic scan; fix findings and re-test.
2. Load and soak test at the agreed full-launch volume; tune queries, caching and autoscaling.
3. Full E2E regression of journeys J1 to J9 on all viewports and in all three languages; visual regression review.
4. Accessibility audit against WCAG 2.2 AA with manual screen-reader passes on TalkBack, VoiceOver and NVDA.
5. Real-device performance check of Core Web Vitals on low-end Android over 3G and 4G.
6. Disaster recovery drill: restore from backup in the second region within the 4-hour target; key rotation drill.
7. Access review: remove unused accounts and permissions; confirm no production data outside production.
8. Fraud review of referral, coupon and refund paths.

### Prepare the launch

1. Final legal sign-off: terms, privacy notice, consent texts, provider, clinic and lab agreements, tax treatment.
2. Support readiness: trained staff, help content in three languages, escalation paths, safety-incident procedure.
3. Operations runbooks: deployment, rollback, incident response, breach response, on-call rota.
4. Monitoring review: dashboards, alert thresholds, uptime checks from India, public status page.
5. Provider supply check per district and per service; rollout order agreed.
6. Search engine setup, analytics without sensitive data, app install prompt.

### Go live

1. Go or no-go meeting against the checklist below.
2. Release Stage C behind flags; enable district by district, starting with the pilot districts.
3. Hypercare for four weeks: daily review of errors, payment and OTP success, video connect rate, complaints and security alerts; fixes shipped daily.
4. Review the success metrics after four weeks and plan the fast-follow items.

### Go-live checklist

- [ ] No open high or medium security finding; penetration test report signed off
- [ ] Performance, accessibility and E2E gates green on the release build
- [ ] Backup restore and rollback rehearsed within the last 30 days
- [ ] Legal sign-off received on all published documents and on the Aadhaar and DigiLocker route
- [ ] Payment, refund, mandate and payout reconciliation clean for two weeks
- [ ] Support team staffed for launch hours in Odia, Hindi and English
- [ ] On-call rota and incident channels in place; status page live
- [ ] Minimum verified providers reached in each launch district
- [ ] Operator and product owner give the go decision
