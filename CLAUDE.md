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

Current step: **Step 1, repository and app initialization.**

## Stack

| Layer | Choice |
| --- | --- |
| Repository | pnpm workspaces + Turborepo, Node LTS pinned, TypeScript strict |
| Patient and provider app | Next.js (React, TypeScript), installable PWA, server rendered |
| Admin panel | React + TypeScript single-page app with a data-grid library |
| UI | Design tokens, Tailwind CSS, accessible headless components, Storybook |
| i18n | ICU message catalogues; locale-prefixed routes `/or`, `/en`, `/hi` |
| API | Node.js NestJS REST API, OpenAPI spec, typed client generated for front ends |
| Data | PostgreSQL, Redis, S3-compatible object storage, India cloud region only |
| Keys and secrets | Managed KMS (India region), envelope encryption, secrets manager |
| Background jobs | Queue workers (notifications, reminders, auto-cancel, payouts) |
| Unit and component tests | Vitest, Testing Library, axe |
| E2E tests | Playwright with mobile, tablet and desktop projects |
| Security checks | Static analysis, dependency, container and secret scanning in CI |
| Performance checks | Lighthouse CI, bundle-size budgets |
| Observability | OpenTelemetry, structured JSON logs, front-end error tracking, RUM |
| Delivery | GitHub Actions, preview deploy per PR, dev / staging / production, IaC, feature flags |

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

- **TypeScript strict** everywhere. No `any` without a comment explaining why; no `@ts-ignore`.
- **No hard-coded user-facing strings.** Every visible string comes from `packages/i18n`, with keys
  in Odia, English and Hindi. Admin is English only but still uses keys.
- **No secrets in code.** Not in source, tests, fixtures, Dockerfiles or CI files. Local values go in
  an untracked `.env`; `.env.example` holds names only. Never print secrets in output.
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
- **Small units.** Each function does one thing and stays short (aim for under about 30 lines). Each
  component, module and file has one responsibility. Split anything that grows past that.
- **Standard patterns, applied where they fit:** NestJS modules, services and dependency injection
  in the API; adapters for third parties; repositories for data access; composition and custom hooks
  in React; pure functions for business rules. Follow SOLID and each framework's documented
  conventions instead of inventing new ones.
- Clear names over comments; comment only the *why* that the code cannot show.

## Commands

<!-- Filled in as the repository is built. -->
