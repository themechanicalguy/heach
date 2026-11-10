# Demo data (local only)

`pnpm demo:seed` fills a fresh local database with a working HEACH: providers across six Odisha
cities, applications waiting for review, patients with a family member, and a booking history in
every state. Every step goes through the real API, the same journeys a person would take
(sign-up by OTP, onboarding, admin approval, booking, sandbox payment, acceptance, start code,
visit notes, lab report, rating). A few steps that need a clock or have no API route write to the
database directly (below). It refuses to run unless `APP_ENV` is `local` or `test`.

## Run it

```sh
pnpm services:reset && pnpm dev:up   # an empty database (wipes local data)
pnpm demo:seed                       # about 15 seconds
```

It runs once per database. To start again, reset as above.

## Sign in

| Who | How |
| --- | --- |
| Patient Ananya Mohapatra (Saheed Nagar, 751007), with her mother as a linked patient | `9000000101`, code from the Mailpit inbox |
| Patient Rakesh Sahoo (Cuttack, 753012) | `9000000102` |
| Patient Itishree Nayak (Patia, 751024) | `9000000103` |
| Physiotherapist Sasmita Pradhan | `9000000201` |
| Nurse Mamata Behera | `9000000202` |
| Attendant Jagannath Rout | `9000000203` |
| Lab Ekamra Demo Diagnostics (Prasanta Mishra) | `9000000204` |
| Applications waiting for review: physio, nurse, attendant | `9000000301` to `9000000303` |
| Other providers | `9000000400` to `9000000433` |
| Admins: `super@`, `verifier@`, `support@`, `finance@demo.heach.invalid` | Password in `.demo-credentials.json` (git-ignored); `pnpm demo:totp verifier` prints the current code |

## What the demo opens with

- **Ananya:** four finished bookings over the last four weeks (two physio sessions, her mother's
  wound dressing, a CBC with lipid profile and HbA1c with its report), each rated; one physio
  assessment cancelled with a refund; tomorrow's injection (with a prescription) and a three-day
  attendant booking for her mother, both confirmed; one geriatric physio request **waiting for
  Sasmita to accept**. That request lapses and is refunded after the 30-minute acceptance window,
  as BK-03 requires, so accept it soon after seeding or book a new one.
- **Rakesh and Itishree:** four more finished, rated visits with other providers, and a thyroid
  test confirmed with a Cuttack lab, so search shows a spread of ratings.
- **Admin:** three applications in the verification queue to approve or reject; the bookings
  console, finance, reviews and dashboard with the above.

Try the full loop: Ananya books a new visit and pays in the sandbox, Sasmita accepts it from the
provider app, Ananya shows the start code, and the admin follows it in the bookings console.

## Data and sources

- **People are synthetic.** Common Odia given names and surnames combined, numbers in the unused
  `90000` series, made-up house numbers on real localities. No real patient or provider data is
  used, and no provider listing was copied from any website. Lab names carry "Demo".
- **PIN codes** ([`apps/api/demo/odisha-pins.csv`](../apps/api/demo/odisha-pins.csv)): the 925
  Odisha codes in India Post's All India Pincode Directory on
  [data.gov.in](https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month)
  (Government Open Data License – India; snapshot of 30 May 2019), one district per code (the
  head or sub office's), district names in today's spelling (Khordha, Baleswar, Deogarh,
  Subarnapur, Sundargarh, Jajpur, Nabarangpur, Jagatsinghpur). One Haryana code listed under
  Odisha in the source was dropped. The seed loads all of them; the 81 codes of Bhubaneswar,
  Cuttack, Puri, Berhampur, Sambalpur and Rourkela are served, the rest are known but not served,
  so a super admin can start serving one (AD-08). This is demo data only: decision D-PIN stays open.
- **Fees** sit near the prices published for Bhubaneswar in November 2026, each provider within
  ±15 %: home physiotherapy ₹700–1,200 a session (published range ₹700–1,000, Medifyhome;
  ₹300–2,000, HomeTriangle), nursing procedures ₹300–1,000, attendant shifts ₹800–1,400 (published
  ₹500–1,500 a day for caretakers), lab tests ₹100–600 (Max Lab lipid profile ₹330, glucose with
  HbA1c ₹450). Figures from aggregator listings, not a survey.

## Direct database steps

Only in [`apps/api/demo/db.mjs`](../apps/api/demo/db.mjs), and only local or test:

- loading the PIN codes (no API adds a code);
- moving a booking to start now so it can be carried out (as `e2e-support/move-booking.mjs`);
- spreading each finished booking over a believable day (booked the evening before, finished at
  the end of the slot, a lab report a few hours later) and dating it back up to four weeks.
  Only the booking's own rows move; the audit log and the earnings ledger keep their real times.

## Notes

- Each synthetic person sends from their own documentation-range address (RFC 5737) in
  `X-Forwarded-For`, as separate phones would, so the per-address OTP limits (SE-08) apply to
  each person rather than stopping the seed.
- After `pnpm services:reset`, restart the API if it was running: it keeps unwrapped data keys in
  memory, and the reset database has new ones.
