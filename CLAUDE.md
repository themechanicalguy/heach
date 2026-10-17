# HEACH

## What this is

HEACH is a mobile-first web application that lets patients in Odisha, India find, book and pay
verified care providers: online doctor consultation, home physiotherapy, home nursing, bedside
attendants, dental and skin clinic appointments, and lab tests. Providers onboard themselves, prove
identity through Aadhaar and DigiLocker, and are verified by an admin before they can list services;
patients keep prescriptions, reports and history in an encrypted medical record vault.
It handles sensitive health data, so security and data protection come before speed in every decision.

## Source of truth

Read these before planning any work. Do not copy their content here; link to requirement IDs instead
(for example `BK-03`, `EN-07`).

- `docs/mvp-v1-requirements.md` — what to build: roles, journeys, requirement IDs, security, stack
- `docs/mvp-v1-implementation-guideline.md` — in what order: 10 steps with exit criteria
- `docs/specs/` — one approved spec per step: acceptance criteria, data, API, threat model
- `docs/implementation-status.md` — what is built, partial or not started, per step and requirement ID
- `docs/local-development.md` — running everything locally, git hooks. Current: **Step 1**.

## Stack

| Layer                    | Choice                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Repository               | pnpm workspaces + Turborepo, Node LTS pinned, TypeScript strict                       |
| Patient and provider app | Next.js (React, TypeScript), installable PWA, server rendered                         |
| Admin panel              | React + TypeScript single-page app with a data-grid library                           |
| UI                       | Design tokens, Tailwind CSS, accessible headless components, Storybook                |
| i18n                     | ICU message catalogues; locale-prefixed routes `/or`, `/en`, `/hi`                    |
| API                      | Node.js NestJS REST API, OpenAPI spec, typed client generated for front ends          |
| Data                     | PostgreSQL, Redis, S3-compatible object storage, India cloud region only              |
| Keys and secrets         | Managed KMS (India region), envelope encryption, secrets manager                      |
| Background jobs          | Queue workers (notifications, reminders, auto-cancel, payouts)                        |
| Unit and component tests | Vitest, Testing Library, axe                                                          |
| E2E tests                | Playwright with mobile, tablet and desktop projects                                   |
| Security checks          | Static analysis, dependency, container and secret scanning in CI                      |
| Performance checks       | Lighthouse CI, bundle-size budgets                                                    |
| Observability            | OpenTelemetry, structured JSON logs, front-end error tracking, RUM                    |
| Delivery                 | GitHub Actions, preview deploy per PR, dev / staging / production, IaC, feature flags |

Third parties (SMS, payments, video, identity verification) always sit behind an adapter interface
with a test double.

## Monorepo layout (target)

```
apps/
  web/        Next.js PWA for patients and providers (role-based routes)
  admin/      React SPA admin panel, desktop first, English only
  api/        NestJS API and background workers
packages/
  ui/         Design tokens and accessible base components (Storybook)
  i18n/       ICU catalogues for or, en, hi; missing-key check
  config/     Shared ESLint, Prettier and tsconfig presets
  types/      Shared types and the API client generated from OpenAPI
  crypto/     Envelope and field-level encryption, blind indexes
  logger/     Structured logger with masking and correlation IDs
docs/         Requirements, implementation guideline, ADRs
```

Package scope: `@heach/*` (for example `@heach/ui`).

## Working rules

- **Spec-driven development** ([ADR 0007](docs/adr/0007-spec-driven-development.md)). The spec
  leads; code follows it:
  - No code for a step until its spec in `docs/specs/` is merged as Approved. If asked to build
    without one, write or update the spec first and get it approved.
  - Behaviour that differs from the spec changes the spec (requirements, guideline or step spec)
    in the same PR or an earlier one, never afterwards. Never silently implement something the
    spec does not say.
  - Every acceptance criterion (`EN-03.1`) has a test whose `describe` or `it` title starts with
    its ID, or a manual check recorded in the spec.
  - Endpoints, data fields and their classes are defined in the step spec before they are built;
    review checks the generated OpenAPI against it.
- **TypeScript strict** everywhere. No `any` without a comment explaining why; no `@ts-ignore`.
- **No hard-coded user-facing strings.** Every visible string comes from `packages/i18n`, with keys
  in Odia, English and Hindi. Admin is English only but still uses keys.
- **No secrets in code** (source, tests, fixtures, Dockerfiles, CI). Local values go in the
  untracked `.env`; `.env.example` holds placeholders only. Never print secrets in output.
  Git hooks and CI run gitleaks; never bypass them with `--no-verify`.
