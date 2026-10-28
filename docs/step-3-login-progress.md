# Step 3 login and account setup: progress and handoff

The durable record of one long-running task: role-based login and account setup for HEACH, end
to end. Any agent resuming this work reads this page first, then the documents it links. It holds
the owner's instructions (verbatim), what is done, what is blocked and why, and the next command.
It defines no criteria and approves nothing (constitution II, IX).

- **Created:** 28 October 2026
- **Last updated:** 28 October 2026
- **Working branch:** `docs/009-otp-sign-in-spec` (from `origin/main` at `90c1b47`)
- **Selected feature:** slice 3.1, OTP sign-up and sign-in, language choice and sessions:
  [spec 009](../specs/009-otp-sign-in/spec.md) (Draft)

## The instructions (owner, 28 October 2026, verbatim)

> Implement HEACH's web-based role-based login and account setup end to end.
>
> **DESIGN AND SCOPE.** Use apps/web/design-mockups.html, added on main in commit d82d707
> ("Added design layout and mockup."), as the visual reference. Inspect it before designing
> screens. Record this exact path and commit in progress records and handoffs. Scope:
> patient/provider responsive web/PWA, admin web, and necessary APIs, database changes and
> integrations. No native applications.
>
> **INITIAL AUDIT.** Read AGENTS.md and its referenced documents in order. Inspect existing code,
> approved specs, implementation status, follow-ups, remote main and local changes. Preserve
> existing work. Work on branches, never directly on main. Reuse current authentication/session
> code, shared packages and UI components.
>
> **ROLES AND BEHAVIOUR.** Discover exact roles and permissions from requirements: patients,
> representatives, provider types, clinic/front-desk, lab/collector and admin sub-roles as
> specified. Separate registration role selection from server-authorised roles and approved role
> switching. Never grant privileges from browser input. Implement required OTP
> registration/login, admin credentials and MFA, language selection, role-specific account setup,
> validation, save/resume, versioned consent, verification-state routing, protected routes, safe
> redirects, session restoration/refresh/expiry, logout and sensitive-action re-verification.
> Include accessible loading/error/retry/offline states and required translations. Specify the
> boundary between basic account setup and wider provider verification.
>
> **SPEC KIT.** Own necessary Spec Kit preparation and implementation. Reuse the existing
> integration; do not initialise another. Prepare the Step 3 charter and bounded feature specs,
> plans, contracts, data models, threat models, checklists, tasks and criterion-to-test mappings.
> Follow installed skills and repository workflow. Resolve prerequisites, including nested log
> masking. Run structural checks and analysis; resolve critical/high findings. Respect approval
> gates. Prepare concrete docs PRs for owner review. Never approve documents, tick human-only
> checklists or write owner approval comments. Begin dependent application code only after
> required Approved specs/plans are merged. Continue independent authorised work while waiting.
>
> **ENGINEERING.** Enforce permissions server-side for every relevant request and object. Use
> existing crypto, logger and adapter packages. Keep personal data out of logs, URLs and errors.
> Implement migrations, audit events, API contracts and generated types. Keep test-login
> scaffolding restricted to approved environments. Use synthetic data. Do not count fake
> integrations as completed real integrations or print secrets.
>
> **VERIFICATION AND COMPLETION.** Test registration, returning login, account setup/resume, each
> role's allowed/denied access, privilege escalation, cross-account access, OTP
> failures/expiry/reuse/limits, session behaviour and admin MFA. Use appropriate unit,
> integration and browser E2E tests across required locales and viewports. Compare rendered
> screens with the design reference. Run pnpm check and required additional checks. Update
> implementation status and evidence. Prepare code PRs naming approved specs and criterion IDs.
> Do not merge, deploy or apply infrastructure without required authorisation. Persist until
> approved acceptance criteria pass. Do not stop at planning, scaffolding or mock screens. Pause
> dependent work only for genuine approval gates or missing external inputs; state the exact
> unblock action. Mark unavailable external evidence Partial.
>
> **PROGRESS AND HANDOFF.** Save these instructions and durable progress in a repository document
> on the working branch. Record the goal, design path/commit, branch/commit, selected feature,
> approval state, completed tasks, remaining criteria, changed files, decisions, tests, blockers
> and next commands. Before context exhaustion, save progress and provide a self-contained handoff
> prompt for another LLM. Target 97% only if utilisation is measurable; otherwise hand off
> proactively. The next LLM must resume without repeating completed work, losing changes or
> bypassing gates.

