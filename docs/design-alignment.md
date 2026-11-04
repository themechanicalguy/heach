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
| G06 | Onboarding visual system             | Done (2)        | Checklist overview with a purple completion card (tasks done, not step position) and done, in-review, needs-attention and next states; one focused task at a time with "Step n of N"; desktop step rail. |
| G07 | Date and time picker                 | Done (3)        | Day strip (a week; earlier and later arrows past a week) and the day's free times in morning, afternoon and evening; unavailable days shown and disabled; on the profile, chosen-provider and any-provider pages. Times only from the server. |
| G08 | Mobile booking action area           | Done (3)        | Bottom action area above the navigation with the chosen time, the listed fee and Continue; fields scroll clear of it; the payment review's Pay sits there too. |
| G09 | Desktop booking receipt              | Done (3)        | Numbered sections and a sticky receipt as siblings (no card in a card); receipt shows provider, time, listed fee and the server's policy; the payment review is the final receipt with the server's fee, travel, discount and total. |
| G10 | Records browsing first               | Done (4)        | The upload and external-link editors are off the page; Add record and Share open them as sheets (native modal dialogs); the timeline is the page. |
| G11 | Records scanning cues                | Done (4)        | Person and type chips and one search box instead of three stacked fields; rows with type icon wells, type and date, and an issued-by or added-by-you badge; details and actions open within the row. |
| G12 | Health profile and sharing entry     | Done (4)        | Health profile as a short summary by kind with Edit (editor in a sheet); encryption note and storage use beside it; Share on each record opens the link task with that record chosen. Phones stay timeline first with the profile after. |
| G13 | Desktop layout widths                | Done (1–4)      | Width tokens (form 40 rem, app 75 rem, site 76 rem) and `.page--app`; home uses the app width with a 20 rem side column; onboarding a 19 rem rail beside the task within 69 rem (part 2); booking a 20 rem receipt beside the sections within 69 rem (part 3); records a 20 rem profile column beside the timeline within 72 rem (part 4). |
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

### Part 2: provider onboarding

Files: `apps/web/src/components/onboarding/tasks.ts` (new: task states from the application),
`OnboardingChecklist.tsx` (new: status card and checklist), `OnboardingView.tsx` (overview and
task panels), `IdentityStep.tsx` and `PayoutForm.tsx` (no card inside the task card),
`packages/ui/src/Progress.tsx` (`min`, for completion counts that start at zero),
`apps/web/src/app/[locale]/provider/page.tsx` (app width), `globals.css`. Eleven new
`application.*` keys per locale (draft Odia and Hindi, FU-41).

- **States.** Each task's state comes from the application, never from the screen: identity
  (not started, waiting, verified, failed), documents (a required file missing, a refused or
  rejected file, files waiting for review after submission), payout (on file or not) and
  submission (draft, submitted or under review, changes requested, decided). The first task the
  provider can act on is outlined with Start; in review is peach; needs attention is red.
- **Completion and position.** The purple card's bar counts tasks done (`aria-valuemin` 0); a
  task screen shows "Step n of N" as text. The old position bar presented as progress is gone.
- **Behaviour kept.** Identity still leaves for the partner's consent page (no Aadhaar entry);
  documents, payout (with the fresh code) and submission call the same endpoints; the submit
  button stays disabled while anything is missing; a submitted application is read only.
- **Phones.** The overview (title, status card, checklist, status note, Continue in the bottom
  action area) or one task with All steps, Back and Continue; never both.
- **Desktop.** The checklist is a sticky step rail beside the task; its state words are kept
  for screen readers while the markers show the state.

Evidence: `onboarding/tasks.test.ts` (every state rule), `onboarding.test.tsx` (overview,
completion apart from position, Continue to the next task, All steps; titles through every task
in or/en/hi; upload, payout, submission and the identity handoff unchanged). Browser:
`site-pages.spec.ts` "Onboarding B" on three viewports in or/en/hi with axe, the focus marker and
two reviewed baselines (overview and task); the API-backed `onboarding-journey.spec.ts` and
`sign-in-setup.spec.ts` now open tasks from the checklist. Rendered with synthetic applications
at 360, 768 and 1280 px: new draft, identity waiting with one document uploaded (Odia), a task
open, and under review (Hindi), with no overflow or browser exceptions.

### Part 3: booking

