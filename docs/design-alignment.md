# Design alignment (G01–G19)

The record of aligning the patient, provider and admin interfaces with the design reference
`apps/web/design-mockup.html` (17 boards), after the design gap audit of 4 November 2026
(findings G01–G19). The audit found the lavender-and-peach palette already matched; the gaps were
in how it was applied, in layout hierarchy, density and interaction patterns. This page records
the choices made, what changed for each finding, the files, and the browser and test evidence.

The work ships as stacked pull requests, each passing `pnpm check`:

| Part | Branch                        | Findings                                  |
| ---- | ----------------------------- | ----------------------------------------- |
| 1    | `feat/design-shell-home`      | G01–G05, G14, G16; G13 and G15 foundation |
| 2    | `feat/design-onboarding`      | G06; G13 and G15 for onboarding           |
| 3    | `feat/design-booking`         | G07–G09; G13 for booking                  |
| 4    | `feat/design-records`         | G10–G12; G13 for records                  |
| 5    | `feat/design-admin`           | G17–G19; coverage closed                  |

## Decisions

Owner decisions of 4 November 2026, and the design choices from the alignment brief:

- **Selected boards.** Home: service-first on phones (Home A) with a compact search, and the
  desktop home's companion column (board 13). Onboarding: the checklist hub (Onboarding B) with
  focused task steps and the desktop step rail (board 14). Booking: the stepped slot picker
  (Booking B) with a bottom action area on phones and the desktop sticky receipt (board 15).
  Records: timeline first (Records A), the desktop health-profile column (board 16), and upload,
  edit and share as focused tasks. Admin: the queue with a side panel (Admin A) and a focused
  document review (Admin B) where needed.
- **Emergency.** One treatment everywhere, sign-in included: a peach card with a heading, a short
  explanation and a dark Call 108 button. Not the red strip of Home A.
- **Single language per route.** The boards' bilingual subtitles are not restored (I18N-01).
- **Deferred services.** No doctor consultation or dental and skin tiles, video Join action or
  consultation payment examples ([ADR 0015](adr/0015-defer-online-consultation-and-clinic-appointments.md)).
  The four MVP services take the white tile; no service is promoted into the doctor card's
  purple slot.
- **Identity.** The identity-partner handoff stays; no direct Aadhaar entry.
- **Truthful content.** No invented helpline numbers, company details, prices, statistics or
  reviews; pending configuration stays marked as pending (FU-43).
- **Mobile booking bar** shows the listing's service fee; the total appears only at the server's
  payment review.
- **Admin district filter** is left out: applications record no district. Search, role, status,
  waiting time and identity result are real filters.

## Reference boards

| Board | Reference                         | Status         | Notes                                                                              |
| ----- | --------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| 00    | Home A: service tiles             | Selected       | Phone home (part 1). Doctor and dental tiles omitted (ADR 0015); red strip replaced by the peach card. |
| 01    | Home B: search and next booking   | Partly used    | Its lavender next-booking panel is used; its search-led order is not.              |
| 02    | Home C: care by location          | Alternative    | Not used.                                                                          |
| 03    | Onboarding A: one step per screen | Partly used    | Focused task steps inside the checklist flow (part 2).                             |
| 04    | Onboarding B: checklist hub       | Selected       | Part 2.                                                                            |
| 05    | Onboarding C: assisted/voice      | Alternative    | Voice-first onboarding is a separate product idea; not built, nothing voice added. |
| 06    | Booking A: scrolling page         | Superseded     | Replaced by Booking B's structure (part 3).                                        |
| 07    | Booking B: stepped slot picker    | Selected       | Part 3.                                                                            |
| 08    | Records A: timeline               | Selected       | Part 4.                                                                            |
| 09    | Records B: profile first          | Alternative    | Profile reached from the timeline on phones, not first (part 4).                   |
| 10    | Records C: share with consent     | Selected task  | The selected-record share task (part 4).                                           |
| 11    | Admin A: queue and side panel     | Selected       | Part 5; district column and filter left out (no data).                             |
| 12    | Admin B: focused split review     | Selected task  | Document review mode (part 5).                                                     |
| 13    | Desktop home                      | Selected       | Part 1. Search icon and voice microphone not added (no voice feature).             |
| 14    | Desktop onboarding                | Selected       | Part 2, with the identity-partner handoff in place of direct Aadhaar entry.        |
| 15    | Desktop booking                   | Selected       | Part 3.                                                                            |
| 16    | Desktop records                   | Selected       | Part 4.                                                                            |

## Findings

