# Implementation status

- **Last updated:** 30 October 2026: plan use per covered person and the family-member limit (PK-02, PK-04; branch `feat/plan-per-person`). Before that, 30 October 2026: the slot hold time is an operations setting (AD-08, migration 0013, branch `feat/slot-hold-time`). Before that, 30 October 2026: a reminder when one plan unit is left (PK-08) and the admin purchases view (AD-14) (branch `feat/plans-reminders-admin-purchases`). Before that, 30 October 2026: browser journeys J3, J4, J7, J8 and J9 in the API-backed E2E job in all three languages and on every viewport (branch `chore/e2e-booking-journeys`, FU-40 in part), and a provider or service name box on the web search page (SD-02). Before that, 30 October 2026: completing Step 9 (branch `feat/step-9-renewals-content`): subscription renewal through a gateway mandate with a pre-debit notice, retries and pause (PK-05, PY-06, against the gateway double); notification wording and static pages edited by operations without a deployment (AD-09); provider-to-provider referrals rewarded with commission back (RR-04); migration 0012. Before that, 30 October 2026: Step 10 runbooks (branch `docs/step-10-runbooks`): incident response, personal data breach response (SO-09, Partial) and attendant replacement (A13), with follow-ups FU-37 to FU-40; no code changed. Before that, 30 October 2026: plans, referrals and the admin console (branch `feat/step-9-plans-referrals`): care packages and subscriptions with an entitlement ledger drawn at checkout, purchases paid through the gateway port, pro-rata cancellation refunds, an expiry reminder and an auto-renew switch; referral codes with share links, coupons only after the invitee's first completed booking, one coupon per booking, abuse controls with an admin review queue; admin plans, referrals, settings (fresh TOTP), dashboard and security console (PK-01 to PK-04, PK-06 to PK-08 with PK-07 partial, RR-01 to RR-03, RR-05 to RR-08, AD-07, AD-08, AD-10, AD-14, AD-16, AD-17). Before that, 30 October 2026: the e-medical record vault (branch `feat/step-8-vault`): records and the medical history for the account and each linked patient, all content encrypted; visit notes and lab reports filed automatically and attributed to the provider, corrections replacing the filed report; patient uploads with type, date, facility, tags and notes; timeline with person, type, date and text filters; per-booking sharing with the provider, view only, until 24 hours after the booking and revocable, with the provider's "Shared records" panel; providers adding records within a booking; external links for doctors outside HEACH with a one-time code, expiry and revocation; an access history per record; export, own-upload deletion and a storage quota; admin vault counts without content (MV-01 to MV-12, MV-14 to MV-16, LB-09, AD-15). Before that, 30 October 2026: lab tests: a lab cart of several tests from one lab in one booking with home collection or walk-in and the collection charge only at home, the lab's acceptance or prescription rejection with refund, collector assignment from the lab's own approved collectors, collection confirmed with the patient's code creating a booking-linked sample ID, receipt, the PDF report checked against the sample ID and stored encrypted for the booker and the lab only, corrections and re-collection with reasons, a notification at each stage, the lab dashboard and the admin lab view (LB-01 to LB-08, LB-10, LB-11, AD-13). Before that, 30 October 2026: home services: the patient's one-time code starts a visit or checks a shift in and out, encrypted visit notes complete the visit and earn the provider, each attendant shift earns its share, patient and provider absences (amendments A12, A15) with strikes and a review at the third, safety concerns as P0 tickets with an alert and the emergency runbook (A17), complaints with status tracking, ratings and reviews with reporting and hiding, the admin tickets queue with break-glass access that the patient can see, ratings in search and profiles, and "Book again" (HS-01 to HS-06, RF-01 to RF-03, AD-06, SE-03, SE-06, BK-09). Before that, 30 October 2026: booking, payments and notifications: checkout with the fee breakdown frozen on the booking and the slot held, sandbox payment through the gateway port with signed, de-duplicated webhooks as the only way out of Pending payment, the acceptance window with auto-cancel and full refund, "any available provider" waves (amendment A10) with an atomic first accept and the price difference refunded, prescription review at acceptance (A14), the cancellation policy with automatic refunds, the attendant advance and balance (Q-ADVANCE), reminders, in-app notifications and booking SMS in three languages, the earnings ledger with a weekly payout run and reversals, daily reconciliation, a PostgreSQL job runner (D-QUEUE), and the admin bookings and finance consoles (BK-01 to BK-08, PY-01 to PY-05, PY-07, NT-01 to NT-03, AD-05, AD-07). Before that, 30 October 2026: listings, availability and search: the service catalogue for the four MVP services in or, en, hi with prescription flags and lab test details (migration 0006); Approved providers list items of their own service with fee, duration and pause, choose serviceable PIN codes and a travel charge, set weekly hours, a buffer and leave; slots are generated in IST with buffers, leave and a lead time and held for 10 minutes in Redis; public search by service and PIN code with text, language, gender and fee filters, public provider profiles with the identity badge and nursing registration, home-screen service tiles; admin catalogue and PIN code pages (SL-02 to SL-07, SL-09, AV-01 to AV-04, SD-01 to SD-05, AD-04, AD-08). Before that, 30 October 2026 (#102): provider onboarding and the verification queue: role checklists for physiotherapist, nurse, attendant, lab and sample collector with police verification for everyone who visits a home (owner decision Q-POLICE); document upload (PDF, JPEG, PNG up to 5 MB, type checked against the bytes, scanned, encrypted in the documents domain before storage, infected files quarantined) behind new object-store and virus-scanner ports with test doubles; identity check through the identity port (no Aadhaar number stored); payout details after a fresh OTP, encrypted as Restricted; submit; admin queue with review, document viewer, per-document accept or reject, approve, request changes and reject, each audited with an application event history and an SMS to the provider (PO-01 to PO-04, PO-06, KY-01, KY-05, KY-06, KY-08, AD-02, AC-05, NT-01). Before that, 30 October 2026: header account controls: signed out, the header button reads "Sign in / Sign up" and the navigation has no "Account" item; signed in, "Account" is in the navigation and the header has a "Sign out" button that signs this device out (SE-07.10) and goes home; on phones under 420 px the language pill shows its globe only (name kept for screen readers) so the header stays one row; `log-out` icon in `@heach/ui`; `nav.signIn` text changed and new key `nav.signOut` in or, en, hi await native review (FU-07); unit tests in `header.test.tsx`, E2E `sign-in-setup.spec.ts` (SE-07.10 header test), shell baselines regenerated; no requirement status changed. Before that, 29 October 2026 (#100): owner scope decision, [ADR 0015](adr/0015-defer-online-consultation-and-clinic-appointments.md): online doctor consultation (OC, SL-01, EN-08, A11Y-06, J2) and in-clinic dental and skin appointments (IC, SL-08, J6) are out of scope for the MVP and deferred beyond it, with no release promised; requirement IDs kept and marked, shared requirements (AC-04, PO-05, BK-03, PR-01, LB-09, MV-02, PK-01, PK-02, AD-04, AD-13, LM-06, LM-07) revised to keep their MVP part. Deferred IDs now have their own column in the module table and are not counted as unfinished MVP work. AC-04 stays Done for the MVP roles; the server refuses the deferred roles (doctor, dentist, dermatologist, clinic front desk) at setup, adding a role, invitations, sign-in, switching, refresh and on live tokens while `doctor-and-clinic` is off, keeping grants and drafts (AC-04 row). Owner follow-ups FU-35 (data rights for role-less accounts) and FU-36 (native review of the new keys) added. Earlier update: account flows for every role (#99)
- **Current step:** Step 2 of the [implementation guideline](mvp-v1-implementation-guideline.md): not complete. Corrective specs 001 to 005 and 007 are Done (owner accepted 25 October 2026); spec 006 deployed and awaiting its four weekly runs. Exit pending: lawyer review (D6, an exit criterion) and native Odia review (I18N-07), both being arranged by the owner; four weekly runs of the deployed spec 006 restore check (SC-001, 1 to 22 November 2026); the guideline's step-end demo on a real Android phone, not recorded ([audit](step-1-2-audit.md), [follow-up register](follow-up-register.md#closes-step-2)) ([matrix](step-2-acceptance-matrix.md))

This page separates what is built from what is only specified. The
[requirements](mvp-v1-requirements.md) say _what_ to build and the
[guideline](mvp-v1-implementation-guideline.md) says _in what order_; neither tracks progress. An item is Done when its requirement is met as written and proved by
tests or a recorded check. (Steps 1 and 2 were also judged against step and feature specs, now
in the [archive](archive/README.md), [ADR 0013](adr/0013-retire-spec-driven-development.md).)
Update this page in the same pull request that changes a status; the pull request template
checks for it (rule in [`CLAUDE.md`](../CLAUDE.md#working-rules)).

| Status | Meaning |
| --- | --- |
| ✅ Done | Built, tested in CI, meets the requirement as written |
| 🟡 Partial | Some of it is built; the gap is stated |
| ⬜ Not started | Specified only |

## Step 1: Repository and app initialization

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Repository with branch protection on `main` | 🟡 Partial | Not enabled. The repository is now public (checked 22 October 2026), so GitHub Free allows protection: the API answered `Branch not protected` (HTTP 404, no longer 403). The premise of [ADR 0004](adr/0004-github-free-no-branch-protection.md) (stay private) no longer holds and the switch to public is not recorded in an ADR; settings proposed for the owner in [environments](environments.md#branch-protection-on-main). Until then: PR-only process and the pre-push hook. Commits on `main` are signed by GitHub's squash merge (last 20 verified) |
| 2 | Monorepo, pnpm + Turborepo, Node LTS, TypeScript strict | ✅ Done | [ADR 0001](adr/0001-monorepo-and-stack.md) |
| 3 | App shells `web`, `admin`, `api` | ✅ Done | API has `/healthz`, `/readyz`, OpenAPI |
| 4 | Shared packages `ui`, `i18n`, `config`, `types`, `crypto`, `logger` | ✅ Done | Scaffolded in Step 1 (`crypto` then an interface only); `crypto` implemented in Step 2 (envelope encryption, blind indexes); `flags` added in Step 2 |
| 5 | Local services with one command | ✅ Done | `pnpm dev:up` ([local development](local-development.md), [ADR 0002](adr/0002-local-services.md)) |
| 6 | Commit hooks and conventional commits | ✅ Done | [ADR 0003](adr/0003-quality-gates-without-new-dependencies.md) |
| 7 | CI pipeline with caching; PR template with definition of done | ✅ Done | `.github/workflows/ci.yml`, `.github/pull_request_template.md` |
| 8 | Cloud in an India region with IaC: dev, staging, production | 🟡 Partial | Dev stack applied (one lean host, ADR 0008): ports 80/443 only, admin via Session Manager, 4 KMS keys, uploads bucket, nightly snapshots. Region pinned to `ap-south-1`. No managed databases, load balancer or separate accounts ([cloud setup](cloud-setup.md), ADRs [0005](adr/0005-aws-dev-environment.md), [0006](adr/0006-infra-layout-and-state.md)). Staging and production folders exist but are not provisioned |
| 9 | Auto-deploy to dev and staging; preview deploy per PR | 🟡 Partial | Deploy to dev on merge: OIDC, image scan gate, SSM deploy, smoke test, rollback to the previous tag. No staging, no previews (replaced by dev only, ADR 0009). Re-runs of the same commit skip the build because ECR tags are immutable. First green Deploy dev on `main`: `5f5c956`, 18 October (scan gate passed, smoke test passed). Gap: it logged "Previous tag: none", so rollback had no target on that run. Since then every deploy records its target (latest: `952f35067ca1` for `338943c`), but the rollback step itself has run 11 times (17 and 18 October) and failed every time; it has never succeeded. Drill: [FU-12](follow-up-register.md#step-1-items-still-open) |
| 10 | README, contributing guide, ADR template, `docs/` | ✅ Done | |

### Step 1 exit criteria

Walked through on 17 October 2026, with the changes in [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md).

| Criterion | Status | Evidence |
| --- | --- | --- |
| New developer runs all three apps locally within 30 minutes | 🟡 Partial | `pnpm dev:up` ([local development](local-development.md)); CI's E2E smoke job starts all three from a clean checkout. Not yet timed on a fresh machine, so "within 30 minutes" is unproven (was marked Done; corrected by the [audit](step-1-2-audit.md), 25 October 2026) |
| Merged PR reaches staging without manual steps | 🔁 Replaced by dev only, see ADR 0009 | Deploy dev runs after CI on `main`: first deploy of `52272c8990c8` answered on `https://15.252.65.98/api/readyz` (PostgreSQL and Redis ok). Scan gate, smoke test and rollback added in B3 (PR #17). Merge of PR #30 deployed `5f5c956ff9a2` with scan, deploy and smoke test passing ([run](https://github.com/themechanicalguy/heach/actions/runs/39063937336)) |
| `main` protected; pipeline blocks a failing build | 🟡 Partial | CI fails on a failing build (9 checks on every PR). Branch protection is available since the repository became public (22 October: HTTP 404 `Branch not protected`) but not enabled; owner decision pending ([environments](environments.md#branch-protection-on-main)). Red CI does block the deploy (24 October: Deploy dev skipped for `36e82ac` and `525e9cf`), but nothing blocks a merge: #75 merged with two failing checks ([FU-10](follow-up-register.md#step-1-items-still-open)) |
| Third-party applications submitted and tracked | 🟡 Partial | Tracked: issues #19 to #25 (label `partner-onboarding`). Submitting them is the account holder's task. Checked 25 October 2026: none submitted; all seven issues have no comment, assignee or milestone since 17 October. Step 3's exit needs the identity partner's sandbox (#21) ([FU-09](follow-up-register.md#step-1-items-still-open)) |
| Credit-expiry alerts active and tested, including simulated levels (playbook) | 🟡 Partial | github-oidc applied (18 October plan: no changes); GitHub variables set; real run reports ok, $120 of $120; simulated Watch, Plan, Act and Emergency each updated issue #29. All alert paths (levels, plan not ACTIVE, burn rate, failed check) verified locally with stubbed `gh`/`aws`; burn rate now alerts on its own. Labelled test alert published 18 October ([run](https://github.com/themechanicalguy/heach/actions/runs/39065434862)). Scheduled runs green every day 18 to 25 October (checked 25 October; latest: $117.37 of $120, ACTIVE, 173 days left). The subscription is confirmed (1 confirmed, 0 pending, checked 24 and 25 October) and the topic's delivery to the inbox is proven by the two Step 2 synthetic alerts (received 25 October). AWS Scheduler reminders (18 March and 10 April 2027, 09:00 IST) and budgets exist. Still unproven: an email from Credit watch itself; one address only; the owner's own calendar reminders ([FU-11](follow-up-register.md#step-1-items-still-open)). The 18 October records (confirmed at 01:38 IST, PendingConfirmation at 16:18 IST) are superseded. `dev-sleep`/`dev-wake` tested 18 October: host stopped and `/api/healthz` stopped answering; after wake the smoke test passed |
| ADR lists every requirement relaxed for the pilot (playbook) | ✅ Done | [ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md) |

## Development process

| Item | Status | Notes |
| --- | --- | --- |
| Spec-driven development ([ADR 0007](adr/0007-spec-driven-development.md), [ADR 0011](adr/0011-spec-kit-feature-specs.md)) | Retired | Retired on 28 October 2026 by [ADR 0013](adr/0013-retire-spec-driven-development.md): constitution, Spec Kit, spec checks and rules removed; specs 001 to 008 and the step specs kept in the [archive](archive/README.md) |

## Requirements by module

Every module not listed under "Partial" below is ⬜ Not started, except IDs deferred beyond the MVP ([ADR 0015](adr/0015-defer-online-consultation-and-clinic-appointments.md)): those are counted apart, are not unfinished MVP work and gate no MVP step.

| Module | IDs | Done | Partial | Not started | Deferred beyond MVP | Planned in step |
| --- | --- | --- | --- | --- | --- | --- |
| DC Data classification | DC-01 (Step 2 spec) | 1 | 0 | 0 | 0 | 2 |
| EN Encryption | 13 | 3 | 9 | 0 | 1 (EN-08) | 2 |
| SE Access control and audit | 9 | 1 | 6 | 2 | 0 | 2, 3, 6 |
| PR Privacy and consent | 7 | 0 | 5 | 2 | 0 | 3 |
| SO Secure development and operations | 10 | 2 | 6 | 2 | 0 | 2, 6, 10 |
| PF Performance | 7 | 4 | 2 | 1 | 0 | 2 |
| A11Y Accessibility | 7 | 0 | 0 | 6 | 1 (A11Y-06) | not mapped (see gaps) |
| I18N Multi-language | 7 | 5 | 1 | 1 | 0 | 2 |
| TS Testing | 9 | 4 | 3 | 2 | 0 | 2 |
| LM Logging and monitoring | 9 | 1 | 6 | 2 | 0 | 2 |
| UX User experience | 8 | 5 | 0 | 3 | 0 | 2 |
| AC, PO, KY, AD-01 to 03, 11, 12 | 6 + 7 + 9 + 5 | 6 | 12 | 9 | 0 | 3 |
| SL, AV, SD, AD-04 | 9 + 4 + 5 + 1 | 9 | 8 | 0 | 2 (SL-01, SL-08) | 4 |
| BK, PY, NT, AD-05, AD-07 | 9 + 7 + 3 + 2 | 9 | 11 | 1 | 0 | 5 |
| HS, RF, AD-06 | 6 + 3 + 1 | 10 | 0 | 0 | 0 | 6 |
| LB, AD-13 | 11 + 1 | 9 | 3 | 0 | 0 | 7 |
| OC, IC | 7 + 10 | 0 | 0 | 0 | 17 (all) | none (ADR 0015) |
| MV, AD-15 | 16 + 1 | 10 | 6 | 1 | 0 | 8 |
| PK, RR, AD-08 to 10, 14, 16, 17 | 8 + 8 + 6 | 16 | 6 | 0 | 0 | 9 |

No MVP journey (J1, J3 to J5, J7 to J9; J2 and J6 are deferred beyond the MVP) is complete yet. Step 3 sign-in, account setup, provider onboarding and the verification queue are built (see below); J1 and J5 run end to end against the identity and storage test doubles (no partner sandbox yet, #21).

Counts after Step 2 (18 October 2026, reconciled with the Partial table on 22 October), strict: Done only where the requirement is met as
written today, not just its Step 2 part.
- **EN:** Done 03, 09, 13. Partial 01, 02, 04, 05, 06, 07, 10, 11, 12. Deferred beyond the MVP 08.
- **SE:** Done 02. Partial 03, 04, 05, 06, 07, 09.
- **SO:** Done 01, 05. Partial 03, 06, 07, 08, 09 (runbook drafted 30 October 2026; no named owner or rehearsal yet), 10.
- **PF:** Done 02, 03, 05, 06. Partial 01, 07 (shell only, no queued actions).
- **I18N:** Done 01, 02, 03, 04, 06. Partial 07 (native review). Not started 05.
- **TS:** Done 01, 02, 03, 07. Partial 05, 06, 09.
- **LM:** Done none. Partial 01, 02 (nested masking, found 25 October 2026), 03, 04, 05, 07, 09.
- **UX:** Done 01 to 05. Not started 06 to 08.

## Step 2: Secure foundation and quality gates

[Spec](archive/step-specs/step-02-secure-foundation.md). Evidence per acceptance criterion is in the
[Step 2 log](step-2-progress.md).

| Part | Status | Notes |
| --- | --- | --- |
| Engineering (code, tests, CI gates, ADR 0010, runbooks) | 🟡 Partial | PRs #34 to #45 merged with CI green; the Odia note flow runs end to end in CI behind Caddy: encrypted, owner only, audited, absent from logs. Corrective defects found since (review of 18 October, spec 001 analysis), confirmed in code on 22 October: note and audit not atomic and reads audited before decryption (fixed by spec 003), session rotation not atomic, replay winner survives, cookie cleared on 5xx (fixed by spec 004), re-encryption job unbounded, miscounted and unaudited (fixed by spec 005). Every corrective defect from the [assessment](https://github.com/themechanicalguy/heach/blob/338943c/docs/step-2-assessment-2026-10-22.md) is now fixed with tests (specs 001 to 005, PRs #56, #64, #67, #69 and #70); CI green on `main` and deployed to dev; re-verified locally on 24 October (fresh, uncached: `pnpm check` 37 of 37 tasks; API integration 107 of 107 on PostgreSQL and Redis, every SE-05.5 to SE-05.10, SE-07.14 to SE-07.20 and EN-05.4 to EN-05.9 test passing). Done: owner accepted 25 October 2026 (gate G4) |
| Infra apply and live dev checks | ✅ Done (deployed); 🟡 operational acceptance pending | 18 Oct: dev and bootstrap applied. Verified live then: EN-01.3 TLS, EN-04.2 KMS, EN-12.1 secret loading, EN-12.2 rotation (with recovery), EN-10.3 backup storage and off-account copy, EN-10.4 isolated restore and decryption, and LM-04.1 vitals. Latest Deploy dev green on 23 October for `491f5a0` (specs 003 to 005; [run 39915546133](https://github.com/themechanicalguy/heach/actions/runs/39915546133): deploy, rollback target recorded, smoke test of `/healthz` and `/api/readyz`). The smoke test does not exercise the corrective behaviour; that is proven by CI and local tests, not on the host. Deploy dev for `3c2d8af` (#71, dev dependencies only) was also green on 24 October ([run 40018826831](https://github.com/themechanicalguy/heach/actions/runs/40018826831)). SO-08.3 and LM-07.1 alerts were published to SNS; delivery never confirmed. The owner reported on 22 October (in a Claude Code session, not recorded in the repository) re-creating and confirming the email subscription and sending a synthetic test; its receipt is unconfirmed. **24 October:** subscription confirmed in AWS (1 confirmed, 0 pending). Spec 007 deployed (`8b0387f`) and verified live ([record](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24)). Labelled synthetic LM-07.1 and SO-08.3 alerts published 16:05 and 16:06 UTC, SNS delivered 1 and 1, failed 0; inbox receipt confirmed by the owner 25 October. Backup and restore re-proven on the host after the role split; off-account copy pulled again (24 October). No recurring restore check yet (spec 006 approved 25 October) |
| Owner decisions on dependencies | ✅ Done | Approved 18 October and built: `caddy-ratelimit` (SO-08.2, CI floods the deploy bundle), Prometheus and Grafana local only (LM-05.1 record), source maps to GlitchTip (LM-03.1 record). `@sentry/cli` not used: its maintained versions are FSL-1.1-MIT, not open source (D4); `scripts/upload-source-maps.mjs` uses GlitchTip's API instead |
| Native Odia review (I18N-07) | ⬜ Owner | [Review sheet](reviews/odia-review-step-2.md) ready (34 keys, questions; all 34 keys of `or.json` on it, checked 25 October); reviewer not yet engaged ([FU-07](follow-up-register.md#closes-step-2)) |
| Lawyer review (D6) | ⬜ Owner | Step 2 exit criterion. [Review pack](reviews/lawyer-review-step-2.md) ready: Aadhaar route, DPDP questions, draft consent wording; lawyer not yet engaged ([FU-06](follow-up-register.md#closes-step-2)) |
| Log masking depth (LM-02.1) | ✅ Done | Found by the [audit](step-1-2-audit.md) on 25 October 2026; fixed 28 October 2026 on branch `feat/nested-log-masking`: one recursive pass in `@heach/logger` redacts personal keys and masks mobile numbers at every depth, in errors, interpolation, child bindings and context, with placeholders past depth 8, for cycles, binary and unreadable values (LM-02.3 to LM-02.8 tests, design in [archived spec 008](archive/specs/008-nested-log-masking/spec.md)); the audit probe now writes 0 numbers in clear (2 before) ([FU-27](follow-up-register.md#closes-step-2)) |
| Step-end demo on a real mid-range Android phone (guideline rule) | ⬜ Owner | Not recorded for Step 1 or Step 2; the "on a phone" exit evidence is Chromium device emulation ([FU-08](follow-up-register.md#closes-step-2)) |

### Partial requirements

| ID | What exists | What is missing |
| --- | --- | --- |
| EN-01 | TLS on 443 through Caddy's internal CA, HSTS header, port 80 redirects to HTTPS. PostgreSQL and Redis accept TLS only (private CA, `deploy/dev/make-certs.sh`); plaintext refused locally, in CI and on the dev host bundle | Publicly trusted certificate (internal CA on the dev host; EN-01.3 recorded: TLS 1.2 and 1.3 only) |
| EN-02 | Encrypted EBS disk and snapshots, state bucket, uploads bucket (SSE-KMS), ECR images | Encrypted log store; queues and search do not exist yet |
| EN-04 | Customer managed KMS keys in Mumbai; only `GenerateDataKey` and `Decrypt` (EN-04.2 verified live 18 October). Since spec 007 (applied 24 October) the data-domain keys belong to the API role and the host role keeps only the backup key; simulated live 24 October (Decrypt allowed, Encrypt denied). `@heach/crypto` envelope encryption, API KMS adapter, `app.data_key` table | Staging and production keys (no such environments yet) |
| EN-05 | Data keys versioned per domain; old versions decrypt (EN-05.1); KMS keys rotate yearly (EN-05.2); re-encryption job and runbook (EN-05.3). [Spec 005](archive/specs/005-bounded-reencryption/spec.md): one keyset pass, only versions below the target, true counts, exit 1 on failure, per-row audit as `system` / `job:reencrypt` (EN-05.4 to EN-05.9: `reencrypt.spec.ts`, `test/reencrypt.int-spec.ts`; [evidence](archive/specs/005-bounded-reencryption/tasks.md#evidence)) | No rotation schedule for data keys yet; the bounded job is deployed and ran once on the dev host on 24 October without `--rotate` (exit 0, nothing to move); a rotation on dev has not been run (owner's call) |
| EN-06 | One KMS key per data domain (health, identity, payments, documents) in dev, rotated yearly (`enable_key_rotation`, 365 days); the API wraps each domain's data keys with that domain's key (`KmsKeyProvider`, alias prefix; EN-06.1 unit test, EN-04.2 verified live) | Only the dev environment exists, so there are no separate staging or production keys yet |
| EN-07 | Private, versioned uploads bucket, SSE-KMS (documents key), public access blocked, TLS only | Per-object keys, virus scanning, signed URLs: Step 3 (encrypted, virus-scanned onboarding uploads, PO-04) and Step 8 (vault); out of Step 2 by design |
| EN-10 | Nightly EBS snapshots kept 7 days, encrypted. Migrations run forward from empty in CI; separate migrator, API and audit-owner roles. Backup KMS key, private backups bucket and nightly dump timer live on dev; off-account encrypted copy on the owner's Mac; local and dev-host restore records (EN-10.3, EN-10.4) | Recurring restore check deployed 25 October (spec 006, `a2cbf6f`): first host run passed, failure alert proven end to end; four consecutive weekly host records are still required (SC-001, 1 to 22 November). Off-account copy pulled by hand (18 and 24 October) with a weekly reminder ([ADR 0012](adr/0012-off-account-recovery-of-restricted-fields.md) R2, 25 October). Restricted fields in the off-account copy are wrapped by the dev KMS keys, so they cannot be decrypted if the AWS account is lost: accepted for dev (R1), escrow wrap before the pilot (backlog 6a). Passphrase recovered from the password-manager copy (R3, owner, 25 October 2026). Second-Region or managed backups revisited at the pilot (D1); SO-10 drill in Step 10 |
| EN-12 | gitleaks in hooks and CI; generated passwords in SSM Parameter Store; CI deploys over OIDC without keys; the API reads its secrets by name from Parameter Store at start-up (only the ones it needs); rotation runbook. [Spec 007](archive/specs/007-security-review-fixes/spec.md) (EN-12.4): the API has its own IAM role granting exactly its four parameter ARNs; the host role (bootstrap, migrations, backups) is out of a container's reach (metadata hop limit 1); bootstrap and migration passwords go only to their one-off containers (`load-secrets.spec.ts`, `scripts/check-infra-security.test.mjs`, `scripts/deploy-script.test.mjs`) | Rotation run once in dev (EN-12.2, recorded); Secrets Manager revisited at the pilot (D2). EN-12.4 applied and deployed 24 October and verified live (IAM simulation, in-container checks; [record](reviews/2026-10-24-security-review.md#live-verification-after-the-apply-2026-10-24)); Done: owner accepted 25 October 2026 |
| EN-11 | The service worker caches the shell only, never an API response (PF-07.1 E2E); sample notes are not stored on the device | Offline booking summaries and their wipe at sign-out (Step 5); the vault (Step 8) |
| SE-09 | Responses with Restricted data carry `Cache-Control: no-store` (SE-09.1) | SMS, push and WhatsApp text rules: no messages are sent yet (Step 5) |
| SO-10 | Nightly encrypted dumps (RPO 24 hours on dev); restores proven by hand (18 and 24 October) and the weekly restore check deployed (spec 006, 25 October; four weekly runs pending) | RTO 4 hours not drilled; the SO-10 recovery drill is Step 10; off-account recovery of Restricted fields is a pilot-gate item (ADR 0012 R1) |
| PF-01 | Lighthouse mobile performance at least 90 in CI (PF-03.1); real-user vitals logged per route and device (LM-04.1) | No 75th-percentile field measurement on a mid-range Android phone over throttled 4G |
| PF-07 | Installable PWA; shell offline with a banner (PF-07.1) | Last-viewed bookings offline and queued actions retried on reconnect (Step 5) |
| I18N-07 | CI fails when a key is missing in any locale (I18N-07.1); review sheet with all 34 Step 2 keys ready ([Odia review](reviews/odia-review-step-2.md)) | Review by a native Odia speaker with medical vocabulary: the owner is arranging it (25 October 2026) |
| TS-06 | Ports and test doubles for SMS, payments, video and identity; lint keeps adapters behind them (TS-06.1) | Real adapters and nightly sandbox runs arrive with each integration (Steps 3 and 5) |
| TS-09 | Authorisation matrix per role (SE-02.2) and encryption assertions (EN-13.1) in CI | Vault sharing tests (Step 8) and plan entitlement invariants (Step 9) |
| LM-01 | One correlation ID from the browser through the API to the database and log lines (LM-01.1); jobs log under a run ID | Queue workers do not exist yet (Step 5) |
| LM-03 | Source-mapped front-end errors with release tag and role, no identity, proven against local GlitchTip (LM-03.1) | No error tracker on the dev host (ADR 0010: local only until the pilot) |
| LM-04 | Core Web Vitals logged per route template and device class (LM-04.1) | Network type is not recorded (not part of LM-04.1) |
| LM-05 | Request rate, 5xx share and p50/p95/p99 on a local Grafana dashboard; OpenTelemetry traces to local Jaeger (LM-05.1) | Nothing central on the dev host (ADR 0010) |
| LM-07 | API error-rate and repeated authorisation-failure alerts to the `heach-credit-reminders` topic; both synthetic alerts received in the owner's inbox (25 October 2026) | Payment, OTP, video and queue-backlog alerts arrive with those features; on-call routing is one email address |
| LM-09 | Hash-chained audit log in its own schema for every access to Restricted data, separate from application logs (SE-05) | Admin sign-in, suspend, reinstate and user views are audited (#94); admin account changes, staff memberships, linked patients, profile corrections, exports, deletion requests and number changes are audited without personal values (branch `feat/account-flows-all-roles`); audit retention period (PR-05) |
| SE-07 | Step 2: 15-minute access tokens, rotating single-use refresh cookie, replay revokes all sessions, logout from all devices (SE-07.1 to SE-07.4). [Spec 001](archive/specs/001-session-refresh-reliability/spec.md): the web client shares one refresh per tab, serialises refreshes across tabs (Web Locks), signs other tabs out (BroadcastChannel), keeps the session on network errors and makes logout final (SE-07.5 to SE-07.13; unit tests `apps/web/src/lib/api.test.ts`, `session.test.tsx`; integration `apps/api/test/auth.int-spec.ts`; E2E `apps/web/e2e/session-refresh.spec.ts` in the deploy-bundle job). Verified locally on 21 October: unit 26/26, integration 71/71, E2E 12/12 on three viewports, SC-001 50/50 ([evidence](archive/specs/001-session-refresh-reliability/tasks.md#evidence-2026-10-21-local-github-actions-did-not-start-account-billing)); CI green on #56 (all 9 checks, including the session E2E in the deploy-bundle job). [Spec 004](archive/specs/004-transactional-session-rotation/spec.md): rotation in one transaction under the user's row lock; a concurrent replay revokes the winner too; sign-out of all devices takes the same lock; the cookie is cleared only on 401 (SE-07.14 to SE-07.20; `session.service.spec.ts`, `auth.controller.spec.ts`, `test/session-rotation.int-spec.ts`; [evidence](archive/specs/004-transactional-session-rotation/tasks.md#evidence)) | OTP re-verification (#94) protects adding a role and, on branch `feat/account-flows-all-roles`, data export, the deletion request, number change and staff invitations; a removed membership signs out every device acting in that role at once, and a number change signs out every other device (D-7, O-3); payout routes do not exist yet. A refresh response lost after the server committed still signs every device out (strict replay detection; grace window not adopted). Cross-tab coordination tested in Chromium only; browsers without Web Locks (iOS before 15.4) can still race two tabs. [Spec 007](archive/specs/007-security-review-fixes/spec.md) (deployed 24 October, owner accepted 25 October): device sign-out revokes the whole session family, a signed-out family's token is a plain 401, and test sign-in on the dev host needs the loopback entry's key (SE-07.21 to SE-07.23; `session-rotation.int-spec.ts`, `test-login.int-spec.ts`, `test-login.gate.spec.ts`) |
| SE-04 | Admin has no public port; reached only through Session Manager port forwarding (IAM sign-in with MFA) | Admin sign-in with mandatory TOTP and short sessions (#94); super-admin management and recovery with temporary passwords that expire after 24 hours (branch `feat/account-flows-all-roles`, AD-01 row); IP allow-listing is the tunnel only; no export exists yet |
| SE-05 | Hash-chained audit log in its own schema; the API role may only call `audit.append`; verifier reports the first broken link; every sample-note read, write and denial and every role denial is audited, without Restricted values (SE-05.1 to SE-05.4, Step 2 tests). [Spec 003](archive/specs/003-transactional-audit-writes/spec.md): shared `withTransaction` helper (`apps/api/src/data-stores/transaction.ts`); a note and its entry commit together; reads are audited only after decryption, and failures as `.read.failed` / `.list.failed` (SE-05.5 to SE-05.10: `transaction.spec.ts`, `notes.repository.spec.ts`, `test/audit-transaction.int-spec.ts`; [evidence](archive/specs/003-transactional-audit-writes/tasks.md#evidence)) | No retention schedule for the audit log yet (PR-05, not started). No admin actions exist to audit |
| PR-06 | `naming` module rejects regions outside India; everything in `ap-south-1` | Data processing agreements with third parties |
| PR-07 | Logger redacts personal keys | No analytics or monitoring tools yet |
| SO-03 | Secret scan, `pnpm audit` (high blocks), ECR scan on push; Semgrep CE and Trivy in CI on every PR, each scanner proven by a fixture. The patched Caddy build pins its Go toolchain (`GOTOOLCHAIN` in `apps/admin/Dockerfile`), bumped when Trivy reports a fixed Go CVE. 28 October 2026: Trivy reported CVE-2026-116587 (high, JWK parsing DoS) in Caddy's `go-jose/v4` v4.1.5; the build now replaces it with v4.1.6. 24 October 2026: the full audit (dev dependencies included) reported GHSA-f2ph-cmg5-wxc8 (critical) and GHSA-px85-f4q5-jh77 (high) in Storybook 10.6.1 and GHSA-587h-7wmj-h5pm (high) in Vite 8.3.2; bumped to Storybook 10.6.2 and Vite 8.3.4. The CI gate audits production dependencies only (`--prod`), which stayed clean | Dynamic scan and penetration test (SO-04, before pilot). [Spec 007](archive/specs/007-security-review-fixes/spec.md) (SO-03.2): CI now audits all dependencies (high blocks); pnpm overrides pin patched multer (production, GHSA-q7qp-rjg7-q26m), Lighthouse 13 under `@lhci/cli` (drops the unfixed `extract-zip`), tmp, uuid and basic-ftp; body-parser, undici and zod refreshed; `pnpm audit` and `pnpm audit --prod` report no known vulnerabilities on 24 October. The Trivy image scan still uses `--ignore-unfixed` (unchanged) |
| SO-06 | Access only through SSM Session Manager, no SSH | Bastion or zero-trust proxy for production, quarterly review |
| SO-07 | Synthetic-data rule in docs and CLAUDE.md | Enforcement once real data exists |
| SO-08 | API rate limit per route: every request is counted by client address whatever its credentials, and a live session by its user as well ([spec 007](archive/specs/007-security-review-fixes/spec.md) SO-08.12, Approved; amends spec 002, which counted a live session by user only), so neither fake nor valid tokens create allowances; `Retry-After` and the generic error body on 429; `RATE_LIMIT_WINDOW_SECONDS` (SO-08.1, SO-08.4 to SO-08.11, [spec 002](archive/specs/002-rate-limit-bypass/spec.md): unit `user-throttler.guard.spec.ts`, integration `rate-limit.int-spec.ts` on real PostgreSQL and Redis, deploy-bundle check `scripts/rate-limit-check.sh` through Caddy in CI). Caddy edge limit 300 a minute per IP (SO-08.2), authorisation-failure alert (SO-08.3), input validation | Counters are in memory, per API process and per route; a second API process needs shared counters first (review P-1, [backlog](backlog.md) item 8). Checked 22 October: one API container, one Node process, so not needed yet. OTP caps per number, device and address exist on the branch (29 October 2026, AC-01 row). WAF at the pilot (D3) |
| TS-05 | E2E smoke for web and admin on every PR (Chromium), on mobile, tablet and desktop projects (TS-05.1) | Nightly and pre-release full suite: no full journey suite exists yet (TS-04, later steps) |

## Step 3: role-based login and account setup (in progress)

Merged in #94 (29 October 2026) and extended on branch `feat/account-flows-all-roles` ([work record](account-flows-all-roles.md)), behind the `accounts` flag (local, test and
dev only). Design reference: `apps/web/design-mockups.html`. Record, decisions L-1 to L-14, data
classes and retention: [login and account setup](login-and-account-setup.md).

| ID | Status | What exists | What is missing |
| --- | --- | --- | --- |
| AC-01 | 🟡 Partial | OTP sign-up and sign-in for patients and providers: 6 digits, 5 minutes, 5 attempts, resend after 30 s (3 at most), keyed hash only, caps per number, device and address, same answer for known and unknown numbers (`otp-sign-in.int-spec.ts`, 17 tests; web E2E on three viewports in or, en, hi) | A real SMS provider (DLT, #20): SMS reach only Mailpit (local) or the test double. Bot challenge not built (throttles only, charter D3-6) |
| AC-02 | ✅ Done | Language chosen on first launch (`/welcome`, remembered), switchable on every screen, kept on the account for SMS and the next sign-in (`account-setup.int-spec.ts`, E2E `AC-02`) | Native Odia review of the new keys (I18N-07, FU-07) |
| AC-03 | 🟡 Partial | Patients and representatives add, edit and remove linked patients (name, year of birth, gender, relationship from a list), at most 10, owner-only on every query; profiles with no sign-in of their own (default D-1); audited by ID only (`linked-patients.int-spec.ts`, 6 tests; web E2E in or, en, hi on three viewports) | "Book for them" arrives with booking (Step 5); transfer to the person's own account is MV-13 (Step 8) |
| AC-04 | ✅ Done | Every MVP role of the requirements: patient, representative, physiotherapist, nurse, attendant, lab (self-registered); sample collector only through a lab's invitation (owner decision O-1); four admin sub-roles in their own realm. One care and one provider role per account; registration is only a request, the server grants; role switching re-checked on the server; deny by default per route; a removed membership ends that role's sessions at once. Roles deferred beyond the MVP ([ADR 0015](adr/0015-defer-online-consultation-and-clinic-appointments.md)): doctor, dentist, dermatologist and clinic front desk stay in code behind the `doctor-and-clinic` flag (local, test and dev only; off by default; never staging or production). While it is off the server (`RoleAvailability`) refuses them at setup save and completion (also through a clinic invitation), adding a role and switching (`role_unavailable`); hides and refuses clinic invitations; starts a sign-in in an offered grant or, with none, as `new_account`, which may add a care role; ends a session in a deferred role at refresh and revokes its access token at first use. Grants, drafts and invitations are kept; `/v1/me` returns `offeredRoles` and `available` per grant, the admin user view marks deferred grants, and the web screens offer only `offeredRoles` with translated notices (or, en, hi) (`role-journeys.int-spec.ts`: all 15 roles with the flag on; `deferred-roles.int-spec.ts`, 13 tests with the flag off and on over one database; `staff-membership.int-spec.ts`, 13 tests; `role-availability.spec.ts`) | Later work routes must declare their roles (the route-table test SE-02.1 fails otherwise) and gate lab and provider work on Approved; none exist yet. An account left with only deferred roles reaches its data rights (PR-04) only after adding a care role (FU-35) |
| AC-05 | 🟡 Partial | Sessions persist (refresh cookie); a fresh OTP (5 minutes) protects adding a role, accepting a staff invitation, inviting staff, data export, the deletion request and number change; admins re-verify by TOTP before suspend, reinstate and every admin account change | Payout details (PO-06) are protected too |
| AC-06 | ✅ Done | Account page shows and corrects name, gender, spoken languages (providers) and the lab's name (labs), only the fields the role uses; deletion request after a fresh OTP, one open at a time, withdrawable, shown to support in the user detail (`account-data.int-spec.ts`; web E2E) | Carrying out deletions is PR-04 |
| PR-01 | 🟡 Partial | Versioned terms and privacy consent at sign-up in the user's language (`consent_record`: purpose, version, locale, given, withdrawn); a newer version is asked again before anything else (#94, decision L-12) | Texts are drafts until the lawyer's review (FU-06); consent before identity verification, teleconsultation and report sharing arrives with those steps; no withdrawal screen yet |
| PR-04 | 🟡 Partial | View and correct (AC-06), export as a JSON download after a fresh OTP (profile, roles, consent history, staff membership, linked patients), deletion request recorded (default D-3) | Carrying out a deletion and the time within which it is completed need the lawyer: what must be kept (consent evidence, audit, provider-issued records) is not decided (PR-05, FU-06) |
| PR-05 | 🟡 Partial | `pnpm --filter @heach/api job:purge-expired` deletes OTP challenges 24 hours after expiry, sessions 30 days after revocation or expiry, closed memberships after 30 days (`purge-expired.int-spec.ts`); windows are proposals (default D-5) | Not scheduled on any host (needs a deploy the owner approves); a retention schedule per data class needs the lawyer |
| PO-01 | 🟡 Partial | One onboarding framework (`apps/api/src/onboarding`): role checklists in `checklists.ts` for physiotherapist, nurse, attendant, lab and sample collector, with required and optional items, registration numbers and expiry dates; police verification for every home-visit role (Q-POLICE); `/provider` shows the checklist hub in or, en, hi (`onboarding.int-spec.ts`, `application-rules.spec.ts`, `onboarding.test.tsx`) | Checklists are configuration in code, not yet editable by admin (AD-08, Step 9) |
| PO-02 | 🟡 Partial | Upload from camera or files (`capture` input), PDF, JPEG, PNG up to 5 MB, type checked against the file's bytes, scanned on receipt, encrypted in the documents domain before storage; infected files quarantined (row kept, content never stored) | Client-side compression not built; storage and scanning are test doubles (`InMemoryObjectStore`, `FakeVirusScanner`) until S3 and decision D-SCAN |
| PO-03 | 🟡 Partial | Every step saves on its own and the hub resumes from the server; the hub lists what is still needed before submit | No step-count progress bar |
| PO-04 | 🟡 Partial | All transitions but suspension: Draft or Changes requested to Submitted (only when nothing is missing), Submitted to Under review when a verifier opens it, then Approved, Rejected or Changes requested; each change recorded in `application_event` with actor and reason | Suspending an approved provider uses the account suspension (AD-03); the application's own Suspended status is not set yet |
| PO-06 | ✅ Done | Bank account (with IFSC) or UPI ID; saving needs a fresh OTP (`reverification_required` otherwise); the destination is encrypted in the payments domain, only its last four characters are shown back | |
| KY-01 | 🟡 Partial | Identity check through the `IdentityVerifier` port: start returns the partner's consent page, the partner returns to `/provider/onboarding/identity` with a one-time code, the result is recorded against the pending reference only | Only the test double exists (partner #21, lawyer FU-06); identity consent text (PR-01) not shown before the redirect yet |
| KY-05 | 🟡 Partial | No Aadhaar number is ever received or stored (`identity_check` has status, method, reference and time only; test checks the columns) | The result is Confidential, not encrypted as Restricted; last four digits not kept |
| KY-06 | ✅ Done | Identity verification is required before a provider can submit; patients are not asked | |
| KY-08 | 🟡 Partial | The partner sits behind `identity.port.ts`; a failed result can be retried | No manual fallback (KY-07) and no timeout handling yet |
| AD-02 | 🟡 Partial | Admin "Provider verification" section for verifier and super admin: waiting or decided applications oldest first, review panel with identity result, payout hint, documents (open the file, accept or reject each), missing items, history, and approve, request changes or reject with a reason; every view, file opened and decision audited; the provider gets an SMS without the reason (`onboarding.int-spec.ts`, `verification.test.tsx`) | No name and photo match flags (KY-04), no filters by district or age, no zoom or rotate in the viewer |
| AD-01 | 🟡 Partial | Email and password (scrypt), mandatory TOTP with enrolment, lockout, single-use steps, 10-minute access, 30-minute idle and 8-hour absolute sessions, sub-roles, masked lists. Super admins create admins with a one-time temporary password (expires in 24 hours, replaced at the first sign-in together with the TOTP code), change sub-roles, disable and enable, reset a password or the authenticator; no admin changes their own account there; the last active super admin cannot be demoted or disabled, even by two concurrent changes; every change signs the target out at once; admins change their own password with the current one and a fresh TOTP (owner decision O-2; `admin-management.int-spec.ts`, 9 tests; admin E2E on desktop and tablet) | Break-glass (SE-03, Step 6). Admin recovery when no super admin can sign in stays the operator CLI (`admin:create`) |
| AD-03 | ✅ Done | Search by number or name, status filter, server pages, audited detail view, suspend (reason code) and reinstate by super admin or support after a fresh TOTP; suspension signs every device out and refuses sign-in | |

Verification on 29 October 2026 (local, branch `feat/account-flows-all-roles`): `pnpm check` 37
of 37 tasks; API unit 133 and integration 269 of 269; web unit 64; API-backed web E2E 45 of 45
(`sign-in-setup.spec.ts` 27, `account-flows.spec.ts` 18; mobile, tablet and desktop; or, en, hi);
admin E2E 12 of 12 (desktop and tablet); changed-line coverage 97.5 %; generated types and data
classes checked. These run against test doubles and the local Mailpit inbox: no real SMS has been
sent (#20). Web screens are covered by E2E only (the coverage gate does not count untested
components). The role-by-role matrix is in the [work record](account-flows-all-roles.md#role-by-role-matrix).

Verification of the scope deferral on 29 October 2026 (local, branch `fix/defer-doctor-clinic-beyond-mvp`, [ADR 0015](adr/0015-defer-online-consultation-and-clinic-appointments.md)): `pnpm check` 37 of 37 tasks; API integration 282 of 282 (29 files, including `deferred-roles.int-spec.ts` 13); `format:check`, `db:check-classes`, generated types and the Storybook build pass; changed-line coverage 97.6 %; API-backed web E2E 45 of 45 and admin E2E 12 of 12 against the MVP configuration (flag off); non-API web E2E 36 passed, 0 failed (Linux visual baselines not run on macOS). A live local journey against two built APIs on one database (flag off and on) passed 16 of 16 checks: MVP roles complete setup; deferred roles are refused; a doctor grant made with the flag on loses its live token and refresh, is kept but unavailable, and cannot be switched to; a dermatologist-only account signs in with no role and recovers by adding a care role. A temporary browser check (not committed: it needs a second, flag-on API) confirmed the recovery screens in or, en and hi on three viewports. Synthetic numbers only; no SMS left the machine.

## Step 4: listings, availability and search (in progress)

Branch `feat/step-4-listings-search`, behind the `accounts` flag. API modules `catalogue`, `listings`, `availability`, `search`; migration `0006_catalogue_listings_availability.sql` (catalogue, listings and areas are Public data; hours and leave Internal). Tests: `listings-search.int-spec.ts` (10), `slots.spec.ts` (6), web `care.test.tsx`, `provider-services.test.tsx`, `hours.test.ts`, admin `catalogue.test.tsx`.

| ID | Status | What exists | What is missing |
| --- | --- | --- | --- |
| SL-02 | ✅ Done | Physiotherapists list assessment, orthopaedic, neuro, post-operative and geriatric sessions from the catalogue with session length and fee | |
| SL-03 | ✅ Done | Nurses list injection, wound dressing, catheter care, vitals check and IV fluids, each with a fee | |
| SL-04 | 🟡 Partial | Attendants list 12-hour day, 12-hour night and 24-hour shifts with a daily rate and care settings (home, hospital); gender comes from their profile; attendant items are never clinical (database check) | The tasks an attendant performs are not listed yet |
| SL-05 | ✅ Done | Service area by serviceable PIN codes (each with its district) and a travel charge; unknown or unserved PIN codes refused | |
| SL-06 | ✅ Done | Every catalogue item flags whether a prescription is mandatory (injections, catheter care, IV fluids); shown on the profile | Enforced at checkout in Step 5 |
| SL-07 | ✅ Done | A provider pauses and resumes any listing; paused listings leave search at once | |
| SL-09 | 🟡 Partial | Labs list tests with price, sample type, report time, preparation (three languages) and home collection | Test packages not in the catalogue yet |
| AV-01 | ✅ Done | Weekly hours per weekday, leave as date ranges (up to 90 days), all in IST | |
| AV-02 | 🟡 Partial | Slots from hours and duration on a 30-minute grid (shifts at their fixed start), with a 2-hour lead time; a slot hold is an atomic Redis key for 10 minutes and hides the slot from others (concurrency test) | The hold is taken at checkout in Step 5 |
| AV-03 | ✅ Done | The provider sets the gap between visits (0 to 120 minutes); slots that would touch another booking or leave with the gap are not offered | |
| AV-04 | ✅ Done | Days, hours and displayed times are IST only | |
| SD-01 | 🟡 Partial | Home screen shows the four services as large tiles (with `accounts` on) | "My records" and plans arrive in Steps 8 and 9 |
| SD-02 | 🟡 Partial | Search by service, catalogue item, provider or service name in any of the three languages (case-insensitive); the web search page has a name box (`q` in the URL) | No spelling tolerance or transliteration yet (decision D-SEARCH) |
| SD-03 | 🟡 Partial | Location (PIN code), language spoken, gender, maximum fee and earliest availability (results sorted by earliest slot) | Rating filter waits for ratings (Step 6); fee filter in the API only |
| SD-04 | ✅ Done | Home-visit and home-collection results only from providers serving the patient's PIN code | |
| SD-05 | 🟡 Partial | Public profile and listing data without patient data; catalogue cached publicly | Pages render on the client; server rendering with structured data not done |
| AD-04 | 🟡 Partial | Admin catalogue page: every item with its service and prescription flag; super admin pauses or resumes an item and renames it in three languages (API), each change audited | Adding new items needs a migration |
| AD-08 | 🟡 Partial | Serviceable PIN codes: super admin stops or starts serving a PIN code; a pilot list of Khordha and Cuttack codes is seeded (decision D-PIN pending) | Policy settings are in Step 9 (see the AD-08 row there) |

## Step 5: booking, payments and notifications (in progress)

Branch `feat/step-5-booking-payments`, behind the `accounts` flag. API modules `bookings`, `payments`, `payouts`, `settings`, `jobs/runner`; migration `0007_bookings_payments.sql` (address and notes Restricted, encrypted in the identity and health domains). Decisions applied: D-QUEUE (PostgreSQL job table, `FOR UPDATE SKIP LOCKED`, no new dependency; `job:worker` for hosts, `JOBS_IN_PROCESS` locally), Q-CASH (online only), Q-COMMISSION and Q-ADVANCE placeholders in `app.setting` (15 % commission, 24-hour free cancellation then 50 %, 30 % attendant advance), amendments A10 and A14. Tests: `bookings.int-spec.ts` (7), `dispatch-payouts.int-spec.ts` (6), `booking-transitions.spec.ts` (every allowed and refused change), `fees.spec.ts`, `ledger.spec.ts`; web `booking.test.tsx`, `work.test.tsx`; admin `bookings.test.tsx`.

| ID | Status | What exists | What is missing |
| --- | --- | --- | --- |
| BK-01 | ✅ Done | Booker, care recipient (self or a linked patient), provider, service, slot or shift range, encrypted address, fee breakdown and status, frozen at checkout | |
| BK-02 | ✅ Done | Exactly the eight statuses, with who cancelled and who was absent in their own columns; one pure state machine (`booking-transitions.ts`) checks every change, refused ones answer `booking_transition_refused`; each change writes a booking event and an audit entry | |
| BK-03 | ✅ Done | Paid requests wait for acceptance within the configured window (30 minutes); a timer cancels and refunds in full; the chosen provider or, for "any available", waves of eligible providers get the request (A10); two accepts at once: exactly one wins (test) | |
| BK-04 | 🟡 Partial | Patient, provider and admin cancel; the policy is shown before payment and the refund before cancelling; refunds follow it automatically | Rescheduling not built |
| BK-05 | 🟡 Partial | A prescription from the device is attached at checkout (scanned, encrypted) and shown to the provider before accepting (A14) | Reports and photos beyond the prescription; attaching from the vault (Step 8) |
| BK-06 | ✅ Done | Reminder jobs 24 hours and 15 minutes before the start, to patient and provider, while confirmed | |
| BK-07 | ✅ Done | Booking history for patient and provider; the list's service, time and provider name are kept on the device for offline reading and wiped at sign-out in every tab; no Restricted data on the device | |
| BK-08 | 🟡 Partial | Gateway payment with the fee breakdown (fee, travel, discount, total, advance) | Entitlements and coupons (Step 9) |
| BK-09 | 🟡 Partial | "Book again" on a completed booking opens the same provider's listing | The patient still picks a time; no one-tap repeat of the same slot pattern |
| PY-01 | 🟡 Partial | Gateway port with orders, signed webhooks (raw-body HMAC), duplicates ignored, late or slot-conflicting payments refunded in full; the fee breakdown is shown before paying | Only the sandbox double exists: payment is simulated (`/payments/sandbox/:order/pay`, local, test and dev only) until the gateway account (#19) |
| PY-02 | 🟡 Partial | Refunds by policy, on decline, lapse, prescription rejection and price difference; finance and super admin issue manual refunds; a refund never exceeds what was paid (test); pending refunds retry | Against the gateway double only |
| PY-03 | ⬜ Not started | | Receipts and invoices (decision D-PDF) |
| PY-04 | ✅ Done | Ledger of earnings, reversals and payouts per provider with commission deducted; balance, held and paid-out amounts on `/provider/earnings` | |
| PY-05 | 🟡 Partial | Weekly payout run (Monday 06:00 IST) settles available earnings once, after a 48-hour hold; a refund after payout is reversed from the next run | Transfers go to the gateway double; linked accounts at the gateway not created |
| PY-06 | 🟡 Partial | Recurring debits through a gateway mandate for subscriptions (see PK-05) | Against the gateway double only; the real mandate authorisation waits for the gateway account (#19) |
| PY-07 | 🟡 Partial | No card or UPI data reaches the API by design: the gateway's hosted checkout is the only payment page | The hosted checkout itself waits for the gateway account (#19) |
| NT-01 | 🟡 Partial | SMS for OTP, verification outcome, booking request, confirmation, reminders and cancellation | Only Mailpit locally and the test double; no DLT provider (#20) |
| NT-02 | 🟡 Partial | In-app notification centre (`/notifications`) with mark-as-read | Web push not built (decision D-PUSH) |
| NT-03 | ✅ Done | Every template in or, en, hi, sent in the recipient's language with times in IST; no health detail in any template | Native review of the new texts |
| AD-05 | ✅ Done | Admin bookings console: filter by status, masked names, no address or notes, timeline, payments and refunds; support cancels with a full refund and reassigns to another eligible, free provider; every action audited | |
| AD-07 | ✅ Done | Finance: paid, refunded and commission totals, commission rate, payout runs with run-now, CSV export without Restricted data; the commission rate is changed in Settings (AD-08, Step 9) | |

The job worker is not yet deployed on the dev host (the dev deploy runs with `accounts` off, so no booking exists there); deploying it needs a compose change the owner approves.

## Step 6: home services (in progress)

Branch `feat/step-6-home-visits`. API modules `visits`, `tickets`, `reviews` and `bookings/strikes.service.ts`; migration `0008_visits_shifts_reviews_tickets.sql` (visit notes, ticket descriptions and notes Restricted). Codes are derived from the booking, the moment and a key derived from the blind-index root key, so none is stored; five wrong codes lock the booking's code. Tests: `visits.int-spec.ts` (7), `visit-rules.spec.ts`; web `visit.test.tsx`; admin `tickets.test.tsx`. Runbook: [clinical emergency during a visit](runbooks/clinical-emergency-during-visit.md) (A17, draft).

| ID | Status | What exists | What is missing |
| --- | --- | --- | --- |
| HS-01 | ✅ Done | Accept or decline from `/provider/requests`; the patient is told by SMS and in-app either way | |
| HS-02 | ✅ Done | Once confirmed: address (with landmark as written), the booker's number as a call link and a map link; never before | |
| HS-03 | ✅ Done | The patient's six-digit code, shown in the app from 30 minutes before to 3 hours after the slot, entered by the provider to start; wrong codes counted and locked after five | |
| HS-04 | ✅ Done | Visit notes (procedure, observations, advice) encrypted in the health domain; completing writes the earning; the patient reads them on the booking | Filing into the vault is Step 8 (MV-02) |
| HS-05 | ✅ Done | One shift per day of an attendant booking; check-in and check-out each with the patient's code; check-in needs the balance paid; each shift earns its share (PK-07); the last check-out completes the booking; reassignment moves the remaining shifts | Extending or ending early is still done by support through cancel and rebook |
| HS-06 | ✅ Done | "Report a safety concern" for patient and provider on the booking: a P0 ticket, an operations alert, and the emergency steps first (A17) | |
| RF-01 | ✅ Done | One rating (1 to 5, optional public comment) by the booker after completion; average and count in search, profiles and the rating filter | |
| RF-02 | ✅ Done | The provider reports a review; support hides it with a recorded reason; hidden reviews leave the profile and the average | |
| RF-03 | ✅ Done | Complaint and help tickets attached to a booking, listed with their status on the alerts page | |
| AD-06 | ✅ Done | Admin queue P0 first: assign, internal notes (encrypted), resolution; strike reviews raised automatically at three strikes (A12) | |
| SE-03 | 🟡 Partial | Break-glass for tickets: reason, 30-minute grant, audit entry; the private text is refused without it | Other Restricted data (visit notes, vault) has no admin path yet, by design |
| SE-06 | 🟡 Partial | The patient sees every break-glass grant on their data (who by role, when, why) | Reads by providers of shared records arrive with the vault (MV-10, Step 8) |

## Step 7: lab tests (in progress)

Branch `feat/step-7-labs`. API: `labs` module and `bookings/lab-orders.repository.ts`; checkout takes `extraListingIds` and `collection`; migration `0009_labs.sql`. Collection codes come from the same derived-key scheme as visit codes. Tests: `labs.int-spec.ts` (J7 end to end, walk-in re-collection); web `lab.test.tsx`; admin `labs.test.tsx`.

| ID | Status | What exists | What is missing |
| --- | --- | --- | --- |
| LB-01 | 🟡 Partial | Tests with names in or, en, hi, preparation, sample type and report time (Step 4 catalogue) | One name per language (no separate standard and common names); no test packages |
| LB-02 | ✅ Done | Home collection or walk-in; home collection only from labs serving the PIN code, with the collection charge; walk-in has no charge | |
| LB-03 | ✅ Done | Several tests from one lab in one booking for one patient; prices and the collection charge shown before payment | |
| LB-04 | ✅ Done | Tests that need a prescription refuse checkout without one; the lab sees it before accepting and can reject it, which refunds in full | |
| LB-05 | 🟡 Partial | The lab assigns one of its own active, approved collectors; the patient sees the collector's name and verified-identity badge | No collector photo yet |
| LB-06 | ✅ Done | The patient's six-digit code confirms collection, by the collector at home or by the lab for a walk-in; each sample gets a booking-linked identifier (`HX-` and 10 characters) | |
| LB-07 | ✅ Done | Stages booked, collector assigned, sample collected, received at lab, report ready, each recorded as an event with a notification (SMS and in-app, no health detail) | |
| LB-08 | ✅ Done | The lab uploads a PDF report against the sample's identifier (a mismatch is refused); stored scanned and encrypted, readable only by the booker and the lab; every read audited | |
| LB-09 | ✅ Done | Reports are filed in the patient's vault automatically (a correction replaces the filed version); the patient shares them with a provider for a booking (MV-07) or with a doctor outside the application by link (MV-09) | |
| LB-10 | ✅ Done | Re-collection with a reason (new sample identifier, counted); report corrections as new versions with a required reason | |
| LB-11 | ✅ Done | Lab orders page with today's collections, reports pending, average turnaround and late reports against the promised time | |
| AD-13 | 🟡 Partial | Admin "Labs" view: orders, turnaround, late reports and corrections per lab; labs and collectors are approved in the verification queue | Admins cannot manage a lab's staff memberships directly (the lab owner does, O-1) |

## Step 8: the e-medical record vault (in progress)

Branch `feat/step-8-vault`. API: `vault` module (`vault.service.ts`, `vault-filing.ts` used by visits and labs, `share-keys.ts`); migration `0010_vault.sql`. Record details and history are encrypted together in the health domain, files in the documents domain; external link tokens and codes are stored only as keyed hashes. Tests: `vault.int-spec.ts` (8), lab filing in `labs.int-spec.ts`; web `vault.test.tsx`; admin `vault.test.tsx`.

| ID | Status | What exists | What is missing |
| --- | --- | --- | --- |
| MV-01 | ✅ Done | One vault per account holding records and history for the holder and each linked patient | |
| MV-02 | ✅ Done | Visit notes and lab reports filed automatically when issued | |
| MV-03 | 🟡 Partial | Uploads by camera or file (PDF, JPEG, PNG) with type, scanned and encrypted | The limit is the shared 5 MB, not 10 MB |
| MV-04 | ✅ Done | Type, record date, facility, person, tags, notes; "added by you" or "issued by" the provider | |
| MV-05 | ✅ Done | History entries for allergies, conditions, medicines, surgeries, blood group, vaccinations and family history, each with who added it and when | |
| MV-06 | ✅ Done | Timeline newest first; filters by person, type and date range; search on titles, tags, facility and provider names | |
| MV-07 | ✅ Done | Share chosen records and optionally the history with the provider of one booking; view only, until 24 hours after the booking ends, revocable | |
| MV-08 | ✅ Done | The provider's "Shared records" panel shows only the live share for that booking; other providers and other records see nothing | |
| MV-09 | ✅ Done | Links for doctors outside HEACH: up to 72 hours, a six-digit code (five tries), revocable; not indexed | |
| MV-10 | ✅ Done | Every read by a provider or a link is logged and listed per record (who, when, through which share) | |
| MV-11 | 🟡 Partial | Content encrypted per field and per object, scanned on upload, never stored on the device; admins see counts only | Break-glass does not reach vault content (no admin path at all) |
| MV-12 | 🟡 Partial | Download any record, export the whole vault as JSON, delete own uploads; issued records cannot be deleted | Retention-based removal of issued records needs the lawyer (PR-05) |
| MV-13 | ⬜ Not started | | Transfer of a linked patient's vault to their own account |
| MV-14 | ✅ Done | A provider adds a record only within their own booking, attributed to them | |
| MV-15 | 🟡 Partial | Per-account quota from settings (`vault_quota_mb`), uploads past it refused, warning above 80 % | Quota not editable from the admin yet |
| MV-16 | 🟡 Partial | Progress and retry through the standard upload | No client-side compression or resumable upload |
| AD-15 | 🟡 Partial | Admin vault counts: records, storage, infected uploads, active shares and links, open deletion requests; never content | Carrying out exports and deletions for users is still the user's own action |

## Step 9: plans, referrals and the admin console (in progress)

Branch `feat/step-9-plans-referrals`. API: `plans` module (packages, subscriptions, purchases, the entitlement ledger, pro-rata cancellation), `referrals` module (codes, joining, qualification after the first completed booking, coupons, the review queue), `console` module (settings, dashboard, security console), `bookings/discounts.service.ts` (entitlements and coupons at checkout); migration `0011_plans_referrals.sql`. A booking fully covered by a plan needs no payment and goes straight to the provider. Plan purchases pay through the same gateway port and webhooks as bookings, so the daily reconciliation covers them; it also checks that every entitlement's units used equal the uses recorded against it. Step 9 checks: the invariants (entitlement use never above the purchase, a coupon used once, a refund never above the amount paid) are database constraints with tests; a discount-only booking on a used-up package gives back no unit when cancelled (found in review, fixed before merge). Mandate tests run against the gateway double (`renewals.int-spec.ts`); not done: mandate tests in the real gateway sandbox, the legal review of plan and referral terms, and a browser E2E for J8 (J8 runs end to end in `plans-referrals.int-spec.ts`; browser journeys J3 to J9 are the Step 10 regression). Tests: `plans-referrals.int-spec.ts` (7), `plans.spec.ts`; web `plans.test.tsx`; admin `console.test.tsx`.

| ID | Status | What exists | What is missing |
| --- | --- | --- | --- |
| PK-01 | ✅ Done | Admins create packages live; a provider's own package waits for admin approval before sale | |
| PK-02 | ✅ Done | Subscriptions with a service, period, included units, a discount once the units are used, and family members covered (PK-04); renewal through a mandate (PK-05) | |
| PK-03 | ✅ Done | Public plan page in the user's language with inclusions, exclusions, validity, family cover and price before buying; the refund on cancelling is shown before confirming | |
| PK-04 | ✅ Done | The ledger records every unit used per purchase and per covered person; checkout draws on it automatically and cancelling the booking gives the unit back; a plan covers the buyer and up to its family members, a further person is refused (`plan_person_limit`); "My plans" shows use per person (`plans-referrals.int-spec.ts`) | |
| PK-05 | 🟡 Partial | Turning auto-renew on sets up a mandate capped at the plan price; a pre-debit notice at least `renewal_notice_hours` before each debit; each renewal is a new purchase that starts where the last period ended; a failed debit retries every `renewal_retry_hours` and pauses after `renewal_max_attempts`, with SMS and in-app messages; the same attempt never charges twice (`renewals.int-spec.ts`, 3 tests) | Against the gateway double only: real UPI Autopay or card mandate authorisation and its webhook wait for the gateway account (#19); a price rise above the mandate cap pauses renewal |
| PK-06 | ✅ Done | Auto-renewal can be turned off at any time; the plan stays active to its end date | |
| PK-07 | 🟡 Partial | Cancelling refunds the paid price in proportion to unused units, never more than paid (`plans.spec.ts`); providers earn per completed booking through the ledger | A session booked but not yet held counts as used when the plan is cancelled; the published policy text needs the lawyer (PR-05) |
| PK-08 | ✅ Done | SMS and in-app reminder `plan_expiry_reminder_days` before expiry, and when a booking leaves one unit of several (`renewals.int-spec.ts`) | |
| RR-01 | ✅ Done | Every account has a code; share by WhatsApp, SMS or copy | |
| RR-02 | 🟡 Partial | Reward amounts, invitee reward, coupon validity, monthly cap and join window are settings | The qualifying event is fixed (first completed booking) |
| RR-03 | ✅ Done | Coupons only after the invitee's first completed booking; value, expiry, one use; never cash | |
| RR-04 | ✅ Done | A provider joins with another provider's code; once the invited provider is approved and has completed `provider_referral_bookings` bookings, the referrer gets `provider_referral_rebate_percent` of the commission back on their next `provider_referral_rebate_bookings` completed bookings, as a ledger entry paid out with earnings; a provider cannot join with a patient's code (`content-provider-referrals.int-spec.ts`) | |
| RR-05 | ✅ Done | Only care roles are rewarded; no provider earns from a patient's booking | |
| RR-06 | 🟡 Partial | Self-referral and a second referral per account blocked; over the monthly cap held for review in the admin queue | No device check (no device identifier is collected) |
| RR-07 | ✅ Done | Invitees' status (joined, rewarded) and join date only, no health or booking detail | |
| RR-08 | ✅ Done | Coupons with value and expiry; one coupon per booking at checkout, given back if the booking is cancelled | |
| AD-08 | 🟡 Partial | Admin "Settings": acceptance window, slot hold time (`slot_hold_minutes`), commission, advance, cancellation policy, dispatch, payout hold, no-show, vault quota, renewal and referral rules; changed by super admin after a fresh TOTP, audited | Document checklists are not settings yet; PIN codes stay on the catalogue page |
| AD-09 | ✅ Done | Admin "Content": the wording of every notification template per language (sign-in and confirmation codes stay fixed), checked to keep the default's placeholders and to parse, used for SMS and in-app messages; terms, privacy, questions and refund pages per language at `/{locale}/pages/{slug}`, shown as plain text and linked from the account page; super admin changes after a fresh TOTP, support reads, every change audited | A real SMS provider in India sends only DLT-registered templates: an edited SMS wording must be registered there first (operations step) |
| AD-10 | ✅ Done | Dashboard: sign-ups, approved providers by role and district, bookings by service and status, completion and cancellation rates, revenue; counts only | |
| AD-14 | ✅ Done | Admin "Plans": every plan with its provider, covered item, units, price and status; approve, retire, create a platform plan in three languages; purchases, renewals and cancellations with paid and refunded amounts and renewal state, never the buyer | |
| AD-16 | ✅ Done | Admin "Referrals": flagged queue with release or reject, coupon cancellation; reward rules in Settings | |
| AD-17 | 🟡 Partial | Admin "Security" for super admin: break-glass grants, open strike reviews, flagged referrals, infected uploads | No access reviews, failed-authorisation or unusual-read alerts |

## Step 10: hardening, launch readiness and go-live (not started)

Most of this step is operational and needs people outside the code: the penetration test (FU-24), load and soak tests, the WCAG 2.2 AA audit with screen readers, real-device Core Web Vitals, the restore and key-rotation drills, the access review, legal sign-off (FU-38), support staffing and the go or no-go meeting. Drafted so far (30 October 2026, branch `docs/step-10-runbooks`):

| Item | Status | What exists | What is missing |
| --- | --- | --- | --- |
| Operations runbooks | 🟡 Partial | [Incident response](runbooks/incident-response.md), [breach response](runbooks/breach-response.md) (SO-09), [attendant replacement](runbooks/attendant-replacement.md) (A13), with the existing deploy and rollback, backup-restore, key and secret rotation and clinical emergency runbooks | On-call rota, incident channel, named breach owner and a rehearsal (FU-37); lawyer's confirmation of notification timings (FU-38) |
| Fraud review of referral, coupon and refund paths | 🟡 Partial | Step 9 review: coupons and entitlements are scoped to the booker, used under guards, given back only for what was drawn (one fix before merge); the daily reconciliation checks the entitlement ledger | Refund on cancelling an in-progress booking is the full amount paid (FU-39); no device limit on referrals (RR-06) |
| Full E2E regression of J1 to J9 | 🟡 Partial | Browser journeys J3 (home visit, start code, rating), J4 (attendant, balance, shift check-in and out), J7 (walk-in lab test to report), J8 (package bought and used) and J9 (filed visit notes, own record, history, outside link) in Odia, English and Hindi on mobile, tablet and desktop in the API-backed E2E job (`e2e/journeys.spec.ts`, 45 runs; providers and plans seeded through the API, `e2e/seed.ts`); account journeys as before; J1 to J9 also run end to end in the API integration suite | J1 and J5 in the browser are covered only by the account and admin suites; no visual regression review of the journey screens |

## Documentation gaps found in review

Found while building this page. Open items need a decision before the source docs change; each is
settled by the pull request that builds the step it affects at the latest.

1. **37 requirement IDs are not assigned to any guideline step:** all of A11Y-01 to 07; EN-01, 02,
   07, 10, 13; SE-01, 03, 04; PR-02, 03, 05, 06, 07; SO-02, 04, 06, 07, 09, 10; TS-08, 09;
   LM-08, 09; UX-06, 07, 08; AC-05; BK-06; LB-09; RR-07. Some are covered implicitly by step
   text (for example backups in Step 2, pen tests in Step 6) but not by ID, so they can be missed.
   Proposed assignment: [requirements traceability](requirements-traceability.md) (Draft, amendment A1).
2. **Data classification (DC) has no requirement IDs**, unlike every other module, so it cannot
   be referenced the way CLAUDE.md asks. The draft [Step 2 spec](archive/step-specs/step-02-secure-foundation.md) proposes DC-01.
3. ✅ _Resolved: the requirements now point to the guideline as the only plan._ **Two delivery plans disagree.** The requirements' "Delivery plan" has 8 phases (0 to 7) and a
   "Sprint 0" list; the guideline has 10 steps. Lengths and grouping differ (for example the
   requirements put IC, LB and MV in one phase; the guideline splits them into Steps 7 and 8).
   The requirements should point to the guideline instead of keeping their own plan.
4. ✅ _Resolved._ **"Sprint 0 foundation" list is mis-numbered** (`1, 1, 1, 2, …`) in the requirements.
5. ✅ _Resolved._ **Branch protection and signed commits** (guideline Step 1 item 1 and exit criterion) conflict
   with [ADR 0004](adr/0004-github-free-no-branch-protection.md). The guideline should note the
   accepted deviation.
6. **Backups to a second India region** (EN-10, guideline Step 2 item 3, SO-10 drill in Step 10)
   assume cross-region copies to Hyderabad. If the AWS project is limited to a single Region,
   this is not possible; confirm the project's allowed Regions before Step 2 and record the
   outcome in an ADR. Resolved by decision D1 in the [Step 2 spec](archive/step-specs/step-02-secure-foundation.md); EN-10 reworded.
7. **AD-04 lists four catalogue types** (including specialities, which only the deferred online
   consultation uses), but guideline Step 4 says the catalogue covers the four MVP services,
   including lab tests. AD-04 should match. Proposed in the
   [web roadmap](web-roadmap.md#proposed-guideline-amendments) (Draft, amendment A2).
8. ✅ _Resolved._ **Product name:** the requirements say the application "has no name yet" and keep it as an
   open question; the repo and CLAUDE.md call it HEACH.
9. ✅ _Resolved._ **Repository row of the stack table** in the requirements lists three packages; the
   monorepo has six (`types`, `crypto`, `logger` missing).
10. **Open questions have no owner or due step.** Several block specific steps (load targets block
    TS-08 and Step 4 load tests; the Aadhaar route blocks Step 3; Hindi at launch affects I18N).
    Proposed: each question keyed to the step it blocks in the
    [web roadmap](web-roadmap.md#decisions-the-owner-needs-by-step) (Draft, amendment A7).
11. ✅ _Resolved: tracked as issues #19 to #25 ([FU-09](follow-up-register.md#step-1-items-still-open)); none submitted yet._ **Third-party applications** (payment gateway, SMS DLT, Aadhaar partner, video) must start in
    Step 1, but their status is not tracked anywhere in the repo.
12. ✅ _Resolved 18 October: module approved and added to D4._ **SO-08.2 asks for a Caddy rate limit, but stock Caddy has none.** It needs the third-party
   `caddy-ratelimit` module and a custom Caddy build, which is not in the Step 2 dependency list
   (D4). The API rate limit (SO-08.1) is on. Owner decision: add the module to D4, or reword SO-08.2.
13. **The admin entry may not answer through port forwarding as documented.** Found 24 October
   while adding the test sign-in entry (spec 007): `https://localhost:8443` sends the name
   `localhost`, but the admin site in `deploy/dev/Caddyfile` is addressed only by the host's IP,
   so Caddy has no matching site (an empty response, or a TLS error when no `localhost`
   certificate exists). Reproduced against a local Caddy, not on the dev host. The new 9443 entry
   lists `localhost` too; the admin site was left unchanged (outside the security review's scope).
   Owner decision: add `https://localhost:8443` to the admin site, or document another way in.
   Reproduced on the dev host on 24 October 2026: `https://localhost:8443` answers an empty 200,
   the public host name on 8443 serves the admin page. The same applies to `https://127.0.0.1` and
   `https://127.0.0.1:9443` on the host (no site for that name; CI sets `PUBLIC_HOST=127.0.0.1`, so
   CI does not see it).
14. ✅ _Resolved 25 October: untracked; `coverage-*/` was already ignored._ **Coverage reports were committed** (`packages/crypto/coverage-unit/`, 16 files): any local
   coverage run rewrites them. They should be untracked and ignored.
15. **The 18 October codebase review is not in the repository** (the backlog cites
   `docs/reviews/2026-10-18-codebase-review.md`, which exists only as an untracked file in the
   owner's working copy), and its findings C-3 (note save without error handling or in-flight
   guard), P-2 (global advisory lock on every audited request) and A-1 (toast live region inserted
   with its message) are not in the backlog. Owner decision: commit the review and add the three
   findings, or record them as accepted. Checked 25 October 2026 on `338943c`: S-3, S-4, S-5, S-6,
   C-3, A-1 and P-2 are all still in the code; S-6 was fixed on 28 October 2026 (FU-27)
   ([FU-13](follow-up-register.md#carried-into-step-3-do-not-block-starting-step-3),
   [FU-27](follow-up-register.md#closes-step-2)).
16. **Local integration tests depend on `COMPOSE_PROJECT_NAME`** (found 25 October 2026):
   `test/restore-check.int-spec.ts` reaches PostgreSQL through `docker compose exec` in the default
   project while the job uses the `.env` ports; on an isolated stack without the variable, 9 of 16
   tests fail and scratch databases land in the other stack. CI is unaffected.
   [Local development](local-development.md) should say so ([FU-17](follow-up-register.md#carried-into-step-3-do-not-block-starting-step-3)).
17. **The guideline's step-end demo on a real mid-range Android phone is tracked nowhere** and has
   no record for Step 1 or Step 2 ([FU-08](follow-up-register.md#closes-step-2)).
18. **Owner and agent act through one GitHub account**, so merges and recorded approvals cannot
   be attributed; owner approvals rest on records Claude Code writes from the owner's messages ([FU-14](follow-up-register.md#carried-into-step-3-do-not-block-starting-step-3)).
19. **Package READMEs and `infra/README.md` describe Step 1, not what is built** (found in the documentation cleanup,
   25 October 2026): `packages/crypto/README.md` says "Interface only" although envelope
   encryption, the KMS port and blind indexes exist; (the logger README was corrected on 28 October 2026); `packages/ui/README.md` lists only `Button` and a Step 2 plan,
   while eight components and four states exist; `packages/types/README.md` promises a typed fetch
   client that was never built; `infra/README.md` says the state bucket is AES256-encrypted, while
   `infra/bootstrap/main.tf` sets `aws:kms` (moved in Step 2). Not corrected in the cleanup pull request; fix in the next pull
   request that touches `packages/` or `infra/`.