## Design reference

- **Path:** `apps/web/design-mockups.html` ("Final UI: lavender and peach").
- **Commit:** the instructions name `d82d707` ("Added design layout and mockup.") on `main`. On
  28 October 2026 that commit does **not** exist on `origin/main` or in this clone, and the file
  is **untracked** in the owner's working tree (6.9 MB, 17 boards, fonts embedded under the SIL
  Open Font License). It is not committed by this branch. **Owner action:** push the commit, or
  say whether the file should be committed in a docs PR. Until then the reference exists only in
  the owner's checkout; an agent in a fresh clone cannot see it.
- **How to view it:** it renders through script into iframes, so read it with a browser, not
  `grep`. Playwright (in `apps/web`) can screenshot each `section.board`.
- **What it covers:** patient home (3 variants), provider onboarding (one step per screen,
  checklist hub, assisted voice-first, desktop steps beside the form), booking (2), records (3),
  admin verification (queue with side panel, focused split review), desktop variants.
- **What it does not cover:** language choice, mobile number and OTP entry, session-expired,
  admin sign-in and MFA. Those screens are derived from its visual language and the Step 2 shell
  in spec 009 and must be compared with the boards it does have.
- **Visual language observed:** lavender primary (filled header cards and pill buttons), peach
  for "in review" status, white cards with a thin border and large radius, Anek typeface, Odia
  line under each English heading (or English under Odia), a globe language control top right,
  a full-width primary button at the bottom with "Save and continue later" as a text button, a
  progress card ("2 of 6 done").

## Audit (28 October 2026)