- **No personal or health data in logs.** Use `@heach/logger`, never `console.log`, in app code.
  Never put Restricted or Confidential data in logs, URLs, error messages, analytics, SMS or push text.
- **Synthetic data only.** Never use real patient or provider data in development, tests or fixtures.
- **Every change on a branch with a pull request.** Never commit to `main`. Branch names:
  `feat/…`, `fix/…`, `chore/…`, `docs/…`. Conventional commit messages.
- **Ask before adding a dependency that is not in the stack above.** State what it does, its
  licence, its maintenance status and the alternative within the stack.
- **Classify every new data field** (Restricted, Confidential, Internal, Public) as in the
  requirements' data classification section; Restricted fields are encrypted at field level.
- **Authorisation on the server** for every request and every object; never rely on the UI.
- **Track implementation status.** Any pull request that builds, extends or removes something a
  requirement ID or guideline step describes updates `docs/implementation-status.md` in the same
  pull request: the item's status (Done, Partial, Not started), what exists and what is missing,
  the module counts, and the "Last updated" line. Mark Done only when the requirement is met as
  written; otherwise Partial with the gap stated. A doc gap found along the way goes in its
  "Documentation gaps" list. CI fails a PR that changes `apps/`, `packages/` or `infra/` without
  touching that file, unless it carries the `no-status-change` label.
- A feature is done only when the definition of done in the requirements doc is met.
- Do not write application code beyond the current step without asking.

## Code style

- **Reuse before you create.** Before writing a component, hook, utility or service, search
  `packages/ui`, `packages/*` and the current app for one that does the job. Extend an existing one
  (props, variants, composition) rather than writing a near-copy.
- **Keep it DRY.** When the same logic or markup appears a second time, extract it into a shared
  function or component. Move it to `packages/*` once a second app needs it.
- **Keep it simple.** Choose the plainest solution that meets the requirement. No speculative
  abstractions, no layers or generics added "for later", no clever one-liners that are hard to read.
- **Small units.** Each function does one thing and stays short: aim for under 30 lines; ESLint
  fails any function over 100 lines (`max-lines-per-function`). Each
  component, module and file has one responsibility. Split anything that grows past that.
- **Standard patterns, applied where they fit:** NestJS modules, services and dependency injection
  in the API; adapters for third parties; repositories for data access; composition and custom hooks
  in React; pure functions for business rules. Follow SOLID and each framework's documented
  conventions instead of inventing new ones.
- Clear names over comments; comment only the _why_ that the code cannot show.

## Commands

Requires Node 24 LTS (`.nvmrc`) and pnpm (version pinned in `package.json`).

```sh
pnpm install          # install all workspaces
pnpm dev:up           # .env + free ports + Docker services (Postgres, Redis, S3, Mailpit) + all apps
pnpm dev:down         # stop the Docker services (data kept); services:reset wipes it
pnpm dev              # run every app in dev mode (services must already be up)
pnpm check            # lint + typecheck + unit tests + build: what CI runs; run before a PR
pnpm lint | typecheck | test | build   # each step of check on its own (Turborepo, cached)
pnpm format           # Prettier write; format:check to verify only
pnpm secrets:scan     # gitleaks over the whole git history (also runs in CI)
pnpm --filter <pkg> <script>   # run one workspace's script
pnpm --filter @heach/types generate   # after changing API routes or DTOs; CI runs `check`
```

Cloud (AWS, dev only, account on Free plan credits; [ADR 0009](docs/adr/0009-aws-credits-and-restricted-pilot.md),
[environments](docs/environments.md), [credit expiry plan](docs/credit-expiry-plan.md),
[playbook](docs/step-1-claude-code-playbook.md)):

```sh
export AWS_PROFILE=<your-profile>   # IAM user with MFA; never root
scripts/credit-status                # credits left, days left, alert level (pnpm credit:status)
scripts/dev-sleep | scripts/dev-wake # stop or start the dev host to save credits
scripts/smoke-test.sh <ip>           # /healthz, /api/healthz, /api/readyz
pnpm test:scripts                    # unit tests for scripts/ (node --test)
tofu -chdir=infra/<stack> plan -out plan.tfplan   # always plan; a human approves every apply
```

Infrastructure changes: show the `tofu plan`; never apply without the user's approval for
anything that costs money, destroys or replaces. Keep the lean design (no NAT gateway, load
balancer or managed databases) until an ADR replaces ADR 0008.
