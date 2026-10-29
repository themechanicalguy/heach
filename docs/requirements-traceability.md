# Requirements traceability

- **Status:** Draft for owner review (28 October 2026), with the [web roadmap](web-roadmap.md).
  It proposes where each requirement is built and proved; the owner decides. Where it assigns a
  step the guideline does not (documentation gap 1), that is proposed amendment A1 and applies
  only once merged into the guideline.
- **Owns:** for every requirement ID in the [requirements](mvp-v1-requirements.md) (224 IDs plus
  DC-01 from the Step 2 spec) and for journeys J1 to J9: the slice that builds it, the step, what it
  depends on, and how it is proved. Status today is copied from
  [implementation status](implementation-status.md) on 28 October 2026; that page stays the record.
- **Deferred beyond the MVP (29 October 2026):** journeys J2 and J6, modules OC and IC, and
  SL-01, SL-08, EN-08 and A11Y-06 are out of scope for the MVP, with no release promised
  ([ADR 0015](adr/0015-defer-online-consultation-and-clinic-appointments.md); [requirements](mvp-v1-requirements.md#deferred-beyond-the-mvp)). Their rows stay,
  marked **deferred beyond the MVP**; no MVP exit gate needs them, and they are not counted as
  unfinished MVP work. Shared requirements (AC-04, PO-05, BK-03, PR-01, LB-09, MV-02, PK-01,
  PK-02, AD-04, AD-13, LM-06, LM-07) keep their MVP part.
- **Not here:** criterion IDs. The proof column says what kind of test each requirement needs.

Slice keys (`3.1`, `5.4`) are the [web roadmap](web-roadmap.md)'s labels; a feature spec number is
assigned when it is specified. "DoD" means the requirement applies to every slice through the
definition of done and is completed in the step named.

Proof codes: **U** unit, **C** component with axe, **I** API integration on real PostgreSQL and
Redis, **Z** authorisation matrix (every role, other users' objects), **X** encryption assertion
(ciphertext in the database, absent from logs and unauthorised responses), **E** Playwright E2E on
mobile, tablet and desktop in at least two languages, **L** Lighthouse or bundle budget in CI,
**S** partner sandbox in the nightly suite, **M** manual check with dated evidence in the spec.

Status: ✅ Done, 🟡 Partial, ⬜ Not started.

## Journeys

Each journey is completable on a 360 px phone in the user's language, in a supported browser
(UX-08), with no native app. TS-04 requires each as an E2E test on three viewports in at least two
languages; Step 10 runs all three languages.

| Journey | Steps that complete it | Slices | E2E proof (proposed file) | Third parties (double in CI, sandbox nightly) | Exit gate that needs it |
| --- | --- | --- | --- | --- | --- |
| J1 Provider self-onboarding | 3 | 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.10 (outcome SMS) | `apps/web/e2e/j1-provider-onboarding.spec.ts`, one run per provider type | SMS, identity | Step 3: every provider type onboards and is approved |
| J2 Online doctor consultation (**deferred beyond the MVP**) | 4 (find), 5 (book and pay), 6 (consult, prescription, rating) | 4.6, 5.2 to 5.4, 5.8, 6.1 to 6.3, 6.7 | `j2-online-consultation.spec.ts` | Payment, SMS, video | Deferred beyond the MVP |
| J3 Home visit (physiotherapist or nurse) | 4, 5, 6 | 4.3, 4.6, 5.2 to 5.4, 6.4, 6.7 | `j3-home-visit.spec.ts` | Payment, SMS | Step 6 |
| J4 Bedside attendant | 4, 5, 6 | 4.2, 4.6, 5.2 to 5.4, 6.5 | `j4-attendant-shifts.spec.ts` | Payment, SMS | Step 6 |
| J5 Admin verifies a provider | 3 | 3.9, 3.10 | `apps/admin/e2e/j5-verification.spec.ts` (desktop and tablet) | Identity | Step 3 |
| J6 In-clinic appointment (**deferred beyond the MVP**) | 7 | 7.1 to 7.5, 6.7 | `j6-clinic-appointment.spec.ts` (patient phone, front desk tablet) | Payment, SMS | Deferred beyond the MVP |
| J7 Lab test | 7 | 7.6 to 7.10 | `j7-lab-test.spec.ts` (patient, collector phone, lab desktop) | Payment, SMS | Step 7 |
| J8 Plans and referral reward | 9 | 9.1 to 9.3, 9.6 | `j8-plans-referrals.spec.ts` | Payment with mandates, SMS | Step 9 |
| J9 Vault records and sharing | 8 | 8.1 to 8.7 | `j9-vault.spec.ts` | None | Step 8: Stage B |

## Security and data protection

### Data classification

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| DC-01 | ✅ | Every slice (DoD): every new field classified in its spec and migration | Step 2 classification check | Existing CI check fails an unclassified field |

### Encryption (EN)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| EN-01 | 🟡 | 6.9 trusted certificate (FU-20) | Domain or IP certificate decision | M: TLS scan of the pilot host |
| EN-02 | 🟡 | 5.1 (queue at rest), 6.9 (log store) | D-QUEUE | M: storage settings recorded per store |
| EN-03 | ✅ | DoD for every Restricted field | `@heach/crypto` | X per slice |
| EN-04 | 🟡 | 6.9 production keys | Production ADR (A8) | M: KMS policy check per environment |
| EN-05 | 🟡 | 10.6 rotation drill; schedule FU-26 | Production keys | M: drill record |
| EN-06 | 🟡 | 6.9 production keys per domain | Production ADR | U and M (as Step 2) |
| EN-07 | 🟡 | 3.4 secure upload pipeline (reused by 5.2, 7.7, 7.10, 8.2) | D-SCAN | I: per-object key, scan before availability, signed URL after access check |
| EN-08 | ⬜ | 6.1 (**deferred beyond the MVP**) | Video provider (#22) | M: provider contract and DTLS-SRTP check; I: no recording endpoint |
| EN-09 | ✅ | 3.1 mobile lookup by blind index | Step 2 blind index | X: no plaintext mobile column |
| EN-10 | 🟡 | Step 2 (FU-01 to FU-05); 10.6 | Spec 006 runs | M: four weekly records; DR drill |
| EN-11 | 🟡 | 5.9 offline summary and wipe; 8.x vault never cached | Service worker | E: storage inspected after sign-out |
| EN-12 | 🟡 | 6.9 (Secrets Manager decision, FU-21) | Production ADR | M |
| EN-13 | ✅ | DoD | Step 2 assertions | X per slice |

### Access control and audit (SE)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| SE-01 | ⬜ | 3.2 ownership model; every later slice | 3.2 | Z per slice (provider sees only own active or recent bookings) |
| SE-02 | ✅ | DoD | Authz harness | Z |
| SE-03 | ⬜ | 6.8 break-glass (amendment A4) | 3.9 | I: ticket, reason, expiry, audit |
| SE-04 | 🟡 | 3.9 admin MFA, short sessions, allow-list or device trust; export controls in 5.10 and 3.9 | FU-18 | I and E admin |
| SE-05 | 🟡 | DoD (every Restricted read and write, every admin action from 3.9); retention in 6.9 | Step 2 audit | I: audit entry per action |
| SE-06 | ⬜ | 6.8 (bookings), 8.7 (vault) | SE-05 | E: patient sees access history |
| SE-07 | 🟡 | 3.1 (OTP sign-in), 3.8 (OTP re-verification) | Specs 001, 004, 007 | I |
| SE-08 | ⬜ | 3.1 (sign-up, login), 9.7 (referral redemption) | Spec 002 limiter | I: throttles by device, IP and number |
| SE-09 | 🟡 | 5.8 message text; DoD no-store on Restricted screens | 5.8 | I: template lint for health terms; header test |

### Privacy and consent (PR)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| PR-01 | ⬜ | 3.3 (sign-up), 3.6 (identity), 6.2 (teleconsult, deferred beyond the MVP), 8.5 (sharing) | Lawyer wording (FU-06) | I: consent stored before the gated action; withdrawal |
| PR-02 | ⬜ | 3.3 data-model review; DoD | Charter decision | M: spec review rejects unused personal fields |
| PR-03 | ⬜ | 3.6 | Identity adapter | X: no Aadhaar number in database, logs, responses |
| PR-04 | ⬜ | 3.12 | 3.1, 3.8 | I and E |
| PR-05 | ⬜ | 6.9 retention job (amendment A5) | 5.1 jobs; lawyer on medical records | I: job deletes or anonymises past retention |
| PR-06 | 🟡 | 6.9 processor agreements | Partners chosen | M: signed agreements listed |
| PR-07 | 🟡 | 6.9 analytics and monitoring | FU-22 | I: payload test for pseudonymous IDs only |

### Secure development and operations (SO)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| SO-01 | ✅ | DoD: threat model in every plan | Threat model per module | Review |
| SO-02 | ⬜ | DoD (ASVS L2 checklist per plan); 10.1 | None | M: checklist in plan; pen test |
| SO-03 | 🟡 | Ongoing | CI | CI gates |
| SO-04 | ⬜ | 6.9 (pilot pen test), 8.x (vault pen test), 10.1 | FU-24 | M: reports |
| SO-05 | ✅ | DoD | Step 2 middleware | Existing tests |
| SO-06 | 🟡 | 6.9, 10.7 | Production ADR | M: access review |
| SO-07 | 🟡 | 6.9 (separate production), 10.7 | Production ADR | M |
| SO-08 | 🟡 | 6.9 WAF decision (FU-21); 9.9 anomaly alerts | FU-25 if a second process | I and M |
| SO-09 | ⬜ | 6.9 breach runbook rehearsal | Operator named (Q-OPERATOR) | M: rehearsal record |
| SO-10 | 🟡 | 10.6 | Spec 006; FU-23 | M: drill within 4 hours |

## Functional requirements

### Accounts and access (AC)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| AC-01 | ⬜ | 3.1 | Spec 008; SMS adapter | I, E |
| AC-02 | ⬜ | 3.1 (first launch and any screen) | Locale routing (Step 2) | E |
| AC-03 | ⬜ | 3.2 | 3.1 | I, Z, E |
| AC-04 | ⬜ | 3.2 | 3.1 | Z |
| AC-05 | ⬜ | 3.1 (persistence), 3.8 (re-verification) | Step 2 sessions | I |
| AC-06 | ⬜ | 3.12 | 3.1 | I, E |

### Provider onboarding and profile (PO)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| PO-01 | ⬜ | 3.5 framework, 3.7 role checklists | 3.2 | I |
| PO-02 | ⬜ | 3.4 | D-SCAN | I, E (camera and file) |
| PO-03 | ⬜ | 3.5 | 3.4 | E (save, close browser, resume) |
| PO-04 | ⬜ | 3.5 | 3.4 | U state machine; I |
| PO-05 | ⬜ | 3.11 | 3.10 | E, L |
| PO-06 | ⬜ | 3.8 | 3.1 | I, X |
| PO-07 | ⬜ | 3.7 (voice prompts), 3.10 (assisted mode) | Recorded Odia audio | E; M usability with attendants |

### Identity verification (KY)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| KY-01 | ⬜ | 3.6 | Q-AADHAAR, FU-06, #21 | I with the double; S |
| KY-02 | ⬜ | 3.6 | #21 | I; S |
| KY-03 | ⬜ | 3.6 | 3.5 | I |
| KY-04 | ⬜ | 3.6 | 3.10 manual review | I |
| KY-05 | ⬜ | 3.6 | Identity domain key | X |
| KY-06 | ⬜ | 3.6 | 3.5 | I: submission refused without verification |
| KY-07 | ⬜ | 3.6 | 3.4, 3.10 | E fallback path |
| KY-08 | ⬜ | 3.6 | Port exists | I: timeout and retry with the double |
| KY-09 | ⬜ | 3.11 (badge), 3.10 (admin view) | 3.6 | E |

### Service listings (SL)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| SL-01 | ⬜ | **Deferred beyond the MVP** (was 4.2) | 4.1 | I |
| SL-02 | ⬜ | 4.2 | 4.1 | I |
| SL-03 | ⬜ | 4.2 | 4.1 | I |
| SL-04 | ⬜ | 4.2 | 4.1 | I: no clinical tasks for attendants |
| SL-05 | ⬜ | 4.3 | D-PIN | I |
| SL-06 | ⬜ | 4.1 | None | I |
| SL-07 | ⬜ | 4.2 | None | I |
| SL-08 | ⬜ | 7.1 (**deferred beyond the MVP**) | 4.1, 3.7 | I |
| SL-09 | ⬜ | 7.6 | 4.1, 3.7 | I |

### Availability and scheduling (AV)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| AV-01 | ⬜ | 4.4 | 4.2 | U |
| AV-02 | ⬜ | 4.5 | 4.4, Redis | I concurrency; load test |
| AV-03 | ⬜ | 4.4 | None | U |
| AV-04 | ⬜ | 4.4 | None | U |

### Search and discovery (SD)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| SD-01 | ⬜ | 4.6 | 4.1 | E |
| SD-02 | ⬜ | 4.6 | D-SEARCH | I; M Odia relevance review |
| SD-03 | ⬜ | 4.6 | 4.4 | I, E |
| SD-04 | ⬜ | 4.3 | D-PIN | I |
| SD-05 | ⬜ | 3.11 (profiles), 4.7 (listings) | SSR | E, L |

### Booking (BK)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| BK-01 | ⬜ | 5.1 | 4.5 | I |
| BK-02 | ⬜ | 5.1 | None | U every transition |
| BK-03 | ⬜ | 5.4 | 5.1 jobs | I |
| BK-04 | ⬜ | 5.2 (shown), 5.5 (applied) | Q-COMMISSION | I, E |
| BK-05 | ⬜ | 5.2 (device), 8.5 (vault) | 3.4 | I, Z |
| BK-06 | ⬜ | 5.8 | 5.1 jobs | I |
| BK-07 | ⬜ | 5.9 | Service worker | E offline |
| BK-08 | ⬜ | 5.2 (hooks), 9.2 (entitlements), 9.6 (coupons) | 5.2 | I invariants |
| BK-09 | ⬜ | 5.9, 7.5 | 5.4 | E |

### Online consultation (OC)

**Deferred beyond the MVP** (ADR 0015): every OC row below.

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| OC-01 | ⬜ | 6.1 | #22 | E with double; S; M rural trial |
| OC-02 | ⬜ | 6.1 | 6.1 | E with simulated bandwidth |
| OC-03 | ⬜ | 6.2 | 3.3 | I |
| OC-04 | ⬜ | 6.2 | SE-01 | Z |
| OC-05 | ⬜ | 6.3 | D-PDF | I, X |
| OC-06 | ⬜ | 6.1 | 5.1 jobs | I |
| OC-07 | ⬜ | 6.1 | Provider settings | M contract; I no recording |

### Home service delivery (HS)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| HS-01 | ⬜ | 5.4 | 5.3 | I |
| HS-02 | ⬜ | 6.4 | 5.4 | Z: address only after confirmation |
| HS-03 | ⬜ | 6.4 | None | I |
| HS-04 | ⬜ | 6.4 | None | I, X |
| HS-05 | ⬜ | 6.5 | 5.4 | I, E |
| HS-06 | ⬜ | 6.6 | 3.9 | I |

### In-clinic appointments (IC)

**Deferred beyond the MVP** (ADR 0015): every IC row below.

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| IC-01 | ⬜ | 4.1 (catalogue data), 7.1 | 4.1 | I |
| IC-02 | ⬜ | 7.1 | 3.4 photos | E |
| IC-03 | ⬜ | 7.2 | D-SEARCH, D-PIN | I |
| IC-04 | ⬜ | 7.3 | 4.5 | I |
| IC-05 | ⬜ | 7.3 | 5.3, Q-CLINIC-PAY | I, E |
| IC-06 | ⬜ | 7.4 | None | E tablet |
| IC-07 | ⬜ | 7.4 | None | I |
| IC-08 | ⬜ | 7.5 | 6.3 | I, X |
| IC-09 | ⬜ | 7.5 | 5.1 | I |
| IC-10 | ⬜ | 7.1 | 3.2 | Z: front desk cannot read clinical notes |

### Lab test booking (LB)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| LB-01 | ⬜ | 4.1 (catalogue data), 7.6 | 4.1 | I |
| LB-02 | ⬜ | 7.7 | 4.3 | I |
| LB-03 | ⬜ | 7.7 | 5.2 | E |
| LB-04 | ⬜ | 7.7 | 3.4, 5.5 | I |
| LB-05 | ⬜ | 7.8 | 3.7 collectors | E |
| LB-06 | ⬜ | 7.8 | None | I |
| LB-07 | ⬜ | 7.9 | 5.8 | I |
| LB-08 | ⬜ | 7.10 | 3.4 | I, X, Z |
| LB-09 | ⬜ | 8.1 (filing), 8.5 (sharing) | 7.10 | I |
| LB-10 | ⬜ | 7.10 | None | I |
| LB-11 | ⬜ | 7.11 | None | E desktop |

### E-medical report vault (MV)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| MV-01 | ⬜ | 8.1 | 3.2 | I |
| MV-02 | ⬜ | 8.1 | Steps 6 and 7 records | I including back-fill |
| MV-03 | ⬜ | 8.2 | 3.4 | E |
| MV-04 | ⬜ | 8.2 | None | I |
| MV-05 | ⬜ | 8.3 | None | I, X |
| MV-06 | ⬜ | 8.4 | None | E |
| MV-07 | ⬜ | 8.5 | 3.3 consent | I; TS-09 sharing tests |
| MV-08 | ⬜ | 8.5 | None | Z |
| MV-09 | ⬜ | 8.6 | None | I |
| MV-10 | ⬜ | 8.7 | SE-05 | I, E |
| MV-11 | ⬜ | 8.1 | 3.4, 6.8 | X; E nothing cached on the device |
| MV-12 | ⬜ | 8.7 | PR-05 | I |
| MV-13 | ⬜ | 8.8 | 3.2, 3.6 | I |
| MV-14 | ⬜ | 8.5 | None | Z |
| MV-15 | ⬜ | 8.2 | Q-VAULT | I |
| MV-16 | ⬜ | 8.2 | 3.4 | E throttled network |

### Care packages and subscriptions (PK)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| PK-01 | ⬜ | 9.1 | 4.1 | I |
| PK-02 | ⬜ | 9.1 | Q-PLANS | I |
| PK-03 | ⬜ | 9.1 | None | E three languages |
| PK-04 | ⬜ | 9.2 | 5.2 | I invariants |
| PK-05 | ⬜ | 9.3 | #19 mandates | S |
| PK-06 | ⬜ | 9.3 | None | I, E |
| PK-07 | ⬜ | 9.4 | 5.7 | I invariants |
| PK-08 | ⬜ | 9.5 | 5.8 | I |

### Referral rewards (RR)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| RR-01 | ⬜ | 9.6 | None | E |
| RR-02 | ⬜ | 9.6 | Q-PLANS | I |
| RR-03 | ⬜ | 9.6 | 5.4 | I |
| RR-04 | ⬜ | 9.6 | 5.7 | I |
| RR-05 | ⬜ | 9.6 | None | I: no reward path exists for a patient's booking |
| RR-06 | ⬜ | 9.7 | SE-08 | I |
| RR-07 | ⬜ | 9.6 | None | Z: no health or booking detail |
| RR-08 | ⬜ | 9.6 | 5.2 | I |

### Payments and payouts (PY)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| PY-01 | ⬜ | 5.3 | #19 | I; S |
| PY-02 | ⬜ | 5.5, 5.10 (manual) | 5.3 | I |
| PY-03 | ⬜ | 5.6 | D-PDF | I |
| PY-04 | ⬜ | 5.7 | 5.5 | I |
| PY-05 | ⬜ | 5.7 | 5.1 jobs | I; S |
| PY-06 | ⬜ | 9.3 | #19 | S |
| PY-07 | ⬜ | 5.3 | Hosted checkout | I and M: no card fields in our pages |

### Notifications (NT)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| NT-01 | ⬜ | 3.1 (OTP), 3.10 (verification outcome), 5.8 (bookings) | #20 DLT | I; S |
| NT-02 | ⬜ | 5.8 | D-PUSH | E (centre); M push on Android and installed iOS |
| NT-03 | ⬜ | 5.8 (3.1 for OTP text) | Translations | I: recipient's language |

### Ratings and feedback (RF)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| RF-01 | ⬜ | 6.7 | 5.4 | I |
| RF-02 | ⬜ | 6.7 | 3.9 | I |
| RF-03 | ⬜ | 6.6 | 5.1 | I, E |

### Admin panel (AD)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| AD-01 | ⬜ | 3.9 | FU-18, D-ADMIN-MFA | I, E admin |
| AD-02 | ⬜ | 3.10 | 3.6, amendment A9 | E (J5) |
| AD-03 | ⬜ | 3.10 | 3.2 | I |
| AD-04 | ⬜ | 4.1 (six types, amendment A2) | 3.9 | I |
| AD-05 | ⬜ | 5.10 | 5.5 | E |
| AD-06 | ⬜ | 6.6 | 6.8 for health data | E |
| AD-07 | ⬜ | 5.10 | 5.7 | I: CSV without Restricted data |
| AD-08 | ⬜ | 9.8 | Configuration used since Step 4 | I |
| AD-09 | ⬜ | 9.8 (legal pages earlier from i18n, amendment A6) | None | E |
| AD-10 | ⬜ | 9.8 | LM-06 metrics | E |
| AD-11 | ⬜ | 3.9 | SE-05 | I |
| AD-12 | ⬜ | 3.10 | 3.1 OTP consent | I |
| AD-13 | ⬜ | 7.11 (labs; clinics deferred beyond the MVP) | 7.6 | E |
| AD-14 | ⬜ | 9.1 | None | E |
| AD-15 | ⬜ | 8.9 | 8.2 | Z: no record content |
| AD-16 | ⬜ | 9.7 | 9.6 | I |
| AD-17 | ⬜ | 9.9 | 6.8 | I |

## Cross-cutting requirements

### Performance (PF)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| PF-01 | 🟡 | DoD; 4.7 (search and profile), 10.5 | Real device | L; M real device |
| PF-02 | ✅ | DoD | Bundle budget | L |
| PF-03 | ✅ | DoD, extended to each new key page | Lighthouse CI | L |
| PF-04 | ⬜ | DoD from 3.1 (API latency metric); 10.2 | LM-05 | Load test |
| PF-05 | ✅ | DoD | Build | L |
| PF-06 | ✅ | DoD | CI | L |
| PF-07 | 🟡 | 5.9 (last-viewed bookings, queued actions) | Service worker | E offline |

### Accessibility (A11Y)

All seven are unassigned in the guideline today (documentation gap 1). Proposed: built in every
slice through the definition of done, audited in Step 10.

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| A11Y-01 | ⬜ | DoD; 10.4 audit | None | C and E axe; M audit |
| A11Y-02 | ⬜ | DoD; manual pass in 6.9 and 10.4 | None | M TalkBack, VoiceOver, NVDA |
| A11Y-03 | ⬜ | DoD (tokens already give 48 px targets); 3.7 attendants | `packages/ui` | C; M 200% zoom |
| A11Y-04 | ⬜ | DoD from 3.1 forms | `Field`, `TextField` | C |
| A11Y-05 | ⬜ | Locale layout (Step 2); verify in 3.1 | i18n routing | E `lang` per locale |
| A11Y-06 | ⬜ | 6.1 (**deferred beyond the MVP**) | Video SDK | E keyboard; M screen reader |
| A11Y-07 | ⬜ | DoD (axe exists); manual pass per release | None | CI; M |

### Multi-language (I18N)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| I18N-01 | ✅ | DoD | None | Existing |
| I18N-02 | ✅ | DoD | Lint rule | CI |
| I18N-03 | ✅ | DoD; 5.2 fee display | None | U |
| I18N-04 | ✅ | DoD for names, addresses, notes | UTF-8 | I with Odia and Devanagari input |
| I18N-05 | ⬜ | 4.1 catalogue; 5.8 templates | None | I |
| I18N-06 | ✅ | DoD | Fonts | TS-07 visual |
| I18N-07 | 🟡 | FU-07 (Step 2); native review of new keys before each step exit | Reviewer | CI missing-key check; M review |

### Testing (TS)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| TS-01 | ✅ | DoD | CI | Coverage gate |
| TS-02 | ✅ | DoD | Storybook | C |
| TS-03 | ✅ | DoD for every endpoint | Test DB | I |
| TS-04 | ⬜ | Journey E2E as each journey completes (table above); 10.3 | Doubles | E |
| TS-05 | 🟡 | Nightly full suite from Step 3 (first journey) | CI schedule | CI |
| TS-06 | 🟡 | Real adapters and sandbox runs from 3.1, 3.6, 5.3, 6.1 | Partners | S |
| TS-07 | ✅ | DoD for key screens in three languages | Baselines | Visual snapshots |
| TS-08 | ⬜ | 6.9 (pilot volume), 10.2 (full) | Q-LOAD | Load test record |
| TS-09 | 🟡 | 8.5 sharing tests, 9.2 invariants; authz and encryption in every slice | None | Z, X, I |

### Logging and monitoring (LM)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| LM-01 | 🟡 | 5.1 (jobs carry the correlation ID) | D-QUEUE | I |
| LM-02 | 🟡 | Spec 008 (Step 2) | Owner approval | U per spec 008 |
| LM-03 | 🟡 | 6.9 central tracking (FU-22) | Pilot decision | M |
| LM-04 | 🟡 | 6.9 network type | RUM endpoint | I |
| LM-05 | 🟡 | 6.9 central metrics and traces (FU-22) | Pilot decision | M |
| LM-06 | ⬜ | 3.1 (OTP delivery), 5.11 (payment, acceptance), 6.1 (video) | Metrics pipeline | I: event emitted |
| LM-07 | 🟡 | 3.1 (OTP failures), 5.11 (payment, queue backlog), 6.1 (video) | SNS topic | M synthetic alert per path |
| LM-08 | ⬜ | 6.9 uptime from India, status page | Production ADR | M |
| LM-09 | 🟡 | 3.9 (admin actions); retention in 6.9 | SE-05 | I |

### User experience (UX)

| ID | Today | Slice (step) | Depends on | Proof |
| --- | --- | --- | --- | --- |
| UX-01 | ✅ | DoD: new components in `packages/ui` with stories | Storybook | C |
| UX-02 | ✅ | DoD | Breakpoints | E three viewports |
| UX-03 | ✅ | DoD | Bottom navigation | E |
| UX-04 | ✅ | DoD | `States` component | C |
| UX-05 | ✅ | DoD; 3.1 OTP autofill (web fallbacks) | `OtpField` | E |
| UX-06 | ⬜ | 5.2 | 5.1 | E: five steps or fewer from home |
| UX-07 | ⬜ | Step 3 onboarding test (attendants, nurses); 6.9 per role | Participants | M |
| UX-08 | ⬜ | DoD browser matrix (web roadmap fallbacks); 10.3 | Device lab or cloud browsers | E Chromium, WebKit, Firefox projects; M Samsung Internet |