Files: `apps/web/src/components/booking/DayTimePicker.tsx` (new), `BookingReceipt.tsx` (new:
receipt and `PolicyNote`), `BookingForm.tsx` (sections, receipt, bottom action area),
`BookingReview.tsx` (final receipt), `BookPages.tsx`, `care/ProviderProfileView.tsx` (the
picker on the profile), `lib/slots.ts` (new: India-day grouping), `packages/i18n/src/format.ts`
(`formatTime`, `formatWeekday`, `formatDayOfMonth`, `formatMonthYear`),
`packages/ui/src/ChoiceGroup.tsx` (`variant="chips"` for who, gender and collection),
book page wrappers (app width), `globals.css`. Thirteen new `book.*` keys per locale (draft,
FU-41).

- **Server authority kept.** The picker shows only times the server returned (AV-02, 7 days, as
  the "next 7 days" copy says; no API change) and the slot is still held and checked at
  `POST /bookings`. Before booking, the receipt and bar show only the listing's fee (or, for any
  provider, the quote as "up to"), and say the total comes before payment; the payment review
  shows the fee, travel, discount and total the server froze on the booking. The cancellation
  policy is the server's and is not shown until its numbers arrive.
- **One form, two Continue buttons.** The receipt's button (desktop) and the bar's (phones and
  tablets) both submit the same form through `form=`; CSS shows one at a time.
- **Scope difference.** The board's month arrows page a 14-day horizon; the services return
  7 days, so the arrows appear only when a horizon longer than a week is asked for.

Evidence: `lib/slots.test.ts` (India day, parts of the day, month end), `booking/picker.test.tsx`
(grouping, selection, disabled days, week paging, receipt without a total, no partial policy),
`booking.test.tsx` and `care.test.tsx` (booking body, prescription, review and pay, any provider,
lab cart, profile link after choosing a time), `format.test.ts` (new formatters). Browser:
`site-pages.spec.ts` "Booking B" on three viewports in or/en/hi (pressed time, seven days, one
visible Continue inside the viewport on phones, fee in the bar or receipt, no total, axe, 200%
text) with reviewed baselines; the journey spec chooses the time in the picker. Probed at 360
and 1280 px: an empty address focused by validation stays between the header and the bar; the
review shows ₹600 fee, ₹50 travel, −₹100 discount and the server's ₹550 total with Pay ₹550.
A 200% text check caught the bar's button widening the phone page; the bar now wraps.

### Part 4: records

Files: `apps/web/src/components/vault/VaultView.tsx` (browsing composition, filters, task
sheets), `RecordRow.tsx` (new), `HealthProfile.tsx` (new: summary and editor sheet),
`UploadForm.tsx` and `LinkForm.tsx` (moved out of the view, now focused tasks),
`record-types.ts` (new: types, kinds, icon wells), `VaultTimeline.tsx` (one row layout at every
width), `RecordCard.tsx` (source badge), `RecordActions.tsx` (Share), `SharePanels.tsx` (import),
`packages/ui` (`image` icon; sheets scroll within 92% of the viewport), `lib/client-messages.ts`
(`ui.close`), `test/dialog.ts` (new: modal dialogs in jsdom), vault page wrapper (app width),
`globals.css`. Eight new `vault.*` keys per locale (draft, FU-41).

- **Unchanged.** Every read, upload, deletion, access history, history entry and link goes to
  the same endpoints with the same bodies; the server still decides what may be opened, shared
  or deleted. Links keep the server's 1–72 hour limit (now 24, 48 or 72 hour chips).
- **Desktop table to rows.** The desktop table is replaced by the same rows as phones, so
  authorship, type and date read the same everywhere; clinical details stay collapsed until the
  row is opened.
- **Scope difference.** Records C's consent screen with day-length choices (7 and 30 days) is not
  copied: links last at most 72 hours. Booking shares keep their own panel on the booking page.

Evidence: `vault.test.tsx` (browsing first with no upload or link form; type chips filter the
search; who viewed and delete; Add record, save and the sheet closing with "Saved."; Edit and add
history; Share on a record preselects it and creates a 72-hour link; authorship in the row
summary with clinical details collapsed). Browser: `site-pages.spec.ts` "Records A" on three
viewports in or/en/hi (no editors by default, row icons and badges, profile column left of the
timeline on desktop, the upload sheet opening and closing with Escape, axe in both states, 200%
text) with reviewed baselines. Rendered with synthetic records at 360, 768 and 1280 px: populated
with four sources and a linked person (en, or), empty (hi), and each sheet. The 200% text check
caught grids sized to their content widening the phone page; every records grid now shrinks.