| Item | Finding |
| --- | --- |
| Remote main | `90c1b47` (#89: web roadmap, traceability matrix, Step 3 charter as Drafts) |
| Local work preserved | Branch `fix/turbo-dev-env-passthrough` (`7afeeaf`, open PR #90) untouched; untracked `apps/web/design-mockups.html` left in place |
| Step 3 charter | [Draft](specs/step-03-accounts-onboarding.md): 13 slices, decisions D3-1 to D3-13 proposed, questions Q3-1 to Q3-9 open, entry conditions E1 to E8 |
| Spec 008 (nested log masking, prerequisite E2) | `spec.md`, `plan.md` on `main`, Draft. Its `tasks.md`, recorded by the [roadmap](web-roadmap.md#step-2-blockers-first) as commit `eb12224` on an unpushed branch, is **not in this clone**; redrafted here |
| Gate exception E3 | Not written. Without it, Step 3 is specification only ([roadmap](web-roadmap.md#step-2-blockers-first) blocker 2) |
| FU-13 triage (E4), branch protection (E5), admin entry (E6) | Open |
| Existing auth to reuse | `apps/api/src/auth`: rotating refresh sessions with replay detection (SE-07.1 to SE-07.23), global deny-by-default guard, `@Roles`/`@Public`, test-login behind `TestLoginGate`; `SmsSender` port and fake in `apps/api/src/adapters`; web `lib/api.ts` (in-memory access token, refresh, cross-tab) and `lib/session.tsx` |
| Roles today | `patient`, `provider`, `admin` on `app.user_test` (Step 2 scaffolding, removed in slice 3.0) |
| Toolchain | Default `node` (Homebrew 26) fails to load `libsimdjson.33`; use `export PATH=/opt/homebrew/opt/node@24/bin:$PATH` (pinned Node 24) |

### Roles and where each is specified

From the [requirements, users and roles](mvp-v1-requirements.md#users-and-roles) and charter D3-3.

| Role | Signs in with | Account setup in | Server grant |
| --- | --- | --- | --- |
| Patient | Mobile OTP | 3.1 (language), 3.2 (profile, linked patients) | On account creation (spec 009) |
| Representative | Mobile OTP | 3.2 (linked patients, relationship) | Patient-side account with linked patients (D3-1), 3.2 |
| Doctor, dentist, dermatologist, physiotherapist, nurse, attendant | Mobile OTP | 3.5 framework, 3.7 per-role flows | Provider applicant on choosing to provide care (3.2); the listed provider role only on admin approval (3.10) |
| Lab owner or signatory, sample collector | Mobile OTP | 3.7 | As providers; collector linked to a verified lab |
| Clinic front desk | Mobile OTP | Step 7 (role defined in 3.2 only) | Step 7 |
| Admin: super admin, verifier, support, finance | Email, password, TOTP | 3.9 | Created by a super admin; first super admin by a bootstrap command (3.9) |

### Boundary: account setup versus provider verification

- **Account setup (slices 3.1 to 3.3, 3.8, 3.12):** mobile number proved by OTP, language,
  sign-up consent, what the user wants to do (need care or provide care), patient profile and
  linked patients, sessions, re-verification. No admin involved. A provider who has only done
  this is a *provider applicant*: they can reach their own onboarding and nothing that serves
  patients.
- **Provider verification (slices 3.4 to 3.7, 3.10, 3.11):** role-specific profile, documents,
  Aadhaar or DigiLocker identity check, submission, admin review, Approved status, public
  profile. Only an admin decision grants a provider role that lists services.

## Approval state

| Document | State | Unblock action (owner) |
| --- | --- | --- |
| Step 3 charter | Draft (on `main`, #89) | Answer Q3-1 to Q3-9; approve by PR comment (constitution IX) |
| Spec 008 spec and plan | Draft (on `main`, #86) | Run `/speckit-analyze` on `specs/008-nested-log-masking`; approve spec and plan by PR comment on this branch's PR or a separate one; merge |
| Spec 008 tasks | Drafted on this branch | Review with the above |
| Spec 009 spec, plan, tasks | Drafted on this branch | Answer its open questions; run `/speckit-analyze` on `specs/009-otp-sign-in`; approve by PR comment |
| Gate exception E3 | Not written | Write it in a PR comment naming FU-01 to FU-08, the reason and the end condition |

No code for any of this may start until the matching row is Approved and merged (constitution
I, G2). Slices 3.2 onward are not specified yet; they are drafted after 009 is reviewed so that
they build on its decisions (charter: "not approved against anything that is not yet Approved").

## Plan of record

1. Docs PR [#91](https://github.com/themechanicalguy/heach/pull/91) (this branch): this page,
   spec 008 `tasks.md`, spec 009 complete set, specs index and charter rows. Opened 28 October
   2026; waiting for the owner.
2. Owner: E3, charter answers, approvals of 008 and 009.
3. Code PR `feat/008-nested-log-masking` (spec 008 tasks), then slice 3.0 spec and code (needs
   FU-13 triage), then `feat/009-otp-sign-in`.
4. Next specs in charter order, each its own docs PR: 3.2 roles and linked patients, 3.3
   consent records, 3.9 admin shell with MFA, 3.5 onboarding framework (save and resume), 3.8
   re-verification for payout details; then 3.4, 3.6, 3.7, 3.10 to 3.12.

## Log

| Date | Done | Commit |
| --- | --- | --- |
| 2026-10-28 | Audit above; design reference rendered and read (17 boards) | (this page) |
| 2026-10-28 | Spec 008 `tasks.md` redrafted (17 tasks, LM-02.3 to LM-02.8, SC-001 to SC-003) | `5a8565b` |
| 2026-10-28 | Spec 009 (slice 3.1) drafted: spec (27 criteria, 5 stories), plan, research, data model, contract, quickstart, requirements and security checklists (unticked), tasks (42); specs index and charter rows | `5a8565b` |
| 2026-10-28 | `node scripts/check-specs.mjs` passes; `pnpm test:scripts` 58 of 58; `pnpm format:check` clean except the untracked mockup | `5a8565b` |
| 2026-10-28 | Agent analysis (below); one high and two medium findings fixed in the drafts | `5a8565b` |

## Agent analysis (28 October 2026)

Done by the drafting agent with the `speckit-analyze` categories. It does **not** replace the
owner's `/speckit-analyze` run that gate G2 requires.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| A1 | High | Charter D3-9 removed `app.user_test` in slice 3.0, but sessions and the test sign-in reference it until 3.1 replaces them | Draft charter D3-9 and the 3.0 row changed: `user_test` and test sign-in go in 3.1 (spec 009 SE-07.25); also an open question in spec 009 |
| A2 | Medium | Outbox contract carried the last four digits in a query string (constitution IV: no personal data in URLs) | `POST /v1/test/sms-outbox` with the number in the body |
| A3 | Medium | Refresh cookie is scoped to `/api/v1/auth`, so a page request cannot be redirected by the server; AC-05.2 "nothing shown" was underspecified | Plan Summary: client-side gate, skeleton until the session is restored |
| A4 | Low | Spec 008 names `index.test.ts` for LM-02.3 and LM-02.4 proofs; its plan names `sanitize.test.ts` too | Tasks put tests in both files; no change to the Draft spec |
| A5 | Low | AC-01.3's timing bound (p95 gap under 50 ms over 200 requests) may be noisy in CI | Kept; if flaky, the owner can relax the number in the spec (never silently in the test) |
| A6 | Info | Spec 009 depends on slice 3.0 in the charter; 3.0 is not specified (needs FU-13 triage, E4) | Spec 009's migration works whether 3.0 has run or not |

Coverage: each of spec 009's 27 criteria maps to at least one task (T012 to T036); each of spec
008's six criteria and three success criteria maps to T002 to T013.

## Changed files on this branch

- `docs/step-3-login-progress.md` (this page)
- `docs/specs/README.md` (rows 008, 009), `docs/specs/step-03-accounts-onboarding.md` (D3-9, slice
  rows 3.0 and 3.1)
- `specs/008-nested-log-masking/tasks.md`
- `specs/009-otp-sign-in/`: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`,
  `contracts/accounts-api.md`, `checklists/requirements.md`, `checklists/security.md`, `tasks.md`

## Next commands

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
git fetch origin && git switch docs/009-otp-sign-in-spec
node scripts/check-specs.mjs          # structure of every spec
pnpm format:check
```

## Handoff prompt

Kept current at the end of each session. Paste it into a new agent session to resume.

> You are resuming HEACH's Step 3 role-based login and account setup work in
> `/Users/lazyknight/CodeRepos/heach`. Read `AGENTS.md`, then `docs/step-3-login-progress.md`
> (instructions verbatim, audit, approval state, log, next commands) before anything else; do not
> redo its audit. Use Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:$PATH`). Never commit
> to `main`, never set a spec Approved, never write an owner approval comment, never tick a
> human-only checklist, never merge, deploy or apply infrastructure. Application code starts
> only when the progress page's approval table shows the spec and plan Approved and merged and
> the gate exception E3 written. Docs PR #91 holds the drafts; check its comments first and fix
> what the owner asks there, on the same branch. While it waits, draft the next slice spec
> (3.2 roles and linked patients) as its own docs PR. Continue from the first unfinished row of "Plan of record"; log
> every finished step in the Log table with its commit, and refresh this prompt before you stop.