| ID  | Finding                              | Status (part)   | What changed                                                                                     |
| --- | ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------ |
| G01 | Compact mobile shell                 | Done (1)        | One 64 px header row on phones: person, language, alerts bell, menu. Plans, Help and Sign out moved into the menu. |
| G02 | Home layout hierarchy                | Done (1)        | Compact search above the tiles; desktop companion column for next booking, emergency and help.   |
| G03 | Positional service colours           | Done (1)        | `nth-child` colours removed; white tiles with explicit lavender wells; records tile in the grid with a peach well. |
| G04 | Next-booking emphasis                | Done (1)        | Lavender panel; primary action by state (complete payment, show start code), Details secondary, status otherwise. |
| G05 | Emergency and support cards          | Done (1)        | One emergency card (heading, explanation, Call 108) on home, services, contact and sign-in; help card. |
| G06 | Onboarding visual system             | Pending (2)     |                                                                                                  |
| G07 | Date and time picker                 | Pending (3)     |                                                                                                  |
| G08 | Mobile booking action area           | Pending (3)     |                                                                                                  |
| G09 | Desktop booking receipt              | Pending (3)     |                                                                                                  |
| G10 | Records browsing first               | Pending (4)     |                                                                                                  |
| G11 | Records scanning cues                | Pending (4)     |                                                                                                  |
| G12 | Health profile and sharing entry     | Pending (4)     |                                                                                                  |
| G13 | Desktop layout widths                | Partial (1)     | Width tokens (form 40 rem, app 75 rem, site 76 rem) and `.page--app`; home uses the app width with a 20 rem side column. Onboarding, booking and records follow in parts 2–4. |
| G14 | Footer dominance                     | Done (1)        | Compact footer (help and legal links, company line) on task screens and once signed in; full directory on public pages while signed out; no second language switch. |
| G15 | Typography and density               | Partial (1)     | Type scale (28 px phone, 32 px desktop titles), compact button and emergency button variants, brand-coloured plain links. Status, receipt, filter and admin variants follow. |
| G16 | Programmatic focus styling           | Done (1)        | One branded focus ring for every control; script-focused headings show a peach marker, never the browser's blue. |
| G17 | Admin verification queue             | Pending (5)     |                                                                                                  |
| G18 | Admin review workspace               | Pending (5)     |                                                                                                  |
| G19 | Admin typography, labels, statuses   | Pending (5)     |                                                                                                  |

### Part 1: shell, home, emergency and footer

Files: `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/globals.css`,
`packages/ui/ui.css` (type, width, emergency and focus tokens; compact and emergency buttons),
`packages/ui/src/Icon.tsx` (bell, search, menu, chevrons, plus, upload, share, clock, pill, edit,
users), `apps/web/src/components/HeaderMenu.tsx` (new), `HeaderAccount.tsx` (`SignOutButton`),
`LanguageSwitch.tsx`, `lib/use-dismiss.ts` (shared), `site/HeaderCare.tsx`, `site/PatientHome.tsx`,
`site/CareFinder.tsx` (compact variant), `site/NextBooking.tsx`, `site/EmergencyCard.tsx` (new),
`site/EmergencyBanner.tsx`, `site/SupportCard.tsx` (new), `site/SiteFooter.tsx` (`AppFooter`),
`site/FooterSwitch.tsx` (new), `site/NearbyProviders.tsx`, `care/ServiceTiles.tsx`,
`account/SignInFlow.tsx`, `visit/PatientVisitPanel.tsx` (start-code anchor),
`lib/client-messages.ts`. Seven new `site.*` keys in or, en and hi (draft Odia and Hindi, FU-41).

Measured with synthetic data in Chromium (before: the audit; after: this branch):

| Measure (patient home)                    | Before          | After          |
| ----------------------------------------- | --------------- | -------------- |
| Patient header height, 390 × 844          | 177 px          | 65 px          |
| Provider header height, 360 px            | 121 px          | 65 px          |
| First service row, 390 × 844              | y ≈ 1,037 px    | y ≈ 359 px     |
| First service row, 1280 × 800             | y ≈ 770 px      | y ≈ 242 px     |
| Desktop page title                        | 40 px           | 32 px          |
| Footer after a task screen, phone         | about 1,500 px  | about 150–200 px |

Evidence:

- Unit and component tests: `header.test.tsx` (header order and menus for signed-out, patient and
  provider; Escape returns focus; sign-out), `site/site.test.tsx` (home order, tile tones, next
  booking action per state, emergency card), `site/footer.test.tsx` (which footer on which route
  and session state; compact footer links).
- Browser tests (Linux container against a production build, mobile 360, tablet 768, desktop
  1280, in or/en/hi): `shell.spec.ts` and `site-pages.spec.ts` 144 passed, 3 project skips.
  New checks: one-row header on phones and desktops, the alerts bell, the first tile above the
  bottom navigation, the desktop side column, the emergency card's heading, text and 48 px Call
  108 action, and the onboarding heading's focus marker. Visual baselines for the shell, patient
  home, contact, booking, records and onboarding pages were regenerated after review of each
  render; the booking, records and onboarding baselines change only in their header and footer
  here.
- A 200% text check found the compact search's fixed PIN column widened the phone page to
  393 px; the columns are now proportional and the check passes.
- Route sweep at 360 and 1280 px with synthetic responses: public home, services, legal, contact,
  provider join, sign-in, welcome, account, people, bookings, booking detail, plans, referral,
  notifications, records, provider application, provider services, requests, earnings, lab and
  team. No horizontal overflow and no browser exceptions.
