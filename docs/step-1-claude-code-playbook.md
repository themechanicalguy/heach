# Step 1 with Claude Code: prompts and working steps

- **Covers:** Step 1 of `mvp-v1-implementation-guideline.md` (repository and app initialization)
- **Revised:** 17 October 2026, second revision (first version 3 October 2026)
- **What changed in this revision:** you have decided to **stay on the AWS Free plan until it ends**, then set budgets and upgrade. Part B4 now builds **credit-expiry alerts**, a new part B6 covers the upgrade and the budgets, and Track P and the checklists follow. Earlier in the day the plan was rebuilt around AWS free credits and a restricted pilot hosted on an IP address.
- **How to use:** one Claude Code session per part, one prompt, one check you run yourself, one commit.

## Contents

1. [Where you are now](#where-you-are-now)
2. [AWS credits and IP-only hosting: what to know first](#aws-credits-and-ip-only-hosting-what-to-know-first)
3. [Working rules for every session](#working-rules-for-every-session)
4. [The parts at a glance](#the-parts-at-a-glance)
5. [Session 0: the prompt you start with](#session-0-the-prompt-you-start-with)
6. [Track A: local setup](#track-a-local-setup)
7. [Track B: cloud initialization, revised for AWS credits](#track-b-cloud-initialization-revised-for-aws-credits)
8. [Track P: restricted pilot on an IP address](#track-p-restricted-pilot-on-an-ip-address)
9. [What you do yourself, outside Claude Code](#what-you-do-yourself-outside-claude-code)
10. [Step 1 exit check](#step-1-exit-check)

## Where you are now

| Part | Status |
| --- | --- |
| Session 0 and A1 to A8 (local setup) | Done |
| B1 Cloud bootstrap | Done |
| B2 Dev environment | Done, but built before the credit limit was known. Review its cost first (B2R) |
| B2R, B3, B4, B5 | Next, in this order. B4 now builds the credit-expiry alerts |
| B6 Upgrade to the Paid plan and set budgets | When an alert says so, and no later than 15 days before the Free plan ends |
| Track P (restricted pilot on an IP address) | Later, when development is complete |

## AWS credits and IP-only hosting: what to know first

Your plan: develop for about six months on AWS free credits, then host the finished application on a bare IP address for a small group of users, kept inside the credits. This works, but five facts change how Track B must be built. The AWS facts below come from AWS announcements and press coverage and were checked on 17 October 2026; confirm them in your own Billing console, because AWS changes these terms.

### 1. The Free plan closes your account at six months

| | Free plan | Paid plan |
| --- | --- | --- |
| Credits | $100 on sign-up, up to $200 in total by completing AWS activities | Same credits |
| When it ends | The account closes at 6 months or when credits run out, whichever comes first. You have 90 days to upgrade and recover data | The account stays open. Unused credits stay valid for up to 12 months from sign-up |
| Services | Some costly services are blocked | All services |
| Risk | Resources shut down and the account closes | After the credits are used, normal charges go to your card |

What this means for you:

- **Open the Billing console and check which plan the account is on.** This decides everything below.
- Hosting after month six is only possible on the **Paid plan**. You have decided to stay on the Free plan until it ends and upgrade then. Section 6 below sets out how to do that safely, part B4 builds the alerts, and part B6 does the upgrade and sets the budgets.
- The implementation guideline estimates 38 to 43 weeks for the full build, which is longer than six months. Keep cloud use during development small so credits last.
- Plan for a credit pool of **$100** until a larger amount actually shows on the Billing "Credits" page.

### 2. Development spend and pilot spend come from the same pool

Development is mostly local (Docker Compose), so the cloud should run only what local cannot do: testing the deploy pipeline and receiving partner callbacks. Work out the budget like this:

- Pilot reserve: the monthly cost of the lean pilot design (part B2R estimates it) times the months you want to run it, plus 20 percent.
- Development allowance: whatever is left. Stop or destroy dev resources when you are not using them (part B4).

### 3. What costs money even when the application is idle

| Item | Cost | Why it matters |
| --- | --- | --- |
| NAT gateway | $0.045 per hour, about $33 per month each, plus data fees | The most common way test accounts burn credits. The lean design has none |
| Public IPv4 address | $0.005 per hour, about $3.65 per month each, including idle or stopped resources | Every public IP counts. The lean design has one |
| KMS key | $1 per month per key | Cheap, and the requirements want separate keys per data domain. Keep them |
| Load balancer, managed PostgreSQL, managed Redis | Hourly charges that run 24 hours a day | The first B2 design used these. B2R replaces them. Check current prices in the AWS Pricing Calculator; I have not verified them here |

### 4. AWS credits do not cover everything

Credits pay for AWS services only. The SMS provider, payment gateway fees, the video consultation provider, the Aadhaar and DigiLocker partner and any domain name are billed separately by those companies. Include them in your budget.

### 5. HTTPS on a bare IP address

- The requirements demand TLS everywhere, and browsers only enable the install prompt, service worker and camera and microphone access on secure connections. Plain HTTP on an IP would break the PWA and video consultation, and it would send patient data unencrypted.
- Let's Encrypt now issues free certificates for IP addresses (generally available since January 2026). They are short-lived, about six days, so renewal must be automatic (part P2). Issuing needs the server reachable from the internet so the IP can be validated.
- The IP must never change. Use an Elastic IP and never release it. If it changes, the certificate, every partner callback URL and every user bookmark break.
- **A domain name is still the safer choice.** I have not verified the onboarding rules of payment gateways and the Aadhaar and DigiLocker partners, but such providers commonly ask for a website domain and HTTPS callback addresses. Check each one before assuming an IP is accepted. A domain is separate from the application name: you can register a neutral placeholder now and move to the real name later. If any partner refuses an IP, you will need one.

### 6. Your decision: stay on the Free plan until it ends

Decision recorded on 17 October 2026: use the Free plan until it ends, then set budgets and upgrade to the Paid plan. Alerts must warn you well before the end.

**What you gain.** On the Free plan AWS does not charge you for usage beyond your credits, so a mistake cannot produce a surprise bill. That is the safest way to learn the platform.

**What you accept.** The plan ends at the first of two events: six months pass, or the credits are used up. If development spend is heavier than planned, credits can run out well before month six, and the end date moves closer with every costly resource you leave running.

**What AWS tells you itself** (from AWS's announcement; confirm in your account):

- Email alerts when 50, 25 and 10 percent of your credits remain.
- Console and email notices when 15, 7 and 2 days remain in the six-month period.
- An email with upgrade instructions after the plan ends, and 90 days to reopen the account by upgrading.

**What AWS does not say.** The announcement does not describe what happens to running resources at the end of the plan or during an upgrade. Third-party write-ups say resources are shut down and the account is closed. Treat the end of the plan as downtime, with some risk to data, and do not plan to find out.

**What this means for the timing of your upgrade.** Waiting for the plan to end is possible because of the 90-day window, but I recommend upgrading no later than the 15-day notice (the "Act" level below). That keeps the instance running without a gap and gives you time to recover if the upgrade hits a problem. Upgrading keeps unused credits valid for up to 12 months from your sign-up date, so the later you upgrade, the fewer calendar months you have left to spend them.

**Alert levels.** Part B4 builds a daily check on top of AWS's emails. A level is reached when either trigger is met, whichever comes first.

| Level | Trigger | What you do |
| --- | --- | --- |
| Watch | 50 percent of credits left, or 60 days left | Review spend with `scripts/credit-status`; put the upgrade date in your calendar |
| Plan | 25 percent left, or 30 days left | Confirm your payment card is valid; take an encrypted backup outside the account; make sure the B6 budgets are written and planned in Terraform |
| Act | 10 percent left, or 15 days left | Upgrade now (part B6). This is the latest safe moment |
| Emergency | 5 percent left, or 7 days left | Upgrade today; stop idle dev resources |

Two more alerts run alongside: a **burn-rate warning** when, at the current daily spend, credits would run out before the plan's end date, and a **plan state warning** if the plan status ever shows as expired.

### What the lean pilot design keeps and what it relaxes

The pilot is a restricted trial, not the full launch. Record the relaxations in an ADR (part B5).

| Kept (not negotiable) | Relaxed for the pilot |
| --- | --- |
| Encryption in transit (TLS) and at rest | Managed, multi-zone database (replaced by PostgreSQL on one encrypted disk) |
| Field-level encryption with KMS keys per data domain | Backups to a second region (use encrypted snapshots in the same region plus an encrypted copy outside the account) |
| Audit log, role-based access, least-privilege identities | Web application firewall and DDoS protection |
| Private storage, no secrets in code, no personal data in logs | Separate staging environment and preview deployments |
| Consent, privacy notice, grievance contact | Autoscaling, high availability, the 99.5 percent uptime target |

One warning on data: the requirements say real patient data enters production only after the penetration test and legal sign-off (Step 6 of the guideline). An invited pilot with real people is still real patient data. Use synthetic data until those gates pass, and treat part P5 as the gate.

## Working rules for every session

1. **One part per session.** Start a fresh session for each part. The project memory file (`CLAUDE.md`) carries the context forward.
2. **Plan first, then build.** Use Claude Code's plan mode: read the plan, correct it, then let it implement.
3. **Small branches.** Each part is its own branch and pull request, for example `step1/b3-deploy`.
4. **You run the check.** Every part ends with commands you run yourself. Do not accept "it should work".
5. **No secrets in prompts or in the repository.** Use environment variables and git-ignored `.env` files.
6. **Infrastructure changes need your eyes.** Claude Code writes the infrastructure code and shows the plan; you read it and approve the apply.
7. **Update the memory file.** End each session by recording new commands and conventions in `CLAUDE.md`.
8. **Cost rule (new).** Every infrastructure change must come with a list of billable resources and an estimated monthly cost. Claude Code must not add a NAT gateway, load balancer, managed database or managed cache, or extra public IP without asking you first. Every resource carries tags for application, environment and owner so cost can be traced.

A closing prompt you can reuse at the end of every part:

```text
Before we finish: run the full check for this part and show me the output.
Then update CLAUDE.md with any new commands, folders or conventions from this
session (keep it short), list anything you left unfinished, and prepare a
commit and pull request with a clear description. Do not merge. For any
infrastructure change, list the billable resources it creates and their
estimated monthly cost.
```

## The parts at a glance

| Part | What it produces | Status |
| --- | --- | --- |
| 0, A1 to A8 | Local setup: monorepo, three app shells, packages, Docker Compose, quality gates, CI | Done |
| B1 | Cloud bootstrap: Terraform layout and remote state | Done |
| B2 | First dev environment | Done, to be right-sized |
| B2R | Cost review; replace costly parts with the lean single-instance design | Next |
| B3 | Build and deploy pipeline to dev | Next |
| B4 | Credit-expiry alerts, credit status report, sleep and wake routine | Next |
| B5 | Branch protection, ADR for the credit decisions, environment docs | Next |
| B6 | Upgrade to the Paid plan and set budgets | When an alert says so (Act level at the latest) |
| P1 | Pilot environment built from the same Terraform | After development |
| P2 | HTTPS on the IP address with automatic renewal | After development |
| P3 | Invite-only access and a hard user cap | After Step 3 (needs login) |
| P4 | Cost watch on the Paid plan and a shutdown plan | After development |
| P5 | Pilot go-live check | After development |

## Session 0: the prompt you start with

**Status: done.** Kept here for reference and for onboarding another developer.

Goal: Claude Code reads your documents, writes the project memory file, and proposes a plan. No application code yet.

```text
You are helping me build a healthcare services web application for Odisha, India.
It handles sensitive patient data, so security and data protection come before
speed in every decision.

Read these two files fully before doing anything else:
- docs/mvp-v1-requirements.md
- docs/mvp-v1-implementation-guideline.md

We are starting Step 1 of the guideline: repository and app initialization.
Do not write any application code in this session.

Do these three things:

1. Create CLAUDE.md in the repository root. Keep it under 120 lines. Include:
   - what the application is, in three sentences
   - the stack from the "Architecture and tech stack" section
   - the monorepo layout we are going to build (apps/web, apps/admin, apps/api,
     packages/ui, i18n, config, types, crypto, logger)
   - working rules: TypeScript strict; no hard-coded user-facing strings; no
     secrets in code; no personal or health data in logs; every change on a
     branch with a pull request; ask before adding a dependency that is not in
     the stack
   - a "Commands" section, empty for now, that we will fill as we go
   - a pointer to the two docs files instead of copying their content

2. Tell me anything in Step 1 that is ambiguous or that you would do
   differently, and why. Ask me the questions you need answered.

3. Propose a plan for Step 1 as a numbered list of small parts, each ending in
   something I can run and check. Compare it with this split and tell me if you
   would change the order: A1 monorepo skeleton, A2 web shell, A3 admin shell,
   A4 API shell, A5 shared package stubs, A6 local services with Docker Compose,
   A7 lint and commit hooks, A8 CI and docs, then cloud setup.

My choices: project short name is [APP_SLUG]; package scope is @[APP_SLUG];
GitHub repository is [GH_ORG]/[GH_REPO].
```

Check before moving on:

- [ ] `CLAUDE.md` exists, is short, and matches the requirements
- [ ] You have answered Claude Code's questions and the plan is agreed
- [ ] Commit `CLAUDE.md` on `main` (the last direct commit to `main`)

## Track A: local setup

**Status: A1 to A8 done.** The prompts stay here so another developer can repeat them.

### A1. Monorepo skeleton

```text
Part A1 of Step 1: monorepo skeleton. Work on branch step1/a1-monorepo.
Plan first and show me the plan before creating files.

Set up:
- pnpm workspaces with apps/* and packages/*
- Turborepo with pipelines for build, dev, lint, typecheck and test
- Node LTS pinned (.nvmrc and "engines"), pnpm version pinned
- packages/config with shared tsconfig (strict mode), ESLint and Prettier
  configs that the apps will extend
- root scripts: dev, build, lint, typecheck, test, format
- .gitignore, .editorconfig, and .env.example with no real values

Do not create the apps yet. When done, run pnpm install and pnpm typecheck and
show me the output.
```

Check: `pnpm install` and `pnpm typecheck` succeed on a clean clone.

### A2. Web app shell

```text
Part A2: apps/web shell. Branch step1/a2-web. Plan first.

Create apps/web with Next.js (App Router, TypeScript) extending packages/config.
This app will serve patients and providers and is mobile first.

Include only:
- a home page that renders a heading from a messages file, not a hard-coded
  string (full i18n comes in Step 2; just make the pattern obvious)
- a /healthz route returning status and build version
- viewport meta and a minimal responsive layout that works at 360 px
- one unit test and one Playwright smoke test that loads the home page at a
  mobile viewport
- scripts: dev, build, start, lint, typecheck, test, test:e2e

No UI library, auth, or data fetching yet. Run build, test and the smoke test
and show me the output.
```

Check: `pnpm --filter web dev` shows the page; `/healthz` responds; tests pass.

### A3. Admin app shell

```text
Part A3: apps/admin shell. Branch step1/a3-admin. Plan first.

Create apps/admin as a React + TypeScript single-page app built with Vite,
extending packages/config. This is the desktop-first admin panel.

Include only:
- a landing page with a placeholder layout (sidebar and content area) designed
  for 1280 px and usable at tablet width
- text read from a messages file, not hard-coded
- one unit test and one Playwright smoke test at a desktop viewport
- scripts matching apps/web

No login, routing library decisions or data grid yet. Run build and tests and
show me the output.
```

Check: `pnpm --filter admin dev` shows the page; tests pass.

### A4. API shell

```text
Part A4: apps/api shell. Branch step1/a4-api. Plan first.

Create apps/api with NestJS (TypeScript strict), extending packages/config.

Include only:
- GET /healthz (liveness) and GET /readyz (readiness; for now returns ok)
- configuration loaded and validated from environment variables, failing fast
  on missing values; .env.example updated
- OpenAPI document generated at /docs in non-production environments
- a global validation pipe and a consistent error response shape
- one unit test and one integration test that calls /healthz
- a multi-stage Dockerfile running as a non-root user

No database, auth or business modules yet. Run build and tests, build the
Docker image, and show me the output.
```

Check: `/healthz` responds locally; `/docs` shows the OpenAPI page; the image builds.

### A5. Shared package stubs

```text
Part A5: shared package stubs. Branch step1/a5-packages. Plan first.

Create these packages, each with a build, a README stating its purpose, and
one trivial tested export so the wiring is proven. Real implementations come
in Step 2.

- packages/ui: one Button component, consumed by apps/web and apps/admin
- packages/i18n: locale list (or, en, hi) and a typed message loader stub
- packages/types: generated API client types from the apps/api OpenAPI
  document, with a script to regenerate
- packages/crypto: interface only for field-level encryption (encrypt,
  decrypt, key version); no implementation, and a README saying real
  cryptography arrives in Step 2 and must not be improvised here
- packages/logger: structured JSON logger wrapper with a redact option, used
  by apps/api for its startup log

Wire each into at least one app and show that turbo build builds everything in
the right order.
```

Check: `pnpm build` builds all apps and packages; changing the `ui` Button shows in both front ends.

### A6. Local services

```text
Part A6: local development services. Branch step1/a6-local-services.
Plan first.

Add a docker-compose.yml for local development with:
- PostgreSQL (with a named volume and a healthcheck)
- Redis
- an S3-compatible object store
- a local mail and SMS catcher so no real messages are ever sent in development

Requirements:
- credentials come from .env (git-ignored); .env.example documents every
  variable with safe placeholder values
- one root command (pnpm dev:up) that starts the services, waits for health,
  and then starts all three apps; pnpm dev:down stops everything
- apps/api /readyz now checks PostgreSQL and Redis connectivity
- a short docs/local-development.md covering setup from a clean clone

Do not add schemas or migrations yet. Run it and show me /readyz returning ok.
```

Check: from a clean clone, `pnpm install` then `pnpm dev:up` gives you all three apps and a passing `/readyz`.

### A7. Code quality and commit hooks

```text
Part A7: code quality gates. Branch step1/a7-quality. Plan first.

Add:
- pre-commit hook running lint, format and typecheck on staged files only
- commit message check enforcing Conventional Commits
- a secret-scanning check in the pre-commit hook
- an ESLint rule setup that will let us ban hard-coded user-facing strings in
  Step 2 (add it in warn mode and tell me what it currently flags)
- a root "pnpm check" that runs lint, typecheck, unit tests and build, which is
  what CI will run

Show me a commit being rejected for a bad message and for a fake secret, then
remove the fake secret.
```

Check: a bad commit message and a planted fake key are both blocked.

### A8. CI pipeline and documentation

```text
Part A8: CI and docs. Branch step1/a8-ci. Plan first.

Create a GitHub Actions workflow that runs on every pull request and on main:
- install with pnpm cache, Turborepo cache
- lint, typecheck, unit tests, build
- Playwright smoke tests for web (mobile viewport) and admin (desktop viewport)
- dependency audit and secret scan
- minimal permissions on the workflow token; third-party actions pinned

Also add:
- .github/pull_request_template.md containing the "Definition of done" list
  from docs/mvp-v1-requirements.md
- README.md: what this is, prerequisites, quick start, commands, folder map
- CONTRIBUTING.md: branch naming, commit format, review rules
- docs/adr/0000-template.md and docs/adr/0001-monorepo-and-stack.md recording
  the stack decision
- CODEOWNERS placeholder

Open the pull request and show me the workflow run result.
```

Check: the pull request shows a green pipeline; deliberately breaking a test turns it red.

**Track A is done** when a teammate can clone the repository, follow the README, and have everything running in under 30 minutes.

## Track B: cloud initialization, revised for AWS credits

Principles for every part below: one environment (dev) during development, no staging, no preview deployments, nothing running 24 hours a day that does not need to, and every apply preceded by a cost estimate.

### B1. Cloud bootstrap

**Status: done.** Remote state exists in an India region. Nothing more to do here.

### B2. Dev environment

**Status: done**, but it was built before the credit limit was known. Do B2R next. If you also applied a staging environment, destroy it in B2R.

### B2R. Cost review and right-sizing (do this next)

Goal: find out what B2 costs per month and replace the expensive parts with the lean single-instance design that the pilot will also use.

```text
Part B2R: cost review and right-sizing. Branch step1/b2r-cost-review.
Until I approve a plan, run only read-only commands and terraform plan.

Context: our AWS account runs on free credits only (a pool of about $100, maybe
up to $200). The credits must cover development AND a later restricted pilot
hosted on a single IP address. Cost matters more than availability for now.
Read the "AWS credits and IP-only hosting" section of
docs/step-1-claude-code-playbook.md.

1. List every billable resource Terraform created in dev (and staging, if it
   was applied) with type, size and estimated cost per month. Use the AWS
   Pricing Calculator or current AWS price pages and label every number as an
   estimate. Flag in particular: NAT gateways, load balancers, managed
   PostgreSQL, managed Redis, KMS keys, secrets, public IPv4 addresses, and
   anything running 24 hours a day.

2. Propose a lean design with these constraints:
   - no NAT gateway and no load balancer
   - one EC2 instance in a public subnet running Docker Compose with api, web,
     admin, a reverse proxy, PostgreSQL and Redis
   - security group allowing only ports 80 and 443 from the internet; no open
     SSH; administer through AWS Systems Manager Session Manager
   - encrypted EBS volume, nightly encrypted snapshots, one Elastic IP
   - S3 bucket for uploads: private, encrypted, public access blocked
   - separate KMS keys per data domain (health records, identity, payments,
     documents) kept as in the requirements
   - secrets in Parameter Store or Secrets Manager, never in code or Terraform
     outputs
   - least-privilege identity for the instance

3. Show a before and after table of estimated monthly cost, and list which
   requirements in docs/mvp-v1-requirements.md the lean design weakens, so I
   can record them in an ADR.

4. Write the Terraform changes and show the plan. Wait for my approval before
   each apply. After applying, destroy the resources the lean design no
   longer needs, and show me the resource list that remains.
```

Check:

- [ ] You read the before and after cost table and the list of weakened requirements
- [ ] After apply, no NAT gateway, load balancer, managed database or managed cache remains (check the AWS console or ask Claude Code to list them)
- [ ] Exactly one public IPv4 address is allocated

### B3. Build and deploy pipeline (dev only)

```text
Part B3: deploy pipeline to dev only. Branch step1/b3-deploy. Plan first.

Extend GitHub Actions so that a merge to main:
- builds container images for web, admin and api, tagged with the commit SHA
- scans the images and fails on high-severity findings
- pushes them to the container registry (keep a small retention rule so old
  images are deleted automatically)
- deploys to the dev instance by sending a command through AWS Systems Manager
  that pulls the new images and restarts Docker Compose; no SSH
- runs a smoke test against /healthz and /readyz
- redeploys the previous image tag if the smoke test fails

GitHub must authenticate to AWS with short-lived federated credentials
(OIDC), not stored access keys, using one deploy role with only the
permissions it needs. There is no staging environment. Tell me exactly which
settings I must create by hand in GitHub and in the AWS console, then walk me
through a first deploy.
```

Check: merging a small change reaches the dev instance with no manual steps, and the smoke test passes.

### B4. Credit-expiry alerts and sleep routine

Goal: know early, from two independent sources, when the Free plan is about to end, and keep development spend low in the meantime. Budgets and the upgrade come later, in B6.

Before you start, record three facts in `docs/credit-baseline.json` (you can read them in the Billing console, "Credits" page): the sign-up date, the credits you started with, and the plan end date. The AWS API reports remaining credits but not the starting amount, so percentages need this file.

```text
Part B4: credit-expiry alerts. Branch step1/b4-credit-alerts. Plan first.

Context: we stay on the AWS Free plan until it ends, then set budgets and
upgrade (part B6). The account closes when credits run out or six months pass.
AWS itself emails at 50, 25 and 10 percent of credits left and shows notices
at 15, 7 and 2 days left. We want our own earlier warnings as well. Read the
"Your decision: stay on the Free plan until it ends" section of
docs/step-1-claude-code-playbook.md and use its four alert levels.

1. scripts/credit-status: call the AWS Free Tier API
   (aws freetier get-account-plan-state; check the current CLI and API docs for
   the endpoint region and the exact IAM permission name) and print plan type,
   plan status, remaining credits, expiry date and days left. Read the starting
   credits and sign-up date from docs/credit-baseline.json and also print
   percent of credits left. Add: average daily spend over the last 14 days
   excluding credits (Cost Explorer API calls are charged per request, so check
   current pricing and keep this to a few calls per day), the projected date
   credits run out, and a warning if that date is earlier than the plan end
   date.

2. A scheduled GitHub Actions workflow credit-watch, running daily:
   - authenticate with OIDC using a SEPARATE read-only role that can call only
     the Free Tier read action and the Cost Explorer read actions
   - run scripts/credit-status and classify the result as ok, Watch, Plan, Act
     or Emergency using the thresholds in the playbook (either trigger counts)
   - when the level rises, open or update one GitHub issue labelled
     credit-alert with the numbers and the recommended action for that level,
     so GitHub emails everyone watching the repository
   - also send an email through an Amazon SNS topic subscribed by two email
     addresses I will give you
   - also alert when the plan status is anything other than ACTIVE, and when
     the credit-status call itself fails

3. A --simulate option on scripts/credit-status that accepts fake values, and
   a manual workflow run that uses it, so we can prove every level raises an
   alert without waiting.

4. scripts/dev-sleep and scripts/dev-wake that stop and start the dev
   instance. Print what keeps costing while it sleeps (disk storage and the
   public IP address).

5. A resource-tagging check in CI that fails when a Terraform resource lacks
   the application, environment and owner tags.

6. docs/credit-expiry-plan.md: the four levels and what to do at each, where to
   see credits in the console, what AWS emails, how to sleep and wake dev, how
   to take an encrypted backup of the database and uploads to storage outside
   the AWS account, and what to do if we miss the window (90 days to reopen the
   account by upgrading).

7. Write, but do NOT apply, the Terraform for the budgets that part B6 will
   need, and show me the plan output so B6 is ready to apply in minutes.

Do not apply anything until I approve the plan.
```

Check:

- [ ] `scripts/credit-status` prints numbers that match the Billing console "Credits" page
- [ ] Simulated Watch, Plan, Act and Emergency each open or update a GitHub issue and you receive the email
- [ ] The AWS account contact email and the SNS addresses are ones you read daily, and AWS emails are not going to spam
- [ ] The credit-watch workflow has run on its own for three days in a row
- [ ] `scripts/dev-sleep` and `scripts/dev-wake` work, and the application answers again after wake
- [ ] You have set calendar reminders as a backup (see the list at the end)

### B5. Branch protection and documentation

```text
Part B5: protection and docs. Branch step1/b5-docs. Plan first.

1. Give me the gh commands (or the settings to click) for branch protection on
   main: pull requests only, one approving review, required status checks from
   our CI workflow, no force pushes, signed commits. Do not run them until I
   confirm.
2. Write docs/adr/0009-aws-credits-and-restricted-pilot.md recording: the
   decision to run on AWS free credits, the decision to stay on the Free plan
   until it ends and upgrade no later than the Act alert level, the
   single-instance lean design, the decision to host the pilot on an IP
   address, and the exact list of requirements relaxed for the pilot with the
   reason for each.
3. Write docs/environments.md: dev only for now, how deploys work, how to roll
   back, how to sleep and wake dev.
4. Walk through the Step 1 exit criteria in
   docs/mvp-v1-implementation-guideline.md one by one with evidence, and mark
   the staging criterion as "replaced by dev only, see ADR 0009".
```

Check: `main` rejects a direct push; the ADR lists every relaxed requirement.

### B6. Upgrade to the Paid plan and set budgets

Run this when the credit-watch alert reaches **Plan** or **Act**. Do not wait for the Free plan to end. After the upgrade AWS charges your card for any usage beyond your credits, so the budgets go in the same day.

Steps you do yourself:

1. Take an encrypted backup of the database and uploads to storage outside the AWS account (the Plan-level action in `docs/credit-expiry-plan.md`). Dev data is fine; this is practice for the pilot.
2. In the Billing console, note the credit balance and the plan end date. Take a screenshot.
3. Check that your payment card is valid and will not expire soon. AWS asked for a card at sign-up, but some Indian cards need international or recurring payments enabled, so confirm with your bank.
4. Upgrade the account plan in the Billing console. AWS says you can upgrade at any time and that unused credits stay valid for up to 12 months from sign-up.
5. Run the prompt below straight away.
6. Check from your terminal: `scripts/credit-status` should now show the plan as PAID with credits remaining, the instance should be running, and the application should answer.

```text
Part B6: budgets after upgrade. Branch step1/b6-budgets. Plan first.
I have upgraded to the Paid plan. Do not apply anything until I confirm the
plan.

1. Apply the budgets Terraform prepared in part B4, adjusted as follows, for
   every environment that exists:
   - a monthly cost budget with a cap I will give you (default: the lean
     estimate from B2R plus 25 percent)
   - email alerts at 50, 80 and 100 percent of actual spend and at 100 percent
     of forecast spend, to two addresses
   - a second budget that tracks spend EXCLUDING credits (gross usage), so I
     can see how fast credits are consumed and when real charges begin; check
     the current AWS Budgets documentation for how to exclude credits
   - a budget action that stops the dev or pilot instance at 100 percent of the
     monthly cap if AWS supports that for EC2; otherwise tell me the nearest
     option (for example an alert that triggers a stop through Systems
     Manager)
2. Switch on AWS Cost Anomaly Detection with an email alert for unusual daily
   spend, and tell me its cost first.
3. Update scripts/credit-status and the credit-watch workflow for the Paid
   plan: check what accountPlanExpirationDate means after the upgrade and add
   the date the credits expire (12 months after sign-up). Replace the Act and
   Emergency messages with "credits nearly gone: charges to the card begin
   soon".
4. Update docs/credit-expiry-plan.md with everything that changed after the
   upgrade, and record the upgrade date in docs/adr/0009.
```

Check:

- [ ] `scripts/credit-status` reports the plan as PAID and shows the credit expiry date
- [ ] A test budget alert reaches both email addresses
- [ ] The gross-usage budget shows real numbers
- [ ] The dev instance never stopped during the upgrade (compare uptime in the AWS console)

### Skipped for now

- **Staging environment:** replaced by dev during development and by the pilot environment at the end.
- **Preview deployments per pull request:** they cost money and the local setup already covers them.
- **Production environment:** replaced by the restricted pilot (Track P).

## Track P: restricted pilot on an IP address

Run this track when development is finished. Only P3 depends on application features; do it as soon as the login feature exists (Step 3 of the guideline).

### P1. Pilot environment

```text
Part P1: pilot environment. Branch pilot/p1-environment. Plan first; do not
apply until I approve the plan and the cost estimate.

Create a "pilot" environment in Terraform from the same lean modules as dev:
one EC2 instance with Docker Compose, encrypted EBS volume with nightly
snapshots, one Elastic IP, a private encrypted S3 bucket, separate KMS keys
(new keys, not the dev keys), secrets in the secrets store, access through
Session Manager only.

Rules:
- no data is ever copied from dev to pilot; pilot starts empty
- deletion protection on the disk, bucket and keys
- tag everything with environment=pilot
- before the apply, destroy the dev environment (or stop it) so credits are
  not spent twice, and tell me the estimated monthly cost of pilot running
  alone and how many months my remaining credits cover at that rate, with a
  20 percent reserve
```

Check: the cost estimate and months covered are acceptable to you; pilot starts empty.

### P2. HTTPS on the IP address

```text
Part P2: HTTPS for the pilot on its IP address. Branch pilot/p2-https.
Plan first.

Our pilot has no domain, only an Elastic IP. Set up a publicly trusted
certificate for the IP address from Let's Encrypt using the short-lived
profile (IP address certificates must be short-lived, about six days). Check
the current Let's Encrypt and ACME client documentation first, and use a
client that supports IP address certificates.

Requirements:
- fully automatic issuance and renewal; renew well before expiry
- the reverse proxy reloads the new certificate without downtime
- port 80 stays open for validation and redirects everything else to HTTPS
- an alert (email) if renewal fails or if the certificate has fewer than three
  days left
- TLS 1.2 or higher only, strong ciphers, standard security headers
- a runbook in docs/ for what to do if renewal fails, including how to confirm
  the Elastic IP has not changed
- an automated test that fails if the certificate on the live IP is invalid,
  not for the IP, or close to expiry

Show me how to verify from my phone that the lock icon is valid and that the
install prompt and video camera permission appear.
```

Check:

- [ ] A phone shows the site with a valid lock on `https://<elastic-ip>`
- [ ] You see one automatic renewal succeed before you invite anyone
- [ ] The failure alert email arrives when you deliberately break renewal in a test

### P3. Invite-only access and a hard user cap

Do this after the OTP login feature exists. It protects both your credits and your users.

```text
Part P3: restricted access. Branch pilot/p3-access-gate. Plan first.

Add a pilot access gate to the API and the apps:
- registration and login require the mobile number to be on an allowlist, or a
  valid invite code created by an admin; everyone else sees a friendly screen
  in the user's language saying the application is invitation-only
- an admin screen to add and remove allowlisted numbers, create and revoke
  invite codes, and see how many accounts exist
- a hard cap on total accounts, set from configuration; when reached, new
  sign-ups are refused with a clear message, existing users are unaffected
- stricter rate limits for the pilot, and a cap on file upload size and total
  storage per user
- a configuration switch to put the whole application into a maintenance
  page for everyone except admins
- tests proving a number outside the allowlist cannot register, log in or
  trigger an SMS

All new text goes through the translation files in Odia, English and Hindi.
```

Check: a non-allowlisted number cannot trigger an SMS; the cap and the maintenance switch both work.

### P4. Cost watch and shutdown plan

```text
Part P4: cost watch and shutdown plan. Branch pilot/p4-cost-watch. Plan first.

1. Extend the budgets from B6 to the pilot environment (they should already
   cover it; confirm), keep the credit-watch workflow from B4 running, and
   add a weekly cost report posted to me by email.
2. Write docs/shutdown-plan.md covering what happens when credits run out in
   each case: on the Paid plan (charges start on my card once credits are
   used or expire 12 months after sign-up) and, as a fallback, if the Free
   plan had ended before we upgraded (the account closes and I have 90 days
   to reopen it by upgrading). Include how to
   take an encrypted backup of the database and uploads to storage outside the
   AWS account, how to restore from it, and how to close the pilot cleanly
   (notify users, export data on request, delete data, delete resources).
3. Extend scripts/credit-status to show how many months of pilot the
   remaining credits cover at the current spend, and run it weekly in the
   credit-watch workflow.

Do not apply anything until I approve the plan.
```

Check: you have restored a backup once from outside the account; the shutdown plan is something you would follow.

### P5. Pilot go-live check

Do not invite anyone until every box is ticked.

- [ ] Upgraded to the Paid plan before the Free plan ended (part B6); budgets live and tested; the date the credits expire (12 months after sign-up) is written down
- [ ] Budgets and alerts tested; remaining credits cover the planned pilot months with a 20 percent reserve
- [ ] HTTPS on the IP address valid; one automatic renewal seen; the Elastic IP is recorded and protected from release
- [ ] Access gate on: allowlist or invite codes only; user cap set
- [ ] Only synthetic data until the penetration test and legal sign-off from the guideline are done; if real people are invited, consent text, privacy notice and grievance contact are live in all three languages
- [ ] Encrypted backup restored once from outside the account
- [ ] Maintenance switch tested
- [ ] Partner callback URLs (payment, identity, SMS) confirmed to work with an IP address, or a domain obtained
- [ ] Payment gateway, SMS, video and identity partner costs added to the budget

## What you do yourself, outside Claude Code

These need a person, an account owner or a signature.

AWS account and credits:

- [ ] Open the Billing console and note which plan the account is on, the credit balance, and the date the plan ends
- [ ] Decision made: stay on the Free plan until the Act alert (10 percent of credits or 15 days left), then upgrade in part B6. AWS asked for a card at sign-up, so check it is valid and will not expire before then
- [ ] Create `docs/credit-baseline.json` with the sign-up date, the starting credits and the plan end date, read from the Billing console
- [ ] Choose two email addresses that you read daily for AWS notices and the SNS alerts, and check the AWS account contact email is one of them
- [ ] Create calendar reminders as a backup to the automated alerts: 60, 30, 15 and 7 days before the plan end date, each saying "check scripts/credit-status"
- [ ] Look in the "Explore AWS" widget for the activities that earn the second $100 of credits, and do the ones that match what we build anyway (for example launching an EC2 instance); do not run services only to earn credits
- [ ] Turn on free tier usage alerts and credit-usage emails in Billing preferences
- [ ] Enable MFA on the root user and on every human user; stop using the root user for daily work
- [ ] Look up which services the Free plan blocks before designing around them
- [ ] Keep a separate record of the Elastic IP address once it exists
- [ ] Never give Claude Code production or root credentials; use a limited, short-lived login for dev only

Partners and business (start early, they take weeks):

- [ ] Decide whether to register a placeholder domain now; ask each partner whether an IP address callback is acceptable
- [ ] Apply for the payment gateway account
- [ ] Apply for the SMS provider and DLT sender and template registration
- [ ] Start onboarding with an Aadhaar and DigiLocker verification partner
- [ ] Start a trial with the video provider
- [ ] Engage the healthcare lawyer on consent wording and the regulatory points
- [ ] Begin user research and wireframes for onboarding and booking
- [ ] Track all of the above in an issue list in the repository

## Step 1 exit check

From the implementation guideline, with the changes this revision makes:

- [ ] A new developer can clone, run one command and see all three apps locally within 30 minutes
- [ ] A merged pull request reaches **dev** without manual steps (the original "staging" criterion is replaced by dev only, recorded in ADR 0009)
- [ ] `main` is protected and the pipeline blocks a failing build
- [ ] Third-party applications are submitted and tracked
- [ ] Credit-expiry alerts are active and tested, including simulated Watch, Plan, Act and Emergency levels (new). Budgets follow at the upgrade (part B6)
- [ ] ADR 0009 lists every requirement relaxed for the pilot (new)

Final prompt to close Step 1:

```text
Step 1 review. Read docs/mvp-v1-implementation-guideline.md, section Step 1,
and docs/adr/0009-aws-credits-and-restricted-pilot.md. Audit this repository
and our AWS setup against every build item and exit criterion. For each, give
pass or fail with the file or command that proves it. Then list risks or
shortcuts we took that Step 2 (secure foundation) must fix first, and the
current monthly cloud cost, the output of scripts/credit-status, and the date by
which we must upgrade. Update CLAUDE.md so
a new session can start Step 2 with full context.
```
