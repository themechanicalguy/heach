# Lawyer review pack: consent wording and the Aadhaar route (Step 2 exit, D6)

For a healthcare and data-protection lawyer practising in India. The Step 2 exit criterion is
"the lawyer's first review of consent wording and the Aadhaar route is in hand"
([guideline](../mvp-v1-implementation-guideline.md), Step 2).

Status: **not yet reviewed.** Nobody has been contacted; the owner chooses and engages the lawyer.
Everything below was written by the engineering team from general knowledge; none of it is legal
advice and none of it has been checked against current law.

## The product in brief

HEACH is a web app for patients in Odisha to find, book and pay verified care providers: online
doctor consultation, home physiotherapy, home nursing, bedside attendants, dental and skin clinic
appointments and lab tests. Providers prove identity with Aadhaar-based verification and DigiLocker
documents and are approved by an admin. Patients keep prescriptions, reports and history in an
encrypted record vault and can share chosen records with a provider for one booking. Data is held
only in AWS Mumbai (ap-south-1), encrypted at field level for health and identity data. Screens
are in Odia, English and Hindi. Children and dependants are managed by a representative (MV-13).

Requirement IDs below refer to [the requirements](../mvp-v1-requirements.md).

## Questions

### A. Aadhaar and identity verification (KY-01, "Regulatory points to confirm")

1. Which route may a private health platform use for Aadhaar-based identity verification of
   providers and patients: DigiLocker (issued Aadhaar document), offline Aadhaar verification
   (paperless XML or QR), or a licensed KYC partner (AUA/KUA or sub-AUA)? Which do you recommend
   for a small company, and what registrations does each require from us?
2. We plan never to store the Aadhaar number; we keep name, date of birth, gender, photo and
   address from the verified record, plus a reference to the verification. Is that permitted, and
   must the photo or address also be excluded or masked?
3. May we verify patients (not only providers) this way, or must patients have a non-Aadhaar
   alternative? What alternative identity documents must we accept?
4. Is the draft consent text in section C1 sufficient for Aadhaar and DigiLocker use?

### B. Data protection (DPDP Act 2023 and Rules)

5. Which notice contents are mandatory at sign-up, and must the notice be available in Odia and
   Hindi as well as English (our three languages)? Any rule on the 22 scheduled languages?
6. Health records shared by a patient with a provider for one booking (MV-07): is consent per
   share enough, and what must the provider see about purpose and duration?
7. Representatives and children (MV-13): what counts as verifiable consent of a parent or guardian
   for a child's health data, and what changes when the child turns 18?
8. Consent withdrawal (PR-01): what must happen to data already processed, and to records a
   provider has already viewed?
9. Breach notification (SO-09): to whom (Data Protection Board, CERT-In, users), in what time,
   with what content?
10. Retention: is there a minimum or maximum period for consultation records, prescriptions and
    audit logs that we must follow?
11. Are we a Significant Data Fiduciary risk, and does keeping all data in India settle any
    cross-border transfer questions (we use AWS Mumbai only; a weekly encrypted backup copy is
    pulled to the owner's computer in India)?

### C. Draft consent wording to mark up

Drafts in English; Odia and Hindi follow after your approval. Each would show before the action,
with "Agree" and "Not now", and each agreement is stored and can be withdrawn in Settings.

1. **Identity verification (before Aadhaar or DigiLocker):**
   "To confirm who you are, HEACH will ask DigiLocker for your name, date of birth, gender, photo
   and address, and the documents you choose to share. We do not keep your Aadhaar number. We use
   these details only to verify your identity and show them to you and our verification team. You
   can withdraw this consent at any time; we will then stop using the details, but verified
   providers may not be able to keep offering services."
2. **Sign-up (notice and consent):**
   "HEACH stores your mobile number, profile and the health records you add, encrypted, in India.
   We use them to arrange your care, send booking messages and keep your records for you. We do
   not sell your data or use it for advertising. You can see, correct, download or delete your
   data, and withdraw consent, in Settings. Contact: [grievance officer]."
3. **Teleconsultation (OC-03):**
   "You are starting a video consultation with Dr [name], registration [number]. The doctor will
   see the reason and records you share and may write a prescription. Some medicines cannot be
   prescribed online. If this is an emergency, call 112 instead."
4. **Sharing records (MV-07):**
   "Share the selected records with [provider] for booking [date]? They can view, not download,
   until [end time]. You can stop sharing at any time."

### D. Telemedicine and provider registration

12. Do the Telemedicine Practice Guidelines 2020 still apply as written, and what must the
    doctor's profile and e-prescription show? Which medicine lists apply?
13. Which registrations must we check for each provider type before listing: doctors (state
    council or National Medical Register), dentists (State Dental Council), nurses (Odisha Nurses
    and Midwives Council), physiotherapists (allied and healthcare professions framework), clinics
    and labs (Odisha clinical establishments law)? Are bedside attendants regulated at all, and how
    should we present them so they are not mistaken for clinical staff?
14. As a marketplace that takes payment and a commission, what is our liability for a provider's
    care, and what must our terms say?

## What we need back

- Marked-up consent texts (C1 to C4) or replacements.
- The recommended Aadhaar route (A1) with any registrations we must make.
- Short answers to the other questions, or which ones need a longer opinion.
- Anything in the product description above that worries you.

| Reviewer | Date | Result |
| --- | --- | --- |
| | | |
